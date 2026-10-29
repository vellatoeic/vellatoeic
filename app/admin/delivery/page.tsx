import { BOOKS, cohortLabel, klassLabel } from "@/lib/config";
import { listApplications, listYbmOrders, cleanupYbmProofs, cleanupYbmOrders, currentCohort, isPreview } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { phoneLabel } from "@/lib/csv";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";
import DeliveryList, { type Row } from "./DeliveryList";
import { classCohortNow } from "@/lib/classCohort";
import { isActive } from "@/lib/access";
import { adminReviveYbm } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "택배 발송 · vella_toeic", robots: { index: false } };


const SOURCES = { all: "전체", academy: "학원 불라방", ybm: "YBM 인강" } as const;
type Source = keyof typeof SOURCES;

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { from: raw } = await searchParams;
  const from: Source = raw === "academy" || raw === "ybm" ? raw : "all";
  const cohort = await currentCohort();
  // 모집 기수 + 지금 수업 중인 기수 (모집 기수를 바꿔도 이번 달 택배가 빠지지 않게)
  const cohorts = new Set([cohort, await classCohortNow()]);
  await cleanupYbmProofs().catch(() => {});
  await cleanupYbmOrders().catch(() => {});
  const academy: Row[] = (await listApplications())
    .filter((a) => cohorts.has(a.cohort) && a.kind === "online" && a.pickup === "delivery" && isActive(a))
    .map((a) => ({ id: a.id, name: a.name, klass: klassLabel(a), phone: phoneLabel(a.phone), address: a.address ?? "", books: a.books.map((b) => BOOKS[b]).join(", "), status: a.status as Row["status"], at: a.created_at }));
  // YBM 인강 주문은 기수와 상관없이, 발송 전 주문과 최근 60일 안에 발송한 주문만 보여요.
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const ybm: Row[] = (await listYbmOrders())
    .filter((o): o is typeof o & { status: "pending" | "paid" | "shipped" } => o.status !== "cancelled") // 취소된 주문은 아래 칸에서 따로
    .filter((o) => o.status !== "shipped" || (o.shipped_at ?? o.created_at) > since)
    .map((o) => ({ id: `ybm:${o.id}`, name: o.name, klass: "YBM 인강", phone: phoneLabel(o.phone), address: o.address, books: `개념 zip${o.depositor !== o.name ? ` · 입금자 ${o.depositor}` : ""}`, status: o.status, proof: o.proof_path ? `/admin/delivery/proof/${o.id}` : undefined, ybm: true, at: o.created_at }));
  const all = [...academy, ...ybm];
  const cancelledYbm = (await listYbmOrders()).filter((o) => o.status === "cancelled" && o.cancel_reason === "admin");
  const delivery = (from === "academy" ? academy : from === "ybm" ? ybm : all)
    .sort((a, b) => b.at.localeCompare(a.at)); // 최신 신청이 맨 위
  const count = (status: string) => delivery.filter((a) => a.status === status).length;
  const total = { all: all.length, academy: academy.length, ybm: ybm.length };

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="delivery" />
      <div>
        <p className="text-slate-500">{cohortLabel(cohort)}</p>
        <h2 className="font-jua text-3xl text-sky-ink">교재 택배 발송</h2>
        <p className="mt-1 text-sm text-slate-600">
          전체 {delivery.length}명 · 발송 대기 {count("paid")}명 · 미납 {count("pending")}명 · 발송 완료 {count("shipped")}명
        </p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {(Object.keys(SOURCES) as Source[]).map((k) => (
          <a key={k} href={k === "all" ? "/admin/delivery" : `/admin/delivery?from=${k}`} aria-current={from === k ? "page" : undefined}
            className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${from === k ? "border-sky-deep bg-sky-deep text-white" : "border-sky-main bg-white text-sky-ink"}`}>
            {SOURCES[k]} {total[k]}
          </a>
        ))}
      </nav>
      <section className="card !p-4 sm:!p-6">
        {delivery.length > 0 ? (
          <DeliveryList rows={delivery} csv={from === "all" ? "/admin/delivery/csv" : `/admin/delivery/csv?from=${from}`} />
        ) : <p className="text-center text-slate-500">택배 신청자가 아직 없어요.</p>}
      </section>

      {/* 관리자가 취소한 인강 주문 (30분 자동 취소는 보이지 않아요) */}
      {cancelledYbm.length > 0 && (
        <details className="card !p-4 text-sm">
          <summary className="font-jua cursor-pointer text-lg text-slate-500">취소한 인강 주문 {cancelledYbm.length}건</summary>
          <ul className="mt-2 divide-y divide-sky-soft">
            {cancelledYbm.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 py-2">
                <b className="text-sky-ink">{o.name}</b><span className="text-slate-500">{phoneLabel(o.phone)} · 입금자 {o.depositor}</span>
                <form action={adminReviveYbm} className="ml-auto"><input type="hidden" name="id" value={o.id} /><button className="btn-ghost !py-1.5 text-xs">되살리기 (입금 대기 · 30분 새로)</button></form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
