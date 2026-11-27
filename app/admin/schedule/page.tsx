import Link from "next/link";
import Icon from "@/components/Icon";
import { isAdmin } from "@/lib/auth";
import { getSetting, isPreview } from "@/lib/db";
import { holidayKey, parseHolidays, defaultHolidays, scheduleKey, schoolDaysFor, SCHEDULE_CLASSES, type ScheduleClass } from "@/lib/schedule";
import { classCohortNow } from "@/lib/classCohort";
import { shiftMonth } from "@/lib/signupMonths";
import { classRoster, loadTimetable } from "@/lib/timetableServer";
import { holidaysFor } from "@/lib/timetable";
import { targetCohort } from "@/lib/monthlyChecklist";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import ScheduleEditor from "./ScheduleEditor";
import TimetableEditor from "./TimetableEditor";
import { confirmSchedule } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "일정표 · vella_toeic", robots: { index: false } };

const dayLabel = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${"일월화수목금토"[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;

// [일정표] (예전 [수업일 설정], 2026-11-27 Vella): 한 달 수업을 한 장에 — 월수반·화목반(주 4일반은 둘 다)·개강·종강·공휴일·특강.
// 저장한 일정표가 기준선이에요: 반별 수업일(7개 반)·공휴일·특강 초안이 한 번에 바뀌고, 강의실·출석·음원·열람 기간·수강증 반 대조가 따라가요.
export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ cohort?: string; klass?: string; saved?: string; kept?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const params = await searchParams;
  const [running, prepare] = await Promise.all([classCohortNow(), targetCohort()]);
  // 처음 열면 '준비할 달'(이번 달 개강 전이면 이번 달, 개강했으면 다음 달) — 모집 기수 설정이 지난달로 남아 있어도 12월부터 보여요
  const cohort = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.cohort ?? "") ? params.cohort! : prepare;
  const klass = Object.hasOwn(SCHEDULE_CLASSES, params.klass ?? "") ? params.klass as ScheduleClass : "start-all";
  const [table, savedDays, savedHolidays, confirmedRaw] = await Promise.all([
    loadTimetable(cohort),
    getSetting(scheduleKey(cohort, klass)),
    getSetting(holidayKey(cohort)),
    getSetting(`schedule_confirmed:${cohort}`),
  ]);
  const roster = await classRoster(cohort, table.marks);
  const confirmed = confirmedRaw === "1";
  const months = [...new Set([shiftMonth(prepare, -1), prepare, shiftMonth(prepare, 1), shiftMonth(prepare, 2), cohort])].sort();
  const weekdayHolidays = Object.entries(holidaysFor(cohort, table.savedHolidays, {})).filter(([d]) => { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); return d.startsWith(`${cohort}-`) && w >= 1 && w <= 5; });

  return (
    <div className="space-y-5 pt-8">
      <AdminTabs active="schedule" />

      {/* ① 달 먼저 고르기 */}
      <section className="card space-y-2 !p-4">
        <p className="font-jua text-lg text-sky-ink">① 몇 월 수업 일정표를 만들까요?</p>
        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="달 고르기">
          {months.map((m) => (
            <Link key={m} href={`/admin/schedule?cohort=${m}`} aria-current={m === cohort ? "page" : undefined}
              className={`rounded-2xl px-3 py-3 text-center font-extrabold ${m === cohort ? "bg-sky-deep text-white shadow-[0_3px_0_#1f6f9e]" : "bg-sky-soft text-sky-ink"}`}>
              {m.slice(0, 4) !== cohort.slice(0, 4) ? `${m.slice(2, 4)}년 ` : ""}{Number(m.slice(5, 7))}월 수업
              <span className="block text-xs font-bold opacity-80">{m === prepare ? "지금 준비할 달" : m < prepare ? (m === running ? "지금 수업 중" : "지난달") : "다음"}</span>
            </Link>
          ))}
        </nav>
        <p className="text-xs text-slate-500">11월 말에 개강하는 12월반처럼 앞달에 시작해도 &apos;12월 수업&apos;을 고르면 돼요. 달력 첫 줄에 앞달 날짜(예: 11/30)도 있어요.</p>
      </section>

      {params.saved && (
        <p className="flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          <Icon name="check" size={18} />일정표를 저장했어요. 강의실·출석·음원·특강 초안이 이 일정표로 바뀌었어요.
          {Number(params.kept) > 0 && ` (자료·영상이 있는 특강 초안 ${Number(params.kept)}개는 지우지 않았어요 · [특강 관리]에서 확인해 주세요)`}
        </p>
      )}
      {table.saved && table.mismatch.length > 0 && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
          반별로 따로 고친 반이 있어요: {table.mismatch.join(", ")}. 지금 일정표는 시작반 기준이고, 저장하면 모든 반이 일정표대로 맞춰져요.
        </p>
      )}

      <TimetableEditor
        key={`${cohort}:${table.savedAt ?? ""}:${JSON.stringify([table.marks, table.specials.map((p) => [p.date, p.title])])}`}
        cohort={cohort}
        initialMarks={table.marks}
        savedHolidays={table.savedHolidays}
        specials={table.specials}
        saved={table.saved}
      />

      {/* 이번 달 할 일 '수업일 확인' */}
      <form action={confirmSchedule} className={`card flex flex-wrap items-center justify-between gap-3 ${weekdayHolidays.length ? "!border-2 !border-red-300" : ""}`}>
        <input type="hidden" name="cohort" value={cohort} />
        {confirmed && <input type="hidden" name="undo" value="1" />}
        <div className="text-sm">
          <p className="flex items-center gap-1.5 font-jua text-lg text-sky-ink"><Icon name={confirmed ? "check" : "alert"} size={22} />{Number(cohort.slice(5, 7))}월 수업일 확인</p>
          {weekdayHolidays.length > 0 && <p className="font-bold text-red-600">평일 공휴일이 있는 달이에요: {weekdayHolidays.map(([d, n]) => `${dayLabel(d)} ${n}`).join(", ")}</p>}
          <p className="text-slate-500">일정표를 저장하고 한 번 더 본 뒤 [확인했어요]를 누르면 &apos;이번 달 할 일&apos;에서 체크돼요.</p>
        </div>
        <button className={confirmed ? "btn-ghost !py-2 text-sm" : "btn !py-2 !text-sm"}>{confirmed ? "확인 취소" : "확인했어요"}</button>
      </form>

      {/* 반편성: 일정표 → 반마다 수업일 · 신청 인원 */}
      <section className="card space-y-3 !p-4 sm:!p-6">
        <div>
          <h3 className="flex items-center gap-1.5 font-jua text-lg text-sky-ink"><Icon name="people" size={22} />{Number(cohort.slice(5, 7))}월 반편성</h3>
          <p className="text-xs text-slate-500">수강증으로 자동 확인된 학생은 수강증의 반(시작·문풀·속성 × 주 4일·월수·화목 × 오전·저녁)으로 바로 들어가고, 그 반의 수업일은 이 일정표를 따라요. 강의·음원은 납부 확인 뒤 개강일부터 열려요.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">반</th><th>수업</th><th>기간</th><th className="text-right">신청</th><th className="text-right">납부 완료</th><th className="text-right">수강증 확인</th></tr></thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.klass} className="border-b border-slate-100">
                  <td className="py-2 font-bold text-sky-ink">{r.label}</td>
                  <td>{r.count}회</td>
                  <td className="text-slate-600">{r.first ? `${dayLabel(r.first)} ~ ${dayLabel(r.last!)}` : "—"}</td>
                  <td className="text-right">{r.students}명</td>
                  <td className="text-right">{r.paid}명</td>
                  <td className="text-right">{r.receipt}명</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">주 4일 · RC·LC 단과는 '종합반' 줄에 함께 세요. 위 표는 저장한 일정표 기준이에요(저장 전 바꾼 내용은 저장 뒤 반영).</p>
      </section>

      {/* 예전 반별 화면 (예외가 있는 달만) */}
      <details className="card" open={!!params.klass}>
        <summary className="cursor-pointer font-jua text-lg text-slate-500">반별로 따로 고치기 (예전 수업일 화면)</summary>
        <p className="mt-2 text-sm text-slate-500">한 반만 다른 날 수업하는 달에만 써요. 그 뒤 위 일정표를 저장하면 모든 반이 다시 일정표대로 맞춰져요.</p>
        <div className="mt-4">
          <ScheduleEditor cohort={cohort} klass={klass} initialDays={schoolDaysFor(savedDays, cohort, klass)} initialHolidays={savedHolidays ? parseHolidays(savedHolidays, cohort) : defaultHolidays(cohort)} />
        </div>
      </details>
    </div>
  );
}
