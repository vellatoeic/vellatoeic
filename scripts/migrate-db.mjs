// 옛 Supabase DB → 새 Supabase DB 이사 (public 스키마 + 데이터 + 보관함 설정)
//
//   node scripts/migrate-db.mjs            확인만 (읽기 전용): 연결, 표별 개수, 새 DB가 비었는지
//   node scripts/migrate-db.mjs --run      실제 이사 (새 DB에 한 번에 만들고, 실패하면 전부 되돌려요)
//   node scripts/migrate-db.mjs --dry      연습: --run과 똑같이 만들어 보고 마지막에 전부 되돌려요 (새 DB는 그대로 비어 있어요)
//   node scripts/migrate-db.mjs --apply supabase/34_material_links.sql   새 DB에만 SQL 파일 하나 실행 (SQL Editor에 붙여 넣는 것과 같아요)
//   node scripts/migrate-db.mjs --compare  옛/새 표별 개수만 다시 비교
//
// 연결 주소는 프로젝트 폴더 .env.migrate의 OLD_DB_URL, NEW_DB_URL에서 읽어요. 주소·비밀번호는 화면에 찍지 않아요.
// 보관함(bucket)은 이름·공개 여부·크기 제한만 만들어요. 파일은 옮기지 않아요.

import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry");
const MODE = process.argv.includes("--run") || DRY ? "run" : process.argv.includes("--compare") ? "compare" : "check";

// ── 연결 정보 (화면에 찍지 않아요) ──
function readEnv() {
  const env = {};
  for (const line of readFileSync(new URL("../.env.migrate", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  if (!env.OLD_DB_URL || !env.NEW_DB_URL) throw new Error(".env.migrate에 OLD_DB_URL, NEW_DB_URL이 모두 있어야 해요.");
  return env;
}
const env = readEnv();
const secrets = [env.OLD_DB_URL, env.NEW_DB_URL].flatMap((u) => {
  try {
    const x = new URL(u);
    return [u, x.host, x.hostname, decodeURIComponent(x.password), x.password, decodeURIComponent(x.username)].filter((s) => s && s.length > 3);
  } catch {
    return [u];
  }
});
const redact = (s) => secrets.reduce((out, x) => out.split(x).join("***"), String(s));
const log = (...a) => console.log(redact(a.join(" ")));

// 데이터는 Postgres 글자 그대로 받아요 (시각의 마이크로초, 큰 숫자, 배열·json이 바뀌지 않게)
const raw = { getTypeParser: () => (v) => v };
const connect = async (url) => {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
};

const q = (name) => `"${name.replace(/"/g, '""')}"`;
const t = (name) => `public.${q(name)}`;

async function tables(db) {
  const { rows } = await db.query(`select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') and not c.relispartition order by 1`);
  return rows.map((r) => r.relname);
}

async function counts(db, names) {
  const out = {};
  for (const n of names) out[n] = Number((await db.query(`select count(*)::text as n from ${t(n)}`)).rows[0].n);
  return out;
}

function printCompare(names, a, b) {
  log("\n표 이름                              옛 DB    새 DB");
  let ok = true;
  for (const n of names) {
    const same = a[n] === b[n];
    if (!same) ok = false;
    log(`${(same ? "  " : "❌") + " " + n.padEnd(34)}${String(a[n] ?? "-").padStart(6)}  ${String(b[n] ?? "-").padStart(6)}`);
  }
  log(ok ? "\n✅ 모든 표 개수가 같아요." : "\n❌ 개수가 다른 표가 있어요.");
  return ok;
}

// ── 옛 DB 구조를 SQL 문장으로 만들어요 (pg_catalog 기준) ──
async function buildSchema(old, newRoles) {
  const pre = [], tableSql = [], post = [], fks = [], late = [], warnings = [];
  const rolesOk = (r) => r === "PUBLIC" || newRoles.has(r);

  // 확장 기능: 옛 DB에 있고 새 DB에 없는 것만 (Supabase 기본 확장은 대부분 이미 있어요)
  const ext = (await old.query(`select e.extname, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname <> 'plpgsql' order by 1`)).rows;

  // enum 타입
  const enums = (await old.query(`
    select t.typname, array_agg(e.enumlabel order by e.enumsortorder)::text[] as labels
    from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typnamespace = 'public'::regnamespace group by 1`)).rows;
  for (const e of enums) {
    const labels = e.labels.map((s) => `'${s.replace(/'/g, "''")}'`);
    pre.push(`create type ${t(e.typname)} as enum (${labels.join(", ")})`);
  }
  const otherTypes = (await old.query(`
    select t.typname from pg_type t where t.typnamespace = 'public'::regnamespace and t.typtype in ('d','c')
      and not exists (select 1 from pg_class c where c.reltype = t.oid)`)).rows;
  for (const x of otherTypes) warnings.push(`도메인/복합 타입 ${x.typname}은 자동으로 만들지 않아요.`);

  // 시퀀스 (identity 시퀀스는 표와 함께 자동 생성돼서 빼요)
  const seqs = (await old.query(`
    select s.sequencename, s.data_type::text, s.start_value::text, s.min_value::text, s.max_value::text, s.increment_by::text, s.cycle, s.cache_size::text, s.last_value::text
    from pg_sequences s where s.schemaname = 'public'
      and not exists (select 1 from pg_depend d join pg_class c on c.oid = d.objid where c.relname = s.sequencename and c.relnamespace = 'public'::regnamespace and d.deptype = 'i')`)).rows;
  for (const s of seqs) {
    pre.push(`create sequence ${t(s.sequencename)} as ${s.data_type} increment ${s.increment_by} minvalue ${s.min_value} maxvalue ${s.max_value} start ${s.start_value} cache ${s.cache_size}${s.cycle ? " cycle" : ""}`);
  }
  const seqOwners = (await old.query(`
    select s.relname as seq, c.relname as tbl, a.attname as col
    from pg_depend d join pg_class s on s.oid = d.objid and s.relkind = 'S'
    join pg_class c on c.oid = d.refobjid join pg_attribute a on a.attrelid = c.oid and a.attnum = d.refobjsubid
    where d.deptype = 'a' and s.relnamespace = 'public'::regnamespace`)).rows;

  // 표
  const cols = (await old.query(`
    select c.relname, a.attname, format_type(a.atttypid, a.atttypmod) as typ, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) as def,
           a.attidentity, a.attgenerated, a.attacl is not null as has_col_acl, coll.collname
    from pg_class c
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
    left join pg_collation coll on coll.oid = a.attcollation and a.attcollation <> (select typcollation from pg_type where oid = a.atttypid)
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') and not c.relispartition
    order by c.relname, a.attnum`)).rows;
  const byTable = new Map();
  for (const c of cols) {
    if (!byTable.has(c.relname)) byTable.set(c.relname, []);
    byTable.get(c.relname).push(c);
  }
  const genCols = new Map();
  const identityAlways = new Set();
  for (const [name, list] of byTable) {
    const lines = list.map((c) => {
      let s = `${q(c.attname)} ${c.typ}`;
      if (c.collname) s += ` collate "${c.collname}"`;
      if (c.attgenerated === "s") {
        s += ` generated always as (${c.def}) stored`;
        genCols.set(name, [...(genCols.get(name) ?? []), c.attname]);
      } else if (c.attidentity) {
        s += ` generated ${c.attidentity === "a" ? "always" : "by default"} as identity`;
        if (c.attidentity === "a") identityAlways.add(name);
      } else if (c.def) s += ` default ${c.def}`;
      if (c.attnotnull) s += " not null";
      if (c.has_col_acl) warnings.push(`${name}.${c.attname} 칸별 권한은 옮기지 않아요.`);
      return s;
    });
    tableSql.push(`create table ${t(name)} (\n  ${lines.join(",\n  ")}\n)`);
  }
  for (const o of seqOwners) post.push(`alter sequence ${t(o.seq)} owned by ${t(o.tbl)}.${q(o.col)}`);

  // 제약 (외래키는 데이터를 넣은 뒤에)
  const cons = (await old.query(`
    select c.relname, k.conname, k.contype, pg_get_constraintdef(k.oid) as def
    from pg_constraint k join pg_class c on c.oid = k.conrelid
    where c.relnamespace = 'public'::regnamespace and k.contype in ('p','u','c','f','x') and c.relkind in ('r','p')
    order by case k.contype when 'p' then 0 when 'u' then 1 when 'x' then 2 when 'c' then 3 else 4 end, c.relname, k.conname`)).rows;
  for (const k of cons) {
    const sql = `alter table only ${t(k.relname)} add constraint ${q(k.conname)} ${k.def}`;
    (k.contype === "f" ? fks : post).push(sql);
  }

  // 인덱스 (제약이 만드는 인덱스는 빼요)
  const idx = (await old.query(`
    select pg_get_indexdef(i.indexrelid) as def
    from pg_index i join pg_class c on c.oid = i.indrelid
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p')
      and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid and k.conrelid = i.indrelid and k.contype in ('p','u','x'))
    order by 1`)).rows;
  for (const i of idx) post.push(i.def);

  // 뷰
  const views = (await old.query(`select c.relname, c.relkind, pg_get_viewdef(c.oid) as def from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('v','m') order by c.oid`)).rows;

  // 함수 (확장 기능 소속 제외) — 표 형식을 돌려주는 함수(draw_gift)가 있어서 표 다음에 만들어요
  const fns = (await old.query(`
    select p.oid, p.proname, p.prokind, pg_get_function_identity_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('f','p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    order by p.proname`)).rows;
  const fnAfterTables = fns.map((f) => f.def);
  const aggs = (await old.query(`select proname from pg_proc where pronamespace = 'public'::regnamespace and prokind in ('a','w')`)).rows;
  for (const a of aggs) warnings.push(`집계 함수 ${a.proname}은 자동으로 만들지 않아요.`);
  for (const v of views) fnAfterTables.push(v.relkind === "v" ? `create view ${t(v.relname)} as ${v.def}` : `create materialized view ${t(v.relname)} as ${v.def}`);

  // 트리거
  const trg = (await old.query(`
    select pg_get_triggerdef(g.oid) as def from pg_trigger g join pg_class c on c.oid = g.tgrelid
    where c.relnamespace = 'public'::regnamespace and not g.tgisinternal order by g.tgname`)).rows;
  for (const g of trg) late.push(g.def);

  // RLS · 정책
  const rls = (await old.query(`select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')`)).rows;
  for (const r of rls) {
    if (r.relrowsecurity) late.push(`alter table ${t(r.relname)} enable row level security`);
    if (r.relforcerowsecurity) late.push(`alter table ${t(r.relname)} force row level security`);
  }
  const pols = (await old.query(`select tablename, policyname, permissive, roles::text, cmd, qual, with_check from pg_policies where schemaname = 'public'`)).rows;
  for (const p of pols) {
    const roles = p.roles.replace(/^\{|\}$/g, "").split(",").map((r) => (r === "public" ? "public" : q(r.replace(/^"|"$/g, ""))));
    late.push(`create policy ${q(p.policyname)} on ${t(p.tablename)} as ${p.permissive.toLowerCase()} for ${p.cmd.toLowerCase()} to ${roles.join(", ")}${p.qual ? ` using (${p.qual})` : ""}${p.with_check ? ` with check (${p.with_check})` : ""}`);
  }

  // 권한: 새 프로젝트 기본 권한을 지우고 옛 프로젝트 권한을 그대로 (표·시퀀스·뷰·함수)
  const SUPA = ["anon", "authenticated", "service_role"].filter((r) => newRoles.has(r));
  const revokeFrom = ["public", ...SUPA.map(q)].join(", ");
  const relAcl = (await old.query(`
    select c.relname, c.relkind, pg_get_userbyid(c.relowner) as owner,
           coalesce(g.rolname, 'PUBLIC') as grantee, x.privilege_type, x.is_grantable
    from pg_class c
    cross join lateral aclexplode(coalesce(c.relacl, acldefault((case when c.relkind = 'S' then 's' else 'r' end)::"char", c.relowner))) x
    left join pg_roles g on g.oid = x.grantee
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m','S')`)).rows;
  const relNames = [...new Map((await old.query(`select relname, relkind from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p','v','m','S')`)).rows.map((r) => [r.relname, r.relkind])).entries()];
  for (const [name, kind] of relNames) late.push(`revoke all on ${kind === "S" ? "sequence " : "table "}${t(name)} from ${revokeFrom}`);
  for (const a of relAcl) {
    if (a.grantee === a.owner) continue;
    if (!rolesOk(a.grantee)) { warnings.push(`역할 ${a.grantee}이 새 DB에 없어 ${a.relname} 권한을 건너뛰어요.`); continue; }
    if (a.privilege_type === "MAINTAIN" && !newRoles.has("__pg17")) continue;
    const g = a.is_grantable ? " with grant option" : "";
    late.push(`grant ${a.privilege_type.toLowerCase()} on ${a.relkind === "S" ? "sequence " : "table "}${t(a.relname)} to ${a.grantee === "PUBLIC" ? "public" : q(a.grantee)}${g}`);
  }
  const fnAcl = (await old.query(`
    select p.oid, pg_get_userbyid(p.proowner) as owner, coalesce(g.rolname, 'PUBLIC') as grantee, x.is_grantable
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f'::"char", p.proowner))) x
    left join pg_roles g on g.oid = x.grantee
    where p.pronamespace = 'public'::regnamespace and p.prokind in ('f','p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`)).rows;
  for (const f of fns) {
    const sig = `${f.prokind === "p" ? "procedure" : "function"} ${t(f.proname)}(${f.args})`;
    late.push(`revoke all on ${sig} from ${revokeFrom}`);
    for (const a of fnAcl.filter((x) => x.oid === f.oid)) {
      if (a.grantee === a.owner) continue;
      if (!rolesOk(a.grantee)) continue;
      late.push(`grant execute on ${sig} to ${a.grantee === "PUBLIC" ? "public" : q(a.grantee)}${a.is_grantable ? " with grant option" : ""}`);
    }
  }

  // 이벤트 트리거 (public 함수를 쓰는 것만: 예) 새 표에 RLS 자동 켜기 ensure_rls)
  const evts = (await old.query(`
    select e.evtname, e.evtevent, e.evttags, p.proname, e.evtenabled
    from pg_event_trigger e join pg_proc p on p.oid = e.evtfoid where p.pronamespace = 'public'::regnamespace`)).rows;
  const events = evts.map((e) => {
    const tags = e.evttags?.length ? ` when tag in (${e.evttags.map((x) => `'${x.replace(/'/g, "''")}'`).join(", ")})` : "";
    const list = [`create event trigger ${q(e.evtname)} on ${e.evtevent}${tags} execute function ${t(e.proname)}()`];
    if (e.evtenabled === "D") list.push(`alter event trigger ${q(e.evtname)} disable`);
    return { name: e.evtname, list };
  });

  return { events, ext, pre, tableSql, post, fnAfterTables, fks, late, warnings, seqs, genCols, identityAlways, fnNames: fns.map((f) => f.proname), polCount: pols.length, trgCount: trg.length, viewCount: views.length };
}

async function buckets(old) {
  return (await old.query(`select id, name, public, file_size_limit, allowed_mime_types::text as mimes from storage.buckets order by id`)).rows;
}

// ── 실행 ──
const applyAt = process.argv.indexOf("--apply");
if (applyAt > 0) {
  const file = process.argv[applyAt + 1];
  if (!file || !/^supabase\/[\w-]+\.sql$/.test(file)) throw new Error("--apply 다음에 supabase/파일이름.sql을 적어 주세요.");
  const db = await connect(env.NEW_DB_URL).catch((e) => { throw new Error("새 DB 연결 실패: " + redact(e.message)); });
  try {
    await db.query(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
    log(`✅ 새 DB에 ${file} 실행 완료`);
  } catch (e) {
    await db.query("rollback").catch(() => {});
    console.error(`❌ ${file} 실행 실패: ${redact(e.message)}`);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
  process.exit();
}

const old = await connect(env.OLD_DB_URL).catch((e) => { throw new Error("옛 DB 연결 실패: " + redact(e.message)); });
const neu = await connect(env.NEW_DB_URL).catch((e) => { throw new Error("새 DB 연결 실패: " + redact(e.message)); });

try {
  // 옛 DB는 한 시점의 모습으로 읽어요 (읽기 전용)
  await old.query("begin isolation level repeatable read read only");
  await old.query("set local search_path = ''"); // 모든 이름에 public. 을 붙여서 만들게요
  const oldTables = await tables(old);

  if (MODE === "compare") {
    const newTables = await tables(neu);
    const names = [...new Set([...oldTables, ...newTables])].sort();
    const ok = printCompare(names, await counts(old, oldTables), await counts(neu, newTables));
    process.exitCode = ok ? 0 : 1;
  } else {
    const newRoles = new Set((await neu.query(`select rolname from pg_roles`)).rows.map((r) => r.rolname));
    if (Number((await neu.query(`select current_setting('server_version_num')::int as v`)).rows[0].v) >= 170000) newRoles.add("__pg17");
    const s = await buildSchema(old, newRoles);
    const bks = await buckets(old);
    const newTables = await tables(neu);
    const newFns = (await neu.query(`select proname from pg_proc where pronamespace = 'public'::regnamespace`)).rows.map((r) => r.proname);
    const newExt = new Set((await neu.query(`select extname from pg_extension`)).rows.map((r) => r.extname));
    const missingExt = s.ext.filter((e) => !newExt.has(e.extname));
    const oldCounts = await counts(old, oldTables);
    const oldVer = (await old.query(`show server_version`)).rows[0].server_version;
    const newVer = (await neu.query(`show server_version`)).rows[0].server_version;

    log(`옛 DB 연결 ✅ (Postgres ${oldVer}) · 새 DB 연결 ✅ (Postgres ${newVer})`);
    log(`옮길 것: 표 ${oldTables.length}개 · 행 ${Object.values(oldCounts).reduce((a, b) => a + b, 0)}개 · 함수 ${s.fnNames.length}개(${s.fnNames.join(", ") || "-"}) · 시퀀스 ${s.seqs.length}개 · 뷰 ${s.viewCount}개 · 트리거 ${s.trgCount}개 · 이벤트 트리거 ${s.events.map((e) => e.name).join(", ") || "-"} · 정책 ${s.polCount}개`);
    log(`보관함 ${bks.length}개: ${bks.map((b) => `${b.id}(${b.public ? "공개" : "비공개"})`).join(", ")}`);
    if (missingExt.length) log(`새 DB에 없는 확장 기능: ${missingExt.map((e) => `${e.extname}(${e.nspname})`).join(", ")} → 같은 스키마로 만들어요`);
    for (const w of s.warnings) log("⚠️ " + w);
    if (newTables.length || newFns.length) {
      log(`\n⛔ 새 DB public에 이미 표 ${newTables.length}개, 함수 ${newFns.length}개가 있어요: ${[...newTables, ...newFns].join(", ")}`);
      log("새 DB가 비어 있을 때만 이사해요. (Supabase 새 프로젝트를 그대로 쓰면 비어 있어요)");
      process.exitCode = 1;
    } else if (MODE === "check") {
      log("\n표별 개수 (옛 DB):");
      for (const n of oldTables) log(`  ${n.padEnd(34)}${String(oldCounts[n]).padStart(6)}`);
      log("\n새 DB public은 비어 있어요. 이사하려면: node scripts/migrate-db.mjs --run");
    } else {
      // ── 이사: 새 DB에 한 트랜잭션으로 (실패하면 아무것도 남지 않아요) ──
      await neu.query("begin");
      await neu.query("set local search_path = ''");
      await neu.query("set local check_function_bodies = off");
      await neu.query("set local session_replication_role = replica").catch(async (e) => {
        throw new Error("session_replication_role 설정 실패: " + redact(e.message));
      });
      const run = async (label, list) => {
        for (const sql of list) {
          try {
            await neu.query(sql);
          } catch (e) {
            throw new Error(`${label} 실패: ${redact(e.message)}\n문장: ${redact(sql.slice(0, 300))}`);
          }
        }
        log(`  ✓ ${label} ${list.length}개`);
      };
      await run("확장 기능", missingExt.map((e) => `create extension if not exists ${q(e.extname)} with schema ${q(e.nspname)}`));
      await run("타입·시퀀스", s.pre);
      await run("표", s.tableSql);
      await run("기본키·고유·검사 제약·인덱스", s.post);
      await run("함수·뷰", s.fnAfterTables);

      // 데이터
      let total = 0;
      for (const name of oldTables) {
        const gen = new Set(s.genCols.get(name) ?? []);
        const colNames = (await old.query(`select attname from pg_attribute where attrelid = $1::regclass and attnum > 0 and not attisdropped order by attnum`, [t(name)])).rows.map((r) => r.attname).filter((c) => !gen.has(c));
        const res = await old.query({ text: `select ${colNames.map(q).join(", ")} from ${t(name)}`, types: raw });
        const per = Math.max(1, Math.min(500, Math.floor(60000 / colNames.length)));
        for (let i = 0; i < res.rows.length; i += per) {
          const chunk = res.rows.slice(i, i + per);
          const params = [];
          const values = chunk.map((row) => `(${colNames.map((c) => { params.push(row[c]); return `$${params.length}`; }).join(", ")})`);
          const over = s.identityAlways.has(name) ? " overriding system value" : "";
          try {
            await neu.query(`insert into ${t(name)} (${colNames.map(q).join(", ")})${over} values ${values.join(", ")}`, params);
          } catch (e) {
            throw new Error(`${name} 데이터 넣기 실패: ${redact(e.message)}`);
          }
        }
        total += res.rows.length;
      }
      log(`  ✓ 데이터 ${oldTables.length}개 표 · ${total}행`);

      // 시퀀스 현재 값
      const setvals = [];
      for (const sq of s.seqs) if (sq.last_value !== null) setvals.push(`select setval('public.${q(sq.sequencename)}', ${sq.last_value}, true)`);
      const ident = (await old.query(`
        select c.relname as tbl, a.attname as col, pg_get_serial_sequence(format('public.%I', c.relname), a.attname) as seq
        from pg_attribute a join pg_class c on c.oid = a.attrelid
        where c.relnamespace = 'public'::regnamespace and a.attidentity <> '' and a.attnum > 0`)).rows;
      for (const i of ident) {
        const last = (await old.query(`select last_value::text, is_called from ${i.seq}`)).rows[0];
        setvals.push(`select setval(pg_get_serial_sequence('public.${q(i.tbl)}', '${i.col}'), ${last.last_value}, ${last.is_called})`);
      }
      await run("시퀀스 값", setvals);
      await run("외래키", s.fks);
      await run("트리거·RLS·정책·권한", s.late);

      // 보관함 (같은 이름·공개 여부·크기·파일 종류 제한)
      for (const b of bks) {
        await neu.query(
          `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ($1, $2, $3, $4, $5::text[]) on conflict (id) do nothing`,
          [b.id, b.name, b.public, b.file_size_limit, b.mimes],
        );
      }
      log(`  ✓ 보관함 ${bks.length}개 (${bks.map((b) => b.id).join(", ")})`);

      if (DRY) {
        // 연습: 되돌리기 전에 개수만 비교해요
        const ok = printCompare(oldTables, oldCounts, await counts(neu, await tables(neu)));
        await neu.query("rollback");
        log(`\n🧪 연습 끝: 오류 없이 만들어졌고 ${ok ? "개수도 같아요" : "개수가 달라요"}. 새 DB는 다시 비웠어요.`);
        process.exitCode = ok ? 0 : 1;
      } else {

      await neu.query("commit");

      // 이벤트 트리거는 따로 (권한이 없어 실패해도 이사는 그대로 유지)
      for (const ev of s.events) {
        try {
          await neu.query("begin");
          for (const sql of ev.list) await neu.query(sql);
          await neu.query("commit");
          log(`  ✓ 이벤트 트리거 ${ev.name}`);
        } catch (e) {
          await neu.query("rollback").catch(() => {});
          log(`  ⚠️ 이벤트 트리거 ${ev.name}을 만들지 못했어요 (이사는 완료): ${redact(e.message)}`);
        }
      }

      await neu.query("notify pgrst, 'reload schema'");
      log("  ✓ notify pgrst, 'reload schema'");

      const after = await tables(neu);
      process.exitCode = printCompare(oldTables, oldCounts, await counts(neu, after)) ? 0 : 1;
      }
    }
  }
} catch (e) {
  await neu.query("rollback").catch(() => {});
  console.error("\n❌ " + redact(e.message ?? e));
  console.error("새 DB에는 아무것도 남지 않았어요(전부 되돌림).");
  process.exitCode = 1;
} finally {
  await old.query("rollback").catch(() => {});
  await old.end().catch(() => {});
  await neu.end().catch(() => {});
}
