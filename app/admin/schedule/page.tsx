import { isAdmin } from "@/lib/auth";
import { currentCohort, getSetting, isPreview } from "@/lib/db";
import { defaultHolidays, defaultSchoolDays, holidayKey, parseHolidays, parseSchoolDays, scheduleKey, SCHEDULE_CLASSES, type ScheduleClass } from "@/lib/schedule";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import ScheduleEditor from "./ScheduleEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "수업일 설정 · vella_toeic", robots: { index: false } };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ cohort?: string; klass?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const params = await searchParams;
  const current = await currentCohort();
  const cohort = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.cohort ?? "") ? params.cohort! : current;
  const klass = Object.hasOwn(SCHEDULE_CLASSES, params.klass ?? "") ? params.klass as ScheduleClass : "start-all";
  const [savedDays, savedHolidays] = await Promise.all([
    getSetting(scheduleKey(cohort, klass)),
    getSetting(holidayKey(cohort)),
  ]);
  const initialDays = savedDays ? parseSchoolDays(savedDays, cohort) : defaultSchoolDays(cohort, klass);
  const initialHolidays = savedHolidays ? parseHolidays(savedHolidays, cohort) : defaultHolidays(cohort);

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="schedule" />
      <ScheduleEditor cohort={cohort} klass={klass} initialDays={initialDays} initialHolidays={initialHolidays} />
    </div>
  );
}
