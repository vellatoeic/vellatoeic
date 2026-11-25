// Supabase SQL 파일 실행기: SQL Editor에 붙여 넣는 대신 Claude Code가 직접 실행해요.
//
//   npm run sql -- supabase/38_예시.sql            실행: 파일 내용을 먼저 보여주고 트랜잭션 하나로 실행(실패하면 전부 되돌려요)
//                                                  → 성공하면 바뀐 행 수·select 결과를 보여주고 supabase/APPLIED.md에 기록해요
//   npm run sql -- supabase/38_예시.sql --dry      연습: 똑같이 실행해 보고 결과(영향 받는 행 수)만 보여준 뒤 전부 되돌려요(기록 안 함)
//   npm run sql -- supabase/38_예시.sql --confirm  drop / delete / truncate(alter … drop 포함)가 있는 파일은 이게 있어야 실행해요
//   npm run sql -- supabase/38_예시.sql --again    APPLIED.md에 이미 실행 완료로 적힌 파일을 다시 실행할 때
//   npm run sql -- --check                         접속만 확인(읽기 전용: applications 행 수)
//
// 연결 주소는 .env.local의 SUPABASE_DB_URL(Session pooler URI)에서 읽어요. 주소·비밀번호는 어떤 출력에도 찍지 않아요.
// 작업 폴더(git worktree)에서 실행하면 원래 폴더의 .env.local을 찾아 써요. SQL 파일·APPLIED.md 기록은 실행한 폴더 것을 써요.
// 파일 안의 begin; / commit; 은 빼고, 파일 전체를 이 스크립트의 트랜잭션 하나로 묶어요.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SUPABASE_DIR = resolve(ROOT, "supabase");
const APPLIED = resolve(SUPABASE_DIR, "APPLIED.md");
const FLAGS = ["--confirm", "--dry", "--again", "--check"];

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const DRY = flag("--dry");

const USAGE = `쓰는 법:
  npm run sql -- supabase/파일.sql             실행 (성공하면 APPLIED.md에 기록)
  npm run sql -- supabase/파일.sql --dry       연습 실행 후 전부 되돌리기 (영향 받는 행 수 보기)
  npm run sql -- supabase/파일.sql --confirm   drop / delete / truncate가 있는 파일 실행
  npm run sql -- supabase/파일.sql --again     이미 실행한 파일 다시 실행
  npm run sql -- --check                       접속만 확인 (읽기 전용)`;

// ── 출력: 주소·비밀번호 조각은 모두 *** 로 가려요 ──
let secrets = [];
const redact = (s) => secrets.reduce((out, x) => out.split(x).join("***"), String(s));
const log = (...a) => console.log(redact(a.join(" ")));
function stop(msg) {
  console.error(redact(msg));
  process.exit(1);
}

// ── SQL 읽기 도우미 ──
// 같은 길이로 가려요(줄 바꿈은 그대로) → 줄 번호·오류 위치가 원본과 같아요.
//   code: 주석만 가림. 문자열·$$ 본문은 그대로라 DO 블록 안의 delete도 찾아요.
//   bare: 주석·문자열·$$ 본문까지 가림 → 문장 나누기·begin/commit 찾기용.
const DOLLAR = /\$([A-Za-z_\u0080-￿][\w\u0080-￿]*)?\$/y;
function mask(sql) {
  const code = sql.split(""), bare = sql.split("");
  const blank = (arr, from, to) => { for (let k = from; k < to; k++) if (arr[k] !== "\n") arr[k] = " "; };
  const isWord = (c) => !!c && /[\w$\u0080-￿]/.test(c);
  let i = 0;
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1];
    let j = i + 1;
    if (c === "-" && n === "-") {
      j = sql.indexOf("\n", i);
      if (j < 0) j = sql.length;
      blank(code, i, j); blank(bare, i, j);
    } else if (c === "/" && n === "*") {
      let depth = 1;
      j = i + 2;
      while (j < sql.length && depth) {
        if (sql[j] === "/" && sql[j + 1] === "*") { depth++; j += 2; }
        else if (sql[j] === "*" && sql[j + 1] === "/") { depth--; j += 2; }
        else j++;
      }
      blank(code, i, j); blank(bare, i, j);
    } else if (c === "'" || c === '"') {
      const esc = c === "'" && /[eE]/.test(sql[i - 1] ?? "") && !isWord(sql[i - 2]);
      while (j < sql.length) {
        if (esc && sql[j] === "\\") j += 2;
        else if (sql[j] === c && sql[j + 1] === c) j += 2;
        else if (sql[j] === c) { j++; break; }
        else j++;
      }
      blank(bare, i, j);
    } else if (c === "$" && !isWord(sql[i - 1])) {
      DOLLAR.lastIndex = i;
      const m = DOLLAR.exec(sql);
      if (m) {
        const end = sql.indexOf(m[0], i + m[0].length);
        j = end < 0 ? sql.length : end + m[0].length;
        blank(bare, i, j);
      }
    }
    i = j;
  }
  return { code: code.join(""), bare: bare.join("") };
}

// 세미콜론으로 문장 나누기 (from: 첫 글자 위치, to: ; 다음 위치)
function statements(bare) {
  const out = [];
  let start = 0;
  for (let i = 0; i <= bare.length; i++) {
    if (i < bare.length && bare[i] !== ";") continue;
    const text = bare.slice(start, i);
    const lead = text.search(/\S/);
    if (lead >= 0) out.push({ from: start + lead, to: Math.min(i + 1, bare.length), text: text.trim() });
    start = i + 1;
  }
  return out;
}

const lineAt = (text, at) => text.slice(0, at).split("\n").length;
const cut = (s, n = 60) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// ── 연결 ──
function dbUrlIn(file) {
  let url = "";
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?SUPABASE_DB_URL\s*=\s*(.*?)\s*$/);
      if (m) url = m[1].replace(/^(["'])(.*)\1$/, "$2").trim();
    }
  }
  return url;
}

// 작업 폴더(git worktree, 예: .claude/worktrees/…)에는 .env.local이 없어요.
// git이 알려주는 원래 폴더(메인 checkout = 공통 .git 폴더의 위)를 찾아 그 .env.local을 써요. 주소를 복사해 두지 않아요.
function mainCheckoutRoot() {
  try {
    const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return common ? dirname(resolve(ROOT, common)) : null;
  } catch {
    return null;
  }
}

function readDbUrl() {
  let url = dbUrlIn(resolve(ROOT, ".env.local"));
  if (!url) {
    const main = mainCheckoutRoot();
    if (main && main !== resolve(ROOT)) {
      url = dbUrlIn(resolve(main, ".env.local"));
      if (url) log(`ℹ️ 작업 폴더라서 원래 폴더(${main})의 .env.local로 접속해요.`);
    }
  }
  if (!url) stop(`❌ .env.local의 SUPABASE_DB_URL이 비어 있어요. 이렇게 넣어 주세요:
  1. Supabase 대시보드 → 이 프로젝트 → 위쪽 [Connect]
  2. 'Session pooler'의 URI 복사 (postgresql://postgres.… 로 시작)
  3. [YOUR-PASSWORD]를 DB 비밀번호로 바꿔 .env.local의 SUPABASE_DB_URL= 뒤에 붙여 넣고 저장`);
  if (/YOUR-PASSWORD/i.test(url)) stop("❌ 주소의 [YOUR-PASSWORD] 부분을 실제 DB 비밀번호로 바꿔 주세요.");
  return url;
}

function dbConfig(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    stop("❌ SUPABASE_DB_URL을 주소로 읽을 수 없어요. postgresql:// 로 시작하는 Session pooler URI 전체를 붙여 넣어 주세요.");
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) stop("❌ SUPABASE_DB_URL은 postgresql:// 로 시작해야 해요.");
  const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
  // 주소 속 sslmode 등은 빼고 아래 ssl 설정을 써요 (Supabase 인증서 체인 때문에 연결이 막히지 않게)
  for (const k of [...u.searchParams.keys()]) if (/^ssl/i.test(k)) u.searchParams.delete(k);
  secrets = [url, u.toString(), u.host, u.hostname, u.password, dec(u.password), u.username, dec(u.username)]
    .filter((s) => s && s.length > 3 && s !== "postgres")
    .sort((a, b) => b.length - a.length);
  // 값은 Postgres 글자 그대로 받아요 (시각·큰 숫자가 바뀌지 않게)
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: false }, types: { getTypeParser: () => (v) => v } };
}

function connectHint(e) {
  const m = String(e.message);
  if (e.code === "28P01" || /password authentication failed/i.test(m)) return "DB 비밀번호가 틀렸어요. Supabase → Database → Settings에서 다시 정할 수 있어요(사이트는 이 비밀번호를 쓰지 않아 영향 없어요).";
  if (/tenant or user not found/i.test(m)) return "주소의 사용자 이름(postgres.프로젝트ID)이나 지역이 틀렸어요. Session pooler URI를 그대로 다시 복사해 주세요.";
  if (e.code === "ENOTFOUND" || e.code === "EAI_AGAIN") return "서버 주소를 찾지 못했어요. 인터넷 연결과 주소를 확인해 주세요.";
  if (["ETIMEDOUT", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH"].includes(e.code)) return "서버에 닿지 못했어요. 'Direct connection' 주소라면 'Session pooler' 주소로 바꿔 주세요.";
  return "주소를 다시 확인해 주세요. 비밀번호에 @ # / ? 같은 특수문자가 있으면 특수문자 없는 비밀번호로 바꾸는 게 쉬워요.";
}

async function connect() {
  const db = new pg.Client(dbConfig(readDbUrl()));
  db.on("notice", (n) => log(`  📢 ${n.message}`));
  db.on("error", (e) => log(`⚠️ 연결이 끊겼어요: ${e.message}`));
  try {
    await db.connect();
  } catch (e) {
    stop(`❌ DB에 연결하지 못했어요: ${e.message}\n   → ${connectHint(e)}`);
  }
  return db;
}

// ── 접속 확인 (읽기 전용) ──
const unknown = args.filter((a) => a.startsWith("-") && !FLAGS.includes(a));
if (unknown.length) stop(`❌ 모르는 옵션: ${unknown.join(" ")}\n\n${USAGE}`);

if (flag("--check")) {
  const db = await connect();
  try {
    await db.query("begin read only");
    const ver = (await db.query("show server_version")).rows[0].server_version;
    const n = (await db.query("select count(*) from public.applications")).rows[0].count;
    log(`✅ 접속 성공 (Postgres ${ver}) · 읽기 전용 테스트: public.applications ${n}행`);
  } catch (e) {
    log(`❌ 접속은 됐지만 읽기 테스트 실패: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await db.query("rollback").catch(() => {});
    await db.end().catch(() => {});
  }
  process.exit();
}

// ── 파일 읽기 · 보여주기 ──
const paths = args.filter((a) => !a.startsWith("-"));
if (paths.length !== 1) stop(`❌ 실행할 SQL 파일을 하나만 적어 주세요.\n\n${USAGE}`);
const abs = resolve(process.cwd(), paths[0]);
const rel = relative(ROOT, abs).split(sep).join("/");
if (!abs.startsWith(SUPABASE_DIR + sep) || !abs.endsWith(".sql")) stop(`❌ supabase/ 폴더의 .sql 파일만 실행해요: ${paths[0]}`);
if (!existsSync(abs)) stop(`❌ 파일이 없어요: ${rel}`);

const sql = readFileSync(abs, "utf8");
const lines = sql.replace(/\r?\n$/, "").split(/\r?\n/);
const w = String(lines.length).length;
log(`📄 ${rel} (${lines.length}줄)`);
log("─".repeat(60));
lines.forEach((l, k) => log(`${String(k + 1).padStart(w)} │ ${l}`));
log("─".repeat(60));

// ── 살펴보기: begin/commit, 지우는 문장, UPDATE, 이미 실행한 파일 ──
const { code, bare } = mask(sql);
const stmts = statements(bare);
const txCtl = stmts.filter((s) => /^(begin|start\s+transaction|commit|end)\b/i.test(s.text));
const aborts = stmts.filter((s) => /^(rollback|abort)\b/i.test(s.text));
const toRun = stmts.filter((s) => !txCtl.includes(s));
// grant/revoke(권한 주기·빼기) 문장의 delete·update는 데이터를 지우거나 바꾸지 않아서 빼요
const isGrant = (at) => /^(grant|revoke|alter\s+default\s+privileges)\b/i.test(stmts.find((s) => s.from <= at && at < s.to)?.text ?? "");
const hits = (re) => [...code.matchAll(re)].filter((m) => !isGrant(m.index)).map((m) => ({ word: m[1].toUpperCase(), line: lineAt(code, m.index) }));
const danger = hits(/(?<!\bon\s+)\b(drop|delete|truncate)\b/gi); // on delete cascade 같은 외래키 규칙은 빼요
const updates = hits(/(?<!\b(?:on|for)\s+)\b(update)\b/gi);
const name = basename(abs);
const applied = existsSync(APPLIED) && readFileSync(APPLIED, "utf8").split("\n").some((l) => l.startsWith(`| \`${name}\` |`));

// 보낼 SQL: begin/commit 자리만 빈칸으로 (글자 위치는 원본과 같아요)
let run = sql;
for (const s of txCtl) run = run.slice(0, s.from) + run.slice(s.from, s.to).replace(/[^\n]/g, " ") + run.slice(s.to);

log(`실행할 문장 ${toRun.length}개`);
if (txCtl.length) log(`↪ 파일 안의 begin/commit ${txCtl.length}개는 빼고, 파일 전체를 트랜잭션 하나로 실행해요(중간에 실패하면 전부 되돌려요).`);
if (danger.length) {
  log("🔴 지우는 문장이 있어요 (drop / delete / truncate):");
  for (const h of danger) log(`   ${h.line}줄 · ${h.word} · ${cut(lines[h.line - 1].trim(), 80)}`);
}
if (updates.length) log(`ℹ️ 기존 행을 바꾸는 UPDATE: ${[...new Set(updates.map((h) => h.line + "줄"))].join(", ")}`);
if (applied) log(`ℹ️ supabase/APPLIED.md에 이미 실행 완료로 적힌 파일이에요.`);

const refuse = [];
if (aborts.length) refuse.push(`파일 안에 rollback이 있어요(${aborts.map((s) => lineAt(bare, s.from) + "줄").join(", ")}). 트랜잭션은 이 스크립트가 맡으니 그 줄을 지워 주세요.`);
if (!toRun.length) refuse.push("실행할 SQL 문장이 없어요.");
if (!DRY && danger.length && !flag("--confirm"))
  refuse.push(`drop / delete / truncate(alter … drop 포함)가 있어서 --confirm 없이는 실행하지 않아요.
     영향 받는 행 수 미리 보기: npm run sql -- ${rel} --dry
     Vella쌤이 '실행해'라고 하면: npm run sql -- ${rel} --confirm`);
if (!DRY && applied && !flag("--again")) refuse.push(`이미 실행한 파일이라 다시 실행하지 않아요. 정말 다시 실행하려면 --again`);
if (refuse.length) stop(`\n⛔ 실행하지 않았어요:\n${refuse.map((r) => `  · ${r}`).join("\n")}`);

// ── 실행 ──
const KIND = { INSERT: "추가", UPDATE: "바뀜", DELETE: "지움", MERGE: "합침" };

function printTable(r) {
  const fmt = (v) => cut(v === null || v === undefined ? "NULL" : String(v).replace(/\s+/g, " "));
  log(`    ${r.fields.map((f) => f.name).join(" │ ")}`);
  for (const row of r.rows.slice(0, 50)) log(`    ${row.map(fmt).join(" │ ")}`);
  if (r.rows.length > 50) log(`    … ${r.rows.length - 50}행 더`);
}

function printResults(results) {
  const total = {};
  results.forEach((r, k) => {
    const s = results.length === toRun.length ? toRun[k] : null;
    const where = s ? `${lineAt(sql, s.from)}줄 ${cut(sql.slice(s.from).split(/\r?\n/)[0].trim())}` : `${k + 1}번째 문장`;
    const cmd = r.command ?? "";
    if (r.fields?.length) {
      log(`• ${where} → ${r.rowCount ?? r.rows.length}행`);
      printTable(r);
    } else if (KIND[cmd]) {
      total[cmd] = (total[cmd] ?? 0) + r.rowCount;
      log(`• ${where} → ${cmd} ${r.rowCount}행 ${KIND[cmd]}`);
    } else log(`• ${where} → ${cmd || "완료"} ✓`);
  });
  const sum = Object.entries(total).map(([c, n]) => `${KIND[c]} ${n}행`).join(" · ");
  log(`바뀐 행 합계: ${sum || "없음"}`);
}

function record() {
  if (applied) return log("📝 APPLIED.md에는 이미 있어서 기록은 그대로예요.");
  try {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
    const desc = (lines.find((l) => /^\s*--\s*\S/.test(l)) ?? "").replace(/^\s*--\s*/, "").replace(/\|/g, "/").trim();
    const md = readFileSync(APPLIED, "utf8").split("\n");
    const head = md.findIndex((l) => /^\|\s*파일\s*\|/.test(l));
    let at = head < 0 ? md.length - 1 : head;
    while (head >= 0 && at + 1 < md.length && md[at + 1].startsWith("|")) at++;
    md.splice(at + 1, 0, `| \`${name}\` | 완료 · ${today} · npm run sql | ${desc || "(내용 적기)"} |`);
    writeFileSync(APPLIED, md.join("\n"));
    log(`📝 supabase/APPLIED.md에 기록했어요: ${name} · ${today}`);
  } catch (e) {
    log(`⚠️ DB 실행은 성공했지만 APPLIED.md 기록은 실패했어요: ${e.message}`);
  }
}

const db = await connect();
try {
  await db.query("begin");
  // 사이트가 쓰는 표가 잠겨 있으면 오래 기다리지 않고 실패(→ 전부 되돌림)해요
  await db.query("set local lock_timeout = '10s'");
  const res = await db.query({ text: run, rowMode: "array" });
  log(`\n${DRY ? "🧪 연습 실행 결과 (DB에는 반영 안 해요)" : "▶ 실행 결과"}`);
  printResults(Array.isArray(res) ? res : [res]);
  if (DRY) {
    await db.query("rollback");
    log("\n🧪 연습 실행이라 전부 되돌렸어요. DB는 그대로예요. (APPLIED.md 기록 안 함)");
  } else {
    await db.query("commit");
    log("\n✅ 실행 완료: 모두 DB에 반영했어요.");
    await db.query("notify pgrst, 'reload schema'").catch(() => {}); // 사이트 API가 바뀐 표 구조를 바로 알게
    record();
  }
} catch (e) {
  await db.query("rollback").catch(() => {});
  const at = e.position ? ` (${lineAt(run, Number(e.position) - 1)}줄 근처)` : "";
  log(`\n❌ 실행 실패${at}: ${e.message}`);
  if (e.detail) log(`   자세히: ${e.detail}`);
  if (e.hint) log(`   힌트: ${e.hint}`);
  if (e.where) log(`   위치: ${e.where}`);
  if (e.code === "55P03") log("   → 사이트가 그 표를 쓰는 중이라 잠금을 못 얻었어요. 잠시 뒤 다시 실행해 주세요.");
  log("↩️ 전부 되돌렸어요. DB는 실행 전 그대로예요.");
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
