import { isAdmin } from "@/lib/auth";
import { currentCohort, getSetting, isPreview } from "@/lib/db";
import { defaultHolidays, holidayKey, parseHolidays, scheduleKey, schoolDaysFor, SCHEDULE_CLASSES, type ScheduleClass } from "@/lib/schedule";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import ScheduleEditor from "./ScheduleEditor";
import { confirmSchedule, setSpecialWeekday } from "@/app/actions";
import { specialPreview } from "@/lib/specialDrafts";

export const dynamic = "force-dynamic";
export const metadata = { title: "수업일 설정 · vella_toeic", robots: { index: false } };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ cohort?: string; klass?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const params = await searchParams;
  const current = await currentCohort();
  const cohort = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.cohort ?? "") ? params.cohort! : current;
  const klass = Object.hasOwn(SCHEDULE_CLASSES, params.klass ?? "") ? params.klass as ScheduleClass : "start-all";
  const [savedDays, savedHolidays, confirmedRaw] = await Promise.all([
    getSetting(scheduleKey(cohort, klass)),
    getSetting(holidayKey(cohort)),
    getSetting(`schedule_confirmed:${cohort}`),
  ]);
  const confirmed = confirmedRaw === "1";
  const preview = await specialPreview(cohort);
  const initialDays = schoolDaysFor(savedDays, cohort, klass);
  const initialHolidays = savedHolidays ? parseHolidays(savedHolidays, cohort) : defaultHolidays(cohort);

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="schedule" />
      <form action={confirmSchedule} className={`card flex flex-wrap items-center justify-between gap-3 ${Object.keys(initialHolidays).length ? "!border-2 !border-red-300" : ""}`}>
        <input type="hidden" name="cohort" value={cohort} />
        {confirmed && <input type="hidden" name="undo" value="1" />}
        <div className="text-sm">
          <p className="font-jua text-lg text-sky-ink">{confirmed ? "✅" : "⚠️"} {Number(cohort.slice(5, 7))}월 수업일 확인</p>
          {Object.keys(initialHolidays).length > 0 && <p className="font-bold text-red-600">공휴일이 있는 달이에요: {Object.entries(initialHolidays).map(([d, n]) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} ${n}`).join(", ")}</p>}
          <p className="text-slate-500">반별 수업일을 모두 본 뒤 [확인]을 누르면 &apos;이번 달 할 일&apos;에서 체크돼요.</p>
        </div>
        <button className={confirmed ? "btn-ghost !py-2 text-sm" : "btn !py-2 !text-sm"}>{confirmed ? "확인 취소" : "확인했어요"}</button>
      </form>
      <section className="card space-y-2 text-sm">
        <p className="font-jua text-lg text-sky-ink">🎤 {Number(cohort.slice(5, 7))}월 특강 요일</p>
        <div className="flex flex-wrap items-center gap-2">
          {(["5", "6"] as const).map((w) => (
            <form key={w} action={setSpecialWeekday}>
              <input type="hidden" name="cohort" value={cohort} />
              <input type="hidden" name="weekday" value={String(preview.weekday) === w ? "" : w} />
              <button className={`rounded-full px-4 py-2 font-bold ${String(preview.weekday) === w ? "bg-sky-deep text-white" : "bg-sky-soft text-sky-ink"}`}>
                {String(preview.weekday) === w ? "✓ " : ""}{w === "5" ? "금요일" : "토요일"}
              </button>
            </form>
          ))}
          {!preview.weekday && <span className="text-xs text-slate-400">아직 안 골랐어요</span>}
        </div>
        {preview.dates.length > 0 && (
          <ul className="space-y-1">
            {preview.dates.map((d, i) => (
              <li key={d.date} className={d.holiday ? "font-bold text-red-600" : "text-slate-700"}>
                {i + 1}차 {Number(d.date.slice(5, 7))}/{Number(d.date.slice(8, 10))}({"일월화수목금토"[new Date(`${d.date}T00:00:00Z`).getUTCDay()]}) · {d.title}{d.holiday ? ` · 공휴일(${d.holiday}) — 초안에서 날짜를 고쳐 주세요` : ""}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">1차 = 개강 1주차, 2차 = 개강 3주차의 그 요일 (개강일 = 시작반 종합반 첫 수업일). 요일을 고르고 위 [확인했어요]를 누르면 [특강 관리]에 초안 2개가 생겨요. 공개 전에는 학생에게 안 보여요.</p>
      </section>
      <ScheduleEditor cohort={cohort} klass={klass} initialDays={initialDays} initialHolidays={initialHolidays} />
    </div>
  );
}
