import { BOOKS, DESK, cohortLabel, klassLabel } from "@/lib/config";
import { listApplications, listYbmOrders, cleanupYbmProofs, cleanupYbmOrders, currentCohort, isPreview } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { phoneLabel } from "@/lib/csv";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";
import DeliveryList, { type Row } from "./DeliveryList";
import DeskList, { type DeskRow } from "./DeskList";
import { specialDay } from "@/lib/special";
import { classCohortNow } from "@/lib/classCohort";
import { isActive } from "@/lib/access";
import { adminReviveYbm } from "@/app/actions";
import { regionLines, splitAddress } from "@/lib/address";
import { shiftMonth } from "@/lib/signupMonths";
import CopyText from "../CopyText";

export const dynamic = "force-dynamic";
export const metadata = { title: "불라방 · vella_toeic", robots: { index: false } };


// [불라방] 탭 (2026-11-26, 예전 [택배 발송]): 불라방 학생을 현장 수령(데스크) · 택배 수령으로 나눠 봐요.
// 택배 쪽(학원 불라방 · YBM 인강 · 복사 · CSV · 발송 완료)은 예전 그대로, 현장 수령 표는 예전 [현장 명단] 아래 표를 옮겨 왔어요.
const PICKS = { all: "전체", desk: "현장 수령", ship: "택배" } as const;
type Pick = keyof typeof PICKS;
const SOURCES = { all: "전체", academy: "학원 불라방", ybm: "YBM 인강" } as const;
type Source = keyof typeof SOURCES;

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<{ from?: string; pick?: string; report?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { from: raw, pick: rawPick, report: rawReport } = await searchParams;
  const from: Source = raw === "academy" || raw === "ybm" ? raw : "all";
  const pick: Pick = rawPick === "desk" || rawPick === "ship" ? rawPick : "all";
  const cohort = await currentCohort();
  // 모집 기수 + 지금 수업 중인 기수 (모집 기수를 바꿔도 이번 달 택배가 빠지지 않게)
  const classNow = await classCohortNow();
  const cohorts = new Set([cohort, classNow]);
  await cleanupYbmProofs().catch(() => {});
  await cleanupYbmOrders().catch(() => {});
  const allApps = await listApplications();
  const online = allApps.filter((a) => cohorts.has(a.cohort) && a.kind === "online" && isActive(a));
  // 학원 전달용 택배 명단 (2026-11-26 Vella): 그 달 수업 신청(= 전달 중순 ~ 그 달 2주차 접수) 중 택배로 받은 학원 불라방 학생,
  // 납부 완료·발송 완료만(미납·취소·환불 빼요), 신청 순서대로 '1. 이름: 부산 사하구' (주소는 시·구까지)
  const reportMonths = [...new Set([shiftMonth(classNow, -1), classNow, cohort])].sort();
  const report = reportMonths.includes(rawReport ?? "") ? rawReport! : classNow;
  const reportRows = allApps
    .filter((a) => a.cohort === report && a.kind === "online" && a.pickup === "delivery" && (a.status === "paid" || a.status === "shipped"))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const reportText = regionLines(reportRows.map((a) => ({ name: a.name, address: a.address })));
  const reportHref = (m: string) => `/admin/delivery?${new URLSearchParams({ ...(pick === "ship" ? { pick } : {}), report: m }).toString()}#report`;
  // 현장 수령(데스크): 수령 희망 날짜·시간 순 (미정은 맨 뒤) → 같으면 이름순
  const desk: DeskRow[] = online
    .filter((a) => a.pickup === "classroom")
    .sort((a, b) => `${a.pickup_date ?? "9999"} ${a.pickup_time ?? ""}`.localeCompare(`${b.pickup_date ?? "9999"} ${b.pickup_time ?? ""}`) || a.name.localeCompare(b.name, "ko"))
    .map((a) => ({ id: a.id, name: a.name, depositor: a.depositor, klass: klassLabel(a), when: a.pickup_date ? `${specialDay(a.pickup_date)} ${a.pickup_time ?? ""}`.trim() : null, books: a.books.map((b) => BOOKS[b]).join(", "), status: a.status as DeskRow["status"], bringOld: a.continuing && a.course === "start" }));
  const academy: Row[] = online
    .filter((a) => a.pickup === "delivery")
    .map((a) => ({ id: a.id, name: a.name, klass: klassLabel(a), phone: phoneLabel(a.phone), address: a.address ?? "", addr: splitAddress(a.address, a.address_detail), books: a.books.map((b) => BOOKS[b]).join(", "), status: a.status as Row["status"], at: a.created_at }));
  // YBM 인강 주문은 기수와 상관없이, 발송 전 주문과 최근 60일 안에 발송한 주문만 보여요.
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const ybm: Row[] = (await listYbmOrders())
    .filter((o): o is typeof o & { status: "pending" | "paid" | "shipped" } => o.status !== "cancelled") // 취소된 주문은 아래 칸에서 따로
    .filter((o) => o.status !== "shipped" || (o.shipped_at ?? o.created_at) > since)
    .map((o) => ({ id: `ybm:${o.id}`, name: o.name, klass: "YBM 인강", phone: phoneLabel(o.phone), address: o.address, addr: splitAddress(o.address, o.address_detail), books: `개념 zip${o.depositor !== o.name ? ` · 입금자 ${o.depositor}` : ""}`, status: o.status, proof: o.proof_path ? `/admin/delivery/proof/${o.id}` : undefined, ybm: true, at: o.created_at }));
  const all = [...academy, ...ybm];
  const cancelledYbm = (await listYbmOrders()).filter((o) => o.status === "cancelled" && o.cancel_reason === "admin");
  const delivery = (from === "academy" ? academy : from === "ybm" ? ybm : all)
    .sort((a, b) => b.at.localeCompare(a.at)); // 최신 신청이 맨 위
  const count = (status: string) => delivery.filter((a) => a.status === status).length;
  const total = { all: all.length, academy: academy.length, ybm: ybm.length };
  const deskCount = (status: DeskRow["status"]) => desk.filter((d) => d.status === status).length;
  const picks = { all: desk.length + all.length, desk: desk.length, ship: all.length };
  const pickHref = (k: Pick) => (k === "all" ? "/admin/delivery" : `/admin/delivery?pick=${k}`);

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="delivery" />
      <div>
        <p className="text-slate-500">{cohortLabel(cohort)}</p>
        <h2 className="font-jua text-3xl text-sky-ink">불라방 교재 수령</h2>
        <p className="mt-1 text-sm text-slate-600">현장 수령 · 택배 수령으로 나눠 봐요. 현장 학생 교재는 [현장 명단]에 있어요.</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="수령 방법">
        {(Object.keys(PICKS) as Pick[]).map((k) => (
          <a key={k} href={pickHref(k)} aria-current={pick === k ? "page" : undefined}
            className={`rounded-full px-5 py-2.5 font-jua text-lg ${pick === k ? "bg-sky-deep text-white shadow" : "bg-white text-sky-ink ring-1 ring-sky-main"}`}>
            {PICKS[k]}{k === "desk" ? ` (${DESK})` : ""} {picks[k]}
          </a>
        ))}
      </nav>

      {pick !== "ship" && (
        <section className="card space-y-3 !p-4 sm:!p-6">
          <div>
            <h3 className="font-jua text-2xl text-sky-ink">현장 수령 · {DESK} <span className="text-base text-slate-400">· {desk.length}명</span></h3>
            <p className="text-sm text-slate-600">준비 {deskCount("paid")}명 · 미납 {deskCount("pending")}명 · 수령 완료 {deskCount("shipped")}명</p>
          </div>
          {desk.length > 0 ? <DeskList rows={desk} desk={DESK} /> : <p className="text-center text-slate-500">현장 수령 신청자가 아직 없어요.</p>}
        </section>
      )}

      {pick !== "desk" && (<>
      <div>
        <h3 className="font-jua text-2xl text-sky-ink">택배 수령 <span className="text-base text-slate-400">· {delivery.length}명</span></h3>
        <p className="mt-1 text-sm text-slate-600">
          전체 {delivery.length}명 · 발송 대기 {count("paid")}명 · 미납 {count("pending")}명 · 발송 완료 {count("shipped")}명
        </p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {(Object.keys(SOURCES) as Source[]).map((k) => (
          <a key={k} href={`/admin/delivery?${new URLSearchParams({ ...(pick === "ship" ? { pick } : {}), ...(k === "all" ? {} : { from: k }) }).toString()}`} aria-current={from === k ? "page" : undefined}
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

      {/* 학원 전달용 택배 명단: 버튼 하나로 '1. 이름: 부산 사하구' 복사 → 학원 카톡에 바로 붙여 넣기 */}
      <section id="report" className="card scroll-mt-20 space-y-3 !p-4 sm:!p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-jua text-xl text-sky-ink">학원 전달용 택배 명단</h3>
            <p className="text-sm text-slate-600">{Number(report.slice(5, 7))}월 수업 신청(전달 중순 ~ {Number(report.slice(5, 7))}월 2주차 접수) 중 택배로 받은 학생 {reportRows.length}명 · 납부 완료·발송 완료만 · 주소는 시·구까지</p>
          </div>
          <CopyText text={reportText} label={`${reportRows.length}명 명단 복사`} className="btn !py-2 !text-sm" />
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="수강 월">
          {reportMonths.map((m) => (
            <a key={m} href={reportHref(m)} aria-current={report === m ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-bold ${report === m ? "bg-sky-deep text-white" : "bg-white text-sky-ink ring-1 ring-sky-main"}`}>
              {cohortLabel(m)}
            </a>
          ))}
        </nav>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-sky-soft p-3 font-sans text-sm text-slate-700">{reportText || "이 달 택배로 받은 학생이 아직 없어요."}</pre>
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
      </>)}
    </div>
  );
}
