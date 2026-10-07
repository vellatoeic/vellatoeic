import { BOOKS, CLASSROOM, COURSES, TIME_SLOTS, TRACKS, cohortLabel, type BookId, type CourseId, type TimeSlot, type Track } from "@/lib/config";
import { listApplications, currentCohort, isPreview, type Application } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";
import PrintButton from "./PrintButton";
import Link from "next/link";
import { specialDay } from "@/lib/special";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

function bookCount(apps: Application[]) {
  const n: Partial<Record<BookId, number>> = {};
  for (const a of apps) for (const b of a.books) n[b] = (n[b] ?? 0) + 1;
  return (Object.keys(BOOKS) as BookId[]).filter((b) => n[b]).map((b) => `${BOOKS[b]} ${n[b]}권`);
}

function Table({ apps }: { apps: Application[] }) {
  const sorted = [...apps].sort((a, b) => Number(a.status === "pending") - Number(b.status === "pending") || a.name.localeCompare(b.name, "ko"));
  return (
    <table className="mt-3 w-full text-left text-[15px]">
      <thead>
        <tr className="border-b border-sky-main text-sm text-slate-500">
          <th className="w-8 py-2">✓</th>
          <th className="py-2">이름</th>
          <th className="py-2">교재</th>
          <th className="py-2 text-right">납부</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((a) => (
          <tr key={a.id} className={`border-b border-sky-soft ${a.status === "pending" ? "bg-amber-50" : ""}`}>
            <td className="py-2"><span className="inline-block h-4 w-4 rounded border-2 border-sky-main" /></td>
            <td className="py-2">
              {a.name}
              {a.depositor !== a.name && <span className="ml-1 text-xs text-slate-400">({a.depositor})</span>}
            </td>
            <td className="py-2 text-sm text-slate-600">{a.books.map((b) => BOOKS[b]).join(", ")}</td>
            <td className={`py-2 text-right font-bold ${a.status === "pending" ? "text-amber-600" : "text-sky-deep"}`}>
              {a.status === "pending" ? "미납" : "완료"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function Roster() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const cohort = await currentCohort();
  const apps = (await listApplications()).filter((a) => a.cohort === cohort && a.status !== "refunded");
  const onsite = apps.filter((a) => a.kind === "onsite");
  const desk = apps.filter((a) => a.kind === "online" && a.pickup === "classroom");
  const delivery = apps.filter((a) => a.kind === "online" && a.pickup === "delivery");

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="roster" />

      <div className="flex items-end justify-between">
        <div>
          <p className="text-slate-500">{cohortLabel(cohort)}</p>
          <h2 className="font-jua text-3xl text-sky-ink">첫날 {CLASSROOM} 교재 지급 명단</h2>
        </div>
        <PrintButton />
      </div>

      <div className="card">
        <p className="font-jua text-lg text-sky-ink">준비할 교재 (현장 · 납부 완료 기준)</p>
        <p className="mt-1 text-slate-700">{bookCount(onsite.filter((a) => a.status !== "pending")).join(" · ") || "아직 없어요"}</p>
        <p className="mt-2 text-sm text-amber-700">
          미납 {onsite.filter((a) => a.status === "pending").length}명은 노란색으로 표시돼요.<br />납부 확인 후 지급하세요.
        </p>
      </div>

      {(Object.keys(COURSES) as CourseId[]).flatMap((co) =>
        (Object.keys(TRACKS) as Track[]).flatMap((t) =>
          ([...Object.keys(TIME_SLOTS), null] as (TimeSlot | null)[]).map((slot) => {
            const list = onsite.filter((a) => a.course === co && a.track === t && (a.slot ?? null) === slot);
            if (list.length === 0) return null;
            return (
              <section key={`${co}${t}${slot}`} className="card break-inside-avoid">
                <h3 className="font-jua text-xl text-sky-ink">
                  {COURSES[co].label} {TRACKS[t]} · {slot ? TIME_SLOTS[slot] : "시간 미정"} <span className="text-base text-slate-400">· {list.length}명</span>
                </h3>
                <Table apps={list} />
              </section>
            );
          }),
        ),
      )}
      {onsite.length === 0 && <p className="card text-center text-slate-500">이번 기수 현장 신청자가 아직 없어요.</p>}

      <h2 className="font-jua pt-4 text-3xl text-sky-ink">불라방 교재 수령 명단</h2>
      <section className="card break-inside-avoid">
        <h3 className="font-jua text-xl text-sky-ink">
          1층 데스크 수령 <span className="text-base text-slate-400">· {desk.length}명</span>
        </h3>
        <p className="mt-1 text-sm text-slate-500">학생이 고른 수령 희망 날짜·시간 순서예요. 미리 준비해 두세요.</p>
        {desk.length === 0 ? <p className="mt-2 text-sm text-slate-500">아직 없어요.</p> : (
          <table className="mt-3 w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-sky-main text-sm text-slate-500">
                <th className="w-8 py-2">✓</th>
                <th className="py-2">수령 희망</th>
                <th className="py-2">이름</th>
                <th className="py-2">교재</th>
                <th className="py-2 text-right">상태</th>
              </tr>
            </thead>
            <tbody>
              {[...desk]
                .sort((a, b) => `${a.pickup_date ?? "9999"} ${a.pickup_time ?? ""}`.localeCompare(`${b.pickup_date ?? "9999"} ${b.pickup_time ?? ""}`) || a.name.localeCompare(b.name, "ko"))
                .map((a) => (
                  <tr key={a.id} className={`border-b border-sky-soft ${a.status === "pending" ? "bg-amber-50" : a.status === "shipped" ? "text-slate-400" : ""}`}>
                    <td className="py-2"><span className="inline-block h-4 w-4 rounded border-2 border-sky-main" /></td>
                    <td className="whitespace-nowrap py-2 font-bold text-sky-ink">{a.pickup_date ? `${specialDay(a.pickup_date)} ${a.pickup_time ?? ""}` : <span className="font-normal text-slate-400">미정</span>}</td>
                    <td className="py-2">{a.name}{a.depositor !== a.name && <span className="ml-1 text-xs text-slate-400">({a.depositor})</span>}</td>
                    <td className="py-2 text-sm text-slate-600">{a.books.map((b) => BOOKS[b]).join(", ")}</td>
                    <td className={`whitespace-nowrap py-2 text-right font-bold ${a.status === "pending" ? "text-amber-600" : "text-sky-deep"}`}>
                      {a.status === "pending" ? "미납" : a.status === "shipped" ? "수령 완료" : "준비"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="card text-sm text-slate-600 print:hidden">
        택배 수령 {delivery.length}명의 이름·연락처·주소는 <Link href="/admin/delivery" className="font-bold text-sky-deep underline">[택배 발송]</Link> 탭에서 볼 수 있어요.
      </p>
    </div>
  );
}
