import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOKS, BOOK_PRICE, COURSES, KINDS, TRACKS, cohortLabel, thisMonthKST, won } from "@/lib/config";
import { isPreview, listApplications, listDepositEvents, listYbmOrders, roundFor } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { classBookOptions, linkCandidates } from "@/lib/manualLink";
import { movableCohorts } from "@/lib/cohortMove";
import { linkDepositManual } from "@/app/actions";
import AdminTabs from "../../AdminTabs";
import LoginForm from "../../LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "입금 학생 연결 · vella_toeic", robots: { index: false } };

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const statusText = (x: { status: string; cancel_reason?: string | null }) =>
  x.status === "pending" ? "입금 대기" : x.cancel_reason === "timeout" ? "자동 취소됨 (30분)" : "관리자 취소";

// 입금 기록 하나를 신청·인강 주문에 직접 연결해요 (이번 달·다음 달, 입금 대기 + 자동 취소 7일 안 + 관리자 취소)
export default async function LinkDeposit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; err?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { id } = await params;
  const sp = await searchParams;
  const event = (await listDepositEvents(500)).find((e) => e.id === id);
  if (!event) notFound();
  const q = (sp.q ?? event.name).trim();
  const [apps, orders] = await Promise.all([listApplications(), listYbmOrders()]);
  const found = linkCandidates(apps, orders, q, movableCohorts(thisMonthKST()));
  const rounds = new Map(await Promise.all([...new Set(found.apps.map((a) => a.cohort))].map(async (c) => [c, await roundFor(c)] as const)));
  const ConfirmForm = ({ kind, targetId, label, mode = "same" }: { kind: "app" | "ybm"; targetId: string; label: string; mode?: string }) => (
    <form action={linkDepositManual} className="inline">
      <input type="hidden" name="event_id" value={event.id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={targetId} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="q" value={q} />
      <button className={mode === "same" ? "btn !px-3 !py-1.5 !text-sm" : "btn-ghost !py-1.5 text-sm"}>{label}</button>
    </form>
  );

  return (
    <div className="space-y-5 pt-8">
      <AdminTabs active="apps" />
      <Link href="/admin" className="text-sm text-sky-deep underline">← 신청 관리로</Link>
      <section className="card space-y-1">
        <p className="font-jua text-2xl text-sky-ink">💳 입금 학생 연결</p>
        <p className="text-[15px]"><b className="text-sky-ink">{event.name || "(이름 못 읽음)"}</b> · <b>{won(event.amount)}</b> · <span className="text-slate-500">{when(event.received_at)}</span></p>
        <form className="flex items-center gap-2 pt-2">
          <input name="q" defaultValue={q} placeholder="이름·입금자명으로 찾기" className="input !w-52 !py-2" />
          <button className="btn-ghost !py-2 text-sm">찾기</button>
        </form>
        {sp.err && <p className="rounded-xl bg-red-50 p-2 text-sm font-bold text-red-600">{sp.err}</p>}
      </section>

      <section className="card space-y-2">
        <p className="font-jua text-lg text-sky-ink">수강 신청 ({found.apps.length})</p>
        {found.apps.length === 0 && <p className="text-sm text-slate-500">&apos;{q}&apos;과 같은 이름·입금자명의 신청이 없어요. 위에서 이름으로 찾아 보세요.</p>}
        {found.apps.map((a) => {
          const same = a.amount === event.amount;
          const options = classBookOptions(a, rounds.get(a.cohort) ?? 1);
          return (
            <div key={a.id} className="space-y-2 rounded-2xl bg-sky-soft p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <a href={`/admin/students/${a.id}`} className="font-bold text-sky-ink underline">{a.name}</a>
                {a.depositor !== a.name && <span className="text-slate-500">(입금자 {a.depositor})</span>}
                <span className="text-slate-500">{cohortLabel(a.cohort)} · {COURSES[a.course].label} {TRACKS[a.track]} · {KINDS[a.kind].short}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${a.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"}`}>{statusText(a)}</span>
              </p>
              <p className={same ? "text-slate-600" : "font-bold text-red-600"}>입금 {won(event.amount)} / 신청 {won(a.amount)} · {a.books.map((b) => BOOKS[b]).join(", ")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <ConfirmForm kind="app" targetId={a.id} label={same ? "이 신청으로 납부 확인" : "금액 그대로 확인"} />
                {!same && (
                  <details className="w-full">
                    <summary className="cursor-pointer font-bold text-sky-deep">교재 조정 후 확인 (산 교재만 고르기)</summary>
                    <form action={linkDepositManual} className="mt-2 space-y-2 rounded-xl bg-white p-3">
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="kind" value="app" />
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="mode" value="adjust" />
                      <input type="hidden" name="q" value={q} />
                      <div className="flex flex-wrap gap-3">
                        {options.map((b) => (
                          <label key={b} className="flex items-center gap-1.5"><input type="checkbox" name="book" value={b} defaultChecked={a.books.includes(b)} className="h-4 w-4 accent-sky-deep" />{BOOKS[b]} ({won(BOOK_PRICE)})</label>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">{a.pickup === "delivery" ? "택배비 4,000원 포함해서 " : ""}고른 교재 금액이 입금액({won(event.amount)})과 같을 때만 확인돼요.</p>
                      <button className="btn !py-1.5 !text-sm">교재 조정 후 납부 확인</button>
                    </form>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card space-y-2">
        <p className="font-jua text-lg text-sky-ink">YBM 인강 주문 ({found.orders.length})</p>
        {found.orders.length === 0 && <p className="text-sm text-slate-500">같은 이름의 인강 주문이 없어요.</p>}
        {found.orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 p-3 text-sm">
            <b className="text-sky-ink">{o.name}</b>
            {o.depositor !== o.name && <span className="text-slate-500">(입금자 {o.depositor})</span>}
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600">{statusText(o)}</span>
            <span className={o.amount === event.amount ? "text-slate-600" : "font-bold text-red-600"}>입금 {won(event.amount)} / 주문 {won(o.amount)}</span>
            <span className="ml-auto"><ConfirmForm kind="ybm" targetId={o.id} label={o.amount === event.amount ? "이 주문으로 납부 확인" : "금액 그대로 확인"} /></span>
          </div>
        ))}
      </section>
    </div>
  );
}
