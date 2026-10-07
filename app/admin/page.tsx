import { BOOKS, COURSES, KINDS, TRACKS, TIME_SLOTS, bookStatusLabel, cohortLabel, won, type CourseId, type TimeSlot, type Track } from "@/lib/config";
import { listApplications, listDepositEvents, listMissions, getSetting, currentCohort, roundFor, isPreview, type Application, type Mission } from "@/lib/db";
import { missionCount } from "@/lib/mission";
import { isAdmin } from "@/lib/auth";
import { changeStatus, saveSettings, resetPin, changeClass, changeSlot, removeApplication, bulkChangeClass, bulkChangeSlot, bulkConfirmPayment, bulkMarkBooksDone, bulkRemove, resolveBookDepositEvent } from "@/app/actions";
import LoginForm from "./LoginForm";
import AdminTabs from "./AdminTabs";
import CloseOnSubmitForm from "./CloseOnSubmitForm";
import SelectAll from "./SelectAll";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

type Filters = { k: string; p: string; b: string; t: string; q: string; c: string };

const KIND_FILTERS = [["all", "전체"], ["onsite", "현장"], ["online", "불라방"]] as const;
const PAY_FILTERS = [["all", "전체"], ["pending", "미납"], ["paid", "납부 완료"], ["refunded", "환불"]] as const;
const TIME_FILTERS = [["all", "전체"], ["am", "오전반"], ["pm", "저녁반"]] as const;
const isPaid = (a: Application) => a.status === "paid" || a.status === "shipped";
const SLOT_ORDER: (TimeSlot | null)[] = ["am", "pm", null];
const BOOK_FILTERS = [["all", "전체"], ["todo", "수령·발송 대기"], ["done", "수령·발송 완료"]] as const;

const bookTodo = (a: Application) => a.kind === "online" && a.status === "paid";

function Badge({ tone, children }: { tone: "amber" | "sky" | "slate" | "green"; children: React.ReactNode }) {
  const color = {
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-main/50 text-sky-ink",
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-100 text-emerald-700",
  }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${color}`}>{children}</span>;
}

function Row({ a, group, mission }: { a: Application; group: string; mission?: Mission }) {
  const book = bookStatusLabel(a);
  return (
    <li className={`py-3 ${a.status === "pending" ? "bg-amber-50/60" : ""}`}>
      <div className="flex items-start gap-3 px-2">
        <input type="checkbox" form="bulk" name="ids" value={a.id} data-group={group} aria-label={`${a.name} 선택`} className="mt-1 h-5 w-5 shrink-0 accent-sky-deep" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <b className="text-sky-ink">{a.name}</b>
            {a.depositor !== a.name && <span className="text-sm text-slate-500">(입금자 {a.depositor})</span>}
            <Badge tone={a.kind === "onsite" ? "slate" : "sky"}>{KINDS[a.kind].short}{a.kind === "online" ? ` · ${a.pickup === "delivery" ? "택배" : "1층 데스크"}` : ""}</Badge>
            <Badge tone={a.status === "pending" ? "amber" : a.status === "refunded" ? "slate" : "green"}>{a.status === "pending" ? "미납" : a.status === "refunded" ? "환불" : "납부 완료"}</Badge>
            {a.kind === "online" && <Badge tone={a.status === "shipped" ? "green" : a.status === "paid" ? "amber" : "slate"}>교재 {book}</Badge>}
            {a.continuing && <Badge tone="slate">이어듣기</Badge>}
            <Badge tone={missionCount(mission) === 4 ? "green" : "slate"}>미션 {missionCount(mission)}/4</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {won(a.amount)} · {a.books.map((b) => BOOKS[b]).join(", ")}
            {a.phone && ` · ${a.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3")}`}
            {a.address && ` · ${a.address}`}
            {a.pickup_date && ` · 데스크 수령 ${a.pickup_date.slice(5).replace("-", "/")} ${a.pickup_time ?? ""}`}
            {" · "}{new Date(a.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" })} 신청
          </p>
          {mission?.intro_at && (
            <p className="mt-1 rounded-xl bg-sky-soft px-2.5 py-1.5 text-xs text-slate-600">
              📝 {mission.prev_score} → 목표 {mission.target_score} · 시험 {mission.exam_month}
              {mission.affiliation && ` · ${mission.affiliation}`}
              {mission.instagram && ` · ${mission.instagram}`}
              {mission.message && <span className="block text-sky-ink">“{mission.message}”</span>}
            </p>
          )}
        </div>
        <details className="shrink-0 text-right text-sm">
          <summary className="cursor-pointer list-none rounded-full bg-sky-soft px-3 py-1 font-bold text-sky-ink">관리</summary>
          <div className="mt-2 flex flex-col items-end gap-2">
            <CloseOnSubmitForm action={changeStatus} className="flex flex-wrap justify-end gap-2">
              <input type="hidden" name="id" value={a.id} />
              {a.status === "pending" && <button name="status" value="paid" className="btn !px-4 !py-1.5 !text-sm">납부 확인</button>}
              {a.status === "paid" && a.kind === "online" && (
                <button name="status" value="shipped" className="btn !px-4 !py-1.5 !text-sm">{a.pickup === "delivery" ? "발송 완료" : "수령 완료"}</button>
              )}
              {isPaid(a) && (
                <button name="status" value={a.status === "shipped" ? "paid" : "pending"} className="btn-ghost !py-1.5 text-sm">
                  {a.status === "shipped" ? "교재 상태 되돌리기" : "미납으로 되돌리기"}
                </button>
              )}
              {a.status === "refunded" && <button name="status" value="paid" className="btn-ghost !py-1.5 text-sm">환불 취소 (납부 완료로)</button>}
            </CloseOnSubmitForm>
            {a.status !== "refunded" && (
              <details className="text-sm">
                <summary className="cursor-pointer text-amber-600">환불 처리</summary>
                <CloseOnSubmitForm action={changeStatus} className="mt-1">
                  <input type="hidden" name="id" value={a.id} />
                  <button name="status" value="refunded" className="rounded-xl bg-amber-50 px-3 py-1.5 font-bold text-amber-700">환불로 바꾸기 (강의실 로그인이 막혀요 · 출석·납부 기록은 남아요)</button>
                </CloseOnSubmitForm>
              </details>
            )}
            <CloseOnSubmitForm action={changeSlot} className="flex items-center gap-2">
              <input type="hidden" name="id" value={a.id} />
              <select name="slot" defaultValue={a.slot ?? ""} required className="input !w-32 !py-1.5 text-sm">
                {!a.slot && <option value="" disabled>시간 선택</option>}
                <option value="am">오전반</option>
                <option value="pm">저녁반</option>
              </select>
              <button className="btn-ghost !py-1.5 text-sm">시간 저장</button>
            </CloseOnSubmitForm>
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500">반 변경</summary>
              <CloseOnSubmitForm action={changeClass} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={a.id} />
                <select name="class" defaultValue={`${a.course}:${a.track}`} className="input !w-56 !py-2">
                  {a.track === "alt" && (
                    <option value={`${a.course}:alt`}>
                      {COURSES[a.course].label} {TRACKS.alt}
                    </option>
                  )}
                  {(Object.keys(COURSES) as CourseId[]).flatMap((co) =>
                    COURSES[co].tracks.map((t) => (
                      <option key={co + t} value={`${co}:${t}`}>
                        {COURSES[co].label} {TRACKS[t]}
                      </option>
                    )),
                  )}
                </select>
                <button className="btn-ghost !py-2">저장</button>
              </CloseOnSubmitForm>
            </details>
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500">비밀번호 변경</summary>
              <CloseOnSubmitForm action={resetPin} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={a.id} />
                <input name="pin" placeholder="새 4자리" inputMode="numeric" maxLength={4} className="input !w-28 !py-2" />
                <button className="btn-ghost !py-2">저장</button>
              </CloseOnSubmitForm>
            </details>
            <details className="text-sm">
              <summary className="cursor-pointer text-red-400">삭제</summary>
              <CloseOnSubmitForm action={removeApplication} className="mt-2">
                <input type="hidden" name="id" value={a.id} />
                <button className="rounded-xl bg-red-50 px-3 py-2 font-bold text-red-600">정말 삭제 (되돌릴 수 없어요)</button>
              </CloseOnSubmitForm>
            </details>
          </div>
        </details>
      </div>
    </li>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<Partial<Filters>> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;

  const now = await currentCohort();
  const { k = "all", p = "all", b = "all", t = "all", q = "", c = now } = await searchParams;
  const everything = await listApplications();
  const [account, cafeHomeworkUrl, cafeUrl, blogUrl] = await Promise.all([
    getSetting("bank_account"),
    getSetting("cafe_homework_url"),
    getSetting("cafe_url"),
    getSetting("blog_url"),
  ]);
  const round = await roundFor(now);
  // 이번 모집 기수에서 아직 입금 확인이 안 된 학생 (수업 전에 확인해야 라이브·강의가 열려요)
  const waiting = everything.filter((a) => a.cohort === now && a.status === "pending").sort((a, b) => a.created_at.localeCompare(b.created_at));
  // 자동으로 확정하지 못한 교재비 입금 문자 (같은 입금자명이 여러 명이거나 금액이 다를 때)
  const bookChecks = (await listDepositEvents(50)).filter((e) => e.target === "book" && (e.result === "review" || e.result === "unmatched"));
  const pendingAll = everything.filter((a) => a.status === "pending");
  // 수강 시간이 아직 비어 있는 학생 (예전 신청). 오전/저녁을 정해 주세요.
  const unslotted = everything.filter((a) => a.cohort === now && !a.slot && a.status !== "refunded").sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const cohorts = [...new Set([now, ...everything.map((a) => a.cohort)])].sort().reverse();
  const all = c === "all" ? everything : everything.filter((a) => a.cohort === c);

  const list = all.filter((a) => {
    if (k !== "all" && a.kind !== k) return false;
    if (p === "pending" && a.status !== "pending") return false;
    if (p === "paid" && !isPaid(a)) return false;
    if (p === "refunded" && a.status !== "refunded") return false;
    if (t !== "all" && a.slot !== t) return false;
    if (b === "todo" && !bookTodo(a)) return false;
    if (b === "done" && !(a.kind === "online" && a.status === "shipped")) return false;
    if (q && !`${a.name} ${a.depositor} ${a.phone ?? ""}`.includes(q)) return false;
    return true;
  });

  const count = (fn: (a: Application) => boolean) => all.filter(fn).length;
  const missions = new Map((await listMissions(list.map((a) => a.id))).map((m) => [m.app_id, m]));
  const link = (patch: Partial<Filters>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ c, k, p, b, t, q, ...patch })) {
      if (value && (value !== "all" || key === "c")) params.set(key, value);
    }
    return `/admin?${params}`;
  };

  // 반 → 시간(오전·저녁·미정) 순서로 묶어요.
  const groups = (Object.keys(COURSES) as CourseId[]).flatMap((co) =>
    (Object.keys(TRACKS) as Track[]).flatMap((tr) =>
      SLOT_ORDER.map((slot) => {
        const items = list
          .filter((a) => a.course === co && a.track === tr && (a.slot ?? null) === slot)
          .sort((x, y) => Number(y.status === "pending") - Number(x.status === "pending") || x.kind.localeCompare(y.kind) || x.name.localeCompare(y.name, "ko"));
        return { key: `${co}-${tr}-${slot ?? "none"}`, title: `${COURSES[co].label} ${TRACKS[tr]}`, slot, items };
      }),
    ).filter((g) => g.items.length > 0),
  );

  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm font-bold ${on ? "bg-sky-deep text-white" : "bg-white text-sky-ink"}`;

  return (
    <div className="space-y-5 pt-8">
      <AdminTabs active="apps" />

      {waiting.length > 0 && (
        <CloseOnSubmitForm action={bulkConfirmPayment} className="block rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
          <p className="font-jua text-2xl text-amber-700">⚠️ 수업 전 입금 대기 {waiting.length}명</p>
          <p className="mt-1 text-sm text-slate-600">입금 문자 자동 확인이 켜져 있으면 입금자명·금액이 맞는 학생은 자동으로 납부 확인돼요. 남은 학생은 통장과 맞춰 보고 체크한 뒤 [납부 확인]을 눌러 주세요.</p>
          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-sky-ink"><SelectAll group="pending-alert" /> {waiting.length}명 전체 선택</label>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {waiting.map((a) => (
              <li key={a.id}>
                <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                  <input type="checkbox" name="ids" value={a.id} data-group="pending-alert" className="h-4 w-4 accent-sky-deep" />
                  <b className="text-sky-ink">{a.name}</b>
                  {a.depositor !== a.name && <span className="text-slate-500">(입금자 {a.depositor})</span>}
                  <span className="ml-auto text-slate-600">{won(a.amount)}</span>
                </label>
              </li>
            ))}
          </ul>
          <button className="btn mt-3 w-full !py-3 !text-base">체크한 학생 납부 확인</button>
        </CloseOnSubmitForm>
      )}

      {bookChecks.length > 0 && (
        <section className="rounded-3xl border-2 border-red-200 bg-red-50 p-5">
          <p className="font-jua text-xl text-red-600">⚠️ 교재비 입금 문자 확인 필요 {bookChecks.length}건</p>
          <p className="mt-1 text-sm text-slate-600">입금자명이 같은 학생이 여러 명이거나 금액이 달라서 자동으로 확정하지 못했어요. 맞는 학생을 골라 [처리]하거나, 관계없으면 무시해 주세요.</p>
          <ul className="mt-3 space-y-2">
            {bookChecks.map((e) => (
              <li key={e.id} className="rounded-2xl bg-white p-3 text-sm">
                <p><b className="text-sky-ink">{e.name}</b> · {won(e.amount)} · {new Date(e.received_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                <CloseOnSubmitForm action={resolveBookDepositEvent} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="event_id" value={e.id} />
                  <select name="application_id" className="input !w-auto min-w-0 flex-1 !py-2">
                    <option value="">관계없는 입금 (무시)</option>
                    {[...pendingAll]
                      .sort((x, y) => Number(y.depositor === e.name) - Number(x.depositor === e.name))
                      .map((a) => <option key={a.id} value={a.id}>{a.depositor}{a.depositor !== a.name ? ` (${a.name})` : ""} · {won(a.amount)} · {COURSES[a.course].label} {TRACKS[a.track]}</option>)}
                  </select>
                  <button className="btn !py-2 !text-sm">처리</button>
                </CloseOnSubmitForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unslotted.length > 0 && (
        <CloseOnSubmitForm action={bulkChangeSlot} className="block rounded-3xl border-2 border-sky-main bg-white p-5">
          <p className="font-jua text-xl text-sky-ink">🕒 수강 시간을 정해야 하는 학생 {unslotted.length}명</p>
          <p className="mt-1 text-sm text-slate-600">예전에 신청해서 오전/저녁이 비어 있어요. 체크한 뒤 오전반 또는 저녁반을 눌러 주세요.</p>
          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-sky-ink"><SelectAll group="unslotted" /> {unslotted.length}명 전체 선택</label>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {unslotted.map((a) => (
              <li key={a.id}>
                <label className="flex items-center gap-2 rounded-xl bg-sky-soft px-3 py-2 text-sm">
                  <input type="checkbox" name="ids" value={a.id} data-group="unslotted" className="h-4 w-4 accent-sky-deep" />
                  <b className="text-sky-ink">{a.name}</b>
                  <span className="text-slate-500">{KINDS[a.kind].short} · {COURSES[a.course].label} {TRACKS[a.track]}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button name="slot" value="am" className="btn !py-2.5 !text-base">☀️ 오전반으로</button>
            <button name="slot" value="pm" className="btn !py-2.5 !text-base">🌙 저녁반으로</button>
          </div>
        </CloseOnSubmitForm>
      )}

      <details className="card !p-4">
        <summary className="font-jua cursor-pointer text-lg text-sky-ink">⚙️ 기본 설정 (모집 기수 · 계좌 · 카페·블로그 주소)</summary>
        <div className="mt-4">
          <CloseOnSubmitForm action={saveSettings} className="card grid gap-4 sm:grid-cols-[10rem_7rem_1fr_auto] sm:items-end">
          <label>
            <span className="label">현재 모집 기수</span>
            <input type="month" name="current_cohort" defaultValue={now} className="input" />
          </label>
          <label>
            <span className="label">교재 회차</span>
            <select name="round" defaultValue={String(round)} className="input">
              <option value="1">1회차</option>
              <option value="2">2회차</option>
            </select>
          </label>
          <label>
            <span className="label">학생에게 보여줄 입금 계좌</span>
            <input name="bank_account" defaultValue={account} className="input" placeholder="예: OO은행 000-0000-0000 (예금주)" />
          </label>
          <label className="sm:col-span-4">
            <span className="label">첫 수업 미션 · 네이버 카페 주소 <span className="font-normal text-slate-400">(비우면 숙제 게시판 주소)</span></span>
            <input type="url" name="cafe_url" defaultValue={cafeUrl} className="input" placeholder="https://cafe.naver.com/..." />
          </label>
          <label className="sm:col-span-4">
            <span className="label">첫 수업 미션 · 블로그 주소 <span className="font-normal text-slate-400">(비우면 blog.naver.com/vella_toeic)</span></span>
            <input type="url" name="blog_url" defaultValue={blogUrl} className="input" placeholder="https://blog.naver.com/..." />
          </label>
          <label className="sm:col-span-3">
            <span className="label">네이버 카페 숙제 게시판 주소</span>
            <input type="url" name="cafe_homework_url" defaultValue={cafeHomeworkUrl} className="input" placeholder="https://cafe.naver.com/..." />
          </label>
          <button className="btn !py-3">저장</button>
          <p className="text-xs text-slate-500 sm:col-span-3">
            새로 들어오는 신청은 &apos;현재 모집 기수&apos;로 저장돼요.<br />다음 달 모집을 시작할 때 바꿔 주세요.
          </p>
        </CloseOnSubmitForm>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        {[...cohorts, "all"].map((x) => (
          <a key={x} href={link({ c: x })} className={`rounded-full px-4 py-2 text-sm font-bold ${c === x ? "bg-sky-ink text-white" : "bg-white text-sky-ink"}`}>
            {x === "all" ? "전체 기수" : cohortLabel(x)}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "전체 신청", value: `${all.length}명`, sub: `현장 ${count((a) => a.kind === "onsite")} · 불라방 ${count((a) => a.kind === "online")}`, href: link({ k: "all", p: "all", b: "all" }) },
          { label: "미납", value: `${count((a) => a.status === "pending")}명`, sub: "눌러서 미납만 보기", href: link({ p: "pending", b: "all" }), warn: true },
          { label: "납부 완료", value: `${count(isPaid)}명`, sub: won(all.filter(isPaid).reduce((s, a) => s + a.amount, 0)), href: link({ p: "paid" }) },
          { label: "불라방 교재 대기", value: `${count(bookTodo)}명`, sub: `데스크 ${count((a) => bookTodo(a) && a.pickup === "classroom")} · 택배 ${count((a) => bookTodo(a) && a.pickup === "delivery")}`, href: link({ k: "online", p: "all", b: "todo" }) },
          { label: "불라방 교재 완료", value: `${count((a) => a.kind === "online" && a.status === "shipped")}명`, sub: "수령·발송 완료", href: link({ k: "online", p: "all", b: "done" }) },
        ].map((s) => (
          <a key={s.label} href={s.href} className="card !p-4 text-center transition hover:ring-2 hover:ring-sky-main">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`font-jua mt-1 text-2xl ${s.warn ? "text-amber-600" : "text-sky-ink"}`}>{s.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{s.sub}</p>
          </a>
        ))}
      </div>

      <div className="card space-y-2 !p-4 text-sm">
        {[
          { name: "수강 형태", key: "k" as const, value: k, items: KIND_FILTERS },
          { name: "수강 시간", key: "t" as const, value: t, items: TIME_FILTERS },
          { name: "납부", key: "p" as const, value: p, items: PAY_FILTERS },
          { name: "불라방 교재", key: "b" as const, value: b, items: BOOK_FILTERS },
        ].map((row) => (
          <div key={row.key} className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 font-bold text-slate-500">{row.name}</span>
            {row.items.map(([v, label]) => <a key={v} href={link({ [row.key]: v })} className={chip(row.value === v)}>{label}</a>)}
          </div>
        ))}
        <form className="flex items-center gap-2 pt-1">
          <span className="w-20 shrink-0 font-bold text-slate-500">검색</span>
          <input type="hidden" name="c" value={c} />
          {k !== "all" && <input type="hidden" name="k" value={k} />}
          {p !== "all" && <input type="hidden" name="p" value={p} />}
          {b !== "all" && <input type="hidden" name="b" value={b} />}
          {t !== "all" && <input type="hidden" name="t" value={t} />}
          <input name="q" defaultValue={q} placeholder="이름·입금자·번호" className="input !w-48 !py-2 text-sm" />
          {q && <a href={link({ q: "" })} className="text-slate-400 underline">지우기</a>}
        </form>
      </div>

      {list.length === 0 && <p className="card text-center text-slate-500">해당하는 신청이 없어요.</p>}

      {list.length > 0 && (
        <CloseOnSubmitForm id="bulk" action={bulkConfirmPayment} className="card sticky top-2 z-10 flex flex-wrap items-center gap-2 !p-3 text-sm shadow-md">
          <label className="flex items-center gap-2 font-bold text-sky-ink">
            <SelectAll group="*" /> 보이는 {list.length}명 전체 선택
          </label>
          <span className="mx-1 h-5 w-px bg-sky-main" />
          <button className="btn !py-2 !text-sm">선택 납부 확인</button>
          <button formAction={bulkMarkBooksDone} className="btn !py-2 !text-sm">선택 교재 수령·발송 완료</button>
          <details className="relative">
            <summary className="btn-ghost cursor-pointer list-none !py-2 text-sm">반 변경</summary>
            <div className="absolute left-0 z-20 mt-1 flex gap-2 rounded-2xl bg-white p-3 shadow-lg">
              <select name="class" className="input !w-52 !py-2">
                {(Object.keys(COURSES) as CourseId[]).flatMap((co) =>
                  COURSES[co].tracks.map((t) => (
                    <option key={co + t} value={`${co}:${t}`}>{COURSES[co].label} {TRACKS[t]}</option>
                  )),
                )}
              </select>
              <button formAction={bulkChangeClass} className="btn-ghost whitespace-nowrap !py-2">변경</button>
            </div>
          </details>
          <details className="relative">
            <summary className="btn-ghost cursor-pointer list-none !py-2 text-sm">시간 변경</summary>
            <div className="absolute left-0 z-20 mt-1 flex gap-2 rounded-2xl bg-white p-3 shadow-lg">
              <select name="slot" className="input !w-36 !py-2">
                <option value="am">오전반</option>
                <option value="pm">저녁반</option>
                
              </select>
              <button formAction={bulkChangeSlot} className="btn-ghost whitespace-nowrap !py-2">변경</button>
            </div>
          </details>
          <details className="relative ml-auto">
            <summary className="cursor-pointer list-none text-red-400">선택 삭제</summary>
            <button formAction={bulkRemove} className="absolute right-0 z-20 mt-1 whitespace-nowrap rounded-xl bg-red-50 px-3 py-2 font-bold text-red-600 shadow-lg">
              체크한 신청 모두 삭제 (되돌릴 수 없어요)
            </button>
          </details>
          <p className="w-full text-xs text-slate-500">납부 확인은 미납 학생만, 교재 완료는 납부 완료된 불라방 학생만 바뀌어요.</p>
        </CloseOnSubmitForm>
      )}

      {groups.map((g) => {
        const pending = g.items.filter((a) => a.status === "pending").length;
        const onsite = g.items.filter((a) => a.kind === "onsite").length;
        return (
          <section key={g.key} className="card !p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-sky-main pb-2">
              <label className="flex items-center gap-2">
                <SelectAll group={g.key} />
                <h3 className="font-jua text-xl text-sky-ink">
                  {g.title} · <span className={g.slot ? "" : "text-amber-600"}>{g.slot ? TIME_SLOTS[g.slot] : "시간 미정"}</span>
                </h3>
              </label>
              <span className="text-sm text-slate-500">{g.items.length}명 · 현장 {onsite} · 불라방 {g.items.length - onsite}</span>
              {pending > 0 && <Badge tone="amber">미납 {pending}명</Badge>}
            </div>
            <ul className="divide-y divide-sky-soft">
              {g.items.map((a) => <Row key={a.id} a={a} group={g.key} mission={missions.get(a.id)} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
