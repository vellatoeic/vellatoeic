import { COURSES, KINDS, TRACKS, STATUS_LABEL, cohortLabel, pickupLabel, won, type Kind, type CourseId, type Track } from "@/lib/config";
import { listApplications, getSetting, currentCohort, isPreview } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { changeStatus, saveSettings, resetPin, changeClass } from "@/app/actions";
import LoginForm from "./LoginForm";
import AdminTabs from "./AdminTabs";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "입금 대기" },
  { key: "ship", label: "발송 대기" },
  { key: "onsite", label: "현장" },
  { key: "online", label: "불라방" },
] as const;

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string; c?: string }>;
}) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;

  const now = await currentCohort();
  const { f = "all", q = "", c = now } = await searchParams;
  const everything = await listApplications();
  const account = await getSetting("bank_account");
  const cohorts = [...new Set([now, ...everything.map((a) => a.cohort)])].sort().reverse();
  const all = c === "all" ? everything : everything.filter((a) => a.cohort === c);

  const list = all.filter((a) => {
    if (f === "pending" && a.status !== "pending") return false;
    if (f === "ship" && !(a.pickup === "delivery" && a.status === "paid")) return false;
    if ((f === "onsite" || f === "online") && a.kind !== (f as Kind)) return false;
    if (q && !`${a.name} ${a.depositor} ${a.phone ?? ""}`.includes(q)) return false;
    return true;
  });

  const stat = {
    total: all.length,
    pending: all.filter((a) => a.status === "pending").length,
    ship: all.filter((a) => a.pickup === "delivery" && a.status === "paid").length,
    paidSum: all.filter((a) => a.status !== "pending").reduce((s, a) => s + a.amount, 0),
  };
  const link = (p: Record<string, string>) =>
    "/admin?" + new URLSearchParams({ f, c, ...(q ? { q } : {}), ...p }).toString();

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="apps" />

      <form action={saveSettings} className="card grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <label>
          <span className="label">현재 모집 기수</span>
          <input type="month" name="current_cohort" defaultValue={now} className="input" />
        </label>
        <label>
          <span className="label">학생에게 보여줄 입금 계좌</span>
          <input name="bank_account" defaultValue={account} className="input" placeholder="예: OO은행 000-0000-0000 (예금주)" />
        </label>
        <button className="btn !py-3">저장</button>
        <p className="text-xs text-slate-500 sm:col-span-3">
          새로 들어오는 신청은 &apos;현재 모집 기수&apos;로 저장돼요. 다음 달 모집을 시작할 때 바꿔 주세요.
        </p>
      </form>

      <div className="flex flex-wrap gap-2">
        {[...cohorts, "all"].map((x) => (
          <a key={x} href={link({ c: x })} className={`rounded-full px-4 py-2 text-sm font-bold ${c === x ? "bg-sky-ink text-white" : "bg-white text-sky-ink"}`}>
            {x === "all" ? "전체 기수" : cohortLabel(x)}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["신청", `${stat.total}명`],
          ["입금 대기", `${stat.pending}명`],
          ["발송 대기", `${stat.ship}명`],
          ["납부 완료 합계", won(stat.paidSum)],
        ].map(([k, v]) => (
          <div key={k} className="card !p-4 text-center">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="font-jua mt-1 text-2xl text-sky-ink">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((x) => (
          <a key={x.key} href={link({ f: x.key })} className={`rounded-full px-4 py-2 text-sm font-bold ${f === x.key ? "bg-sky-deep text-white" : "bg-white text-sky-ink"}`}>
            {x.label}
          </a>
        ))}
        <form className="ml-auto">
          <input type="hidden" name="f" value={f} />
          <input type="hidden" name="c" value={c} />
          <input name="q" defaultValue={q} placeholder="이름·입금자·번호 검색" className="input !w-48 !py-2 text-sm" />
        </form>
      </div>

      {list.length === 0 && <p className="card text-center text-slate-500">해당하는 신청이 없어요.</p>}

      <ul className="space-y-3">
        {list.map((a) => (
          <li key={a.id} className="card !p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-sky-ink">
                  {a.name}
                  {a.depositor !== a.name && <span className="ml-2 text-sm font-normal text-slate-500">입금자 {a.depositor}</span>}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {KINDS[a.kind].short} · {COURSES[a.course].label} {TRACKS[a.track]} ·{" "}
                  {a.kind === "online" ? pickupLabel(a.kind, a.pickup) : "첫날 일괄 지급"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {[a.phone?.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3"), a.address].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {cohortLabel(a.cohort)} · {new Date(a.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-jua text-xl text-sky-ink">{won(a.amount)}</p>
                <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${a.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-sky-main/50 text-sky-ink"}`}>
                  {STATUS_LABEL[a.status]}
                </span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <form action={changeStatus} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={a.id} />
                {a.status === "pending" && <button name="status" value="paid" className="btn !px-5 !py-2 !text-base">납부 확인</button>}
                {a.status === "paid" && a.pickup === "delivery" && (
                  <button name="status" value="shipped" className="btn !px-5 !py-2 !text-base">발송 완료</button>
                )}
                {a.status !== "pending" && (
                  <button name="status" value={a.status === "shipped" ? "paid" : "pending"} className="btn-ghost !py-2 text-sm">
                    되돌리기
                  </button>
                )}
              </form>
              <details className="ml-auto text-sm">
                <summary className="cursor-pointer text-slate-500">반 변경</summary>
                <form action={changeClass} className="mt-2 flex gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <select name="class" defaultValue={`${a.course}:${a.track}`} className="input !w-44 !py-2">
                    {(Object.keys(COURSES) as CourseId[]).flatMap((co) =>
                      (Object.keys(TRACKS) as Track[]).map((t) => (
                        <option key={co + t} value={`${co}:${t}`}>
                          {COURSES[co].label} {TRACKS[t]}
                        </option>
                      )),
                    )}
                  </select>
                  <button className="btn-ghost !py-2">저장</button>
                </form>
              </details>
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-500">비밀번호 변경</summary>
                <form action={resetPin} className="mt-2 flex gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <input name="pin" placeholder="새 4자리" inputMode="numeric" maxLength={4} className="input !w-28 !py-2" />
                  <button className="btn-ghost !py-2">저장</button>
                </form>
              </details>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
