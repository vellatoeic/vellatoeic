import { isAdmin } from "@/lib/auth";
import { currentCohort, getSetting, isPreview } from "@/lib/db";
import { defaultHolidays, holidayKey, parseHolidays, scheduleKey, schoolDaysFor, SCHEDULE_CLASSES, type ScheduleClass } from "@/lib/schedule";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import ScheduleEditor from "./ScheduleEditor";
import { confirmSchedule } from "@/app/actions";

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
      <ScheduleEditor cohort={cohort} klass={klass} initialDays={initialDays} initialHolidays={initialHolidays} />
    </div>
  );
}
