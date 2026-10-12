import "server-only";
import { getSetting, type Application } from "./db";
import { defaultHolidays, holidayKey, parseHolidays, scheduleClassFor, scheduleKey, schoolDaysFor } from "./schedule";

// 그 학생 반의 이번 기수 수업일 (관리자 수업일 설정 기준)
export async function classDaysOf(a: Pick<Application, "cohort" | "course" | "track">) {
  const k = scheduleClassFor(a.course, a.track);
  return schoolDaysFor(await getSetting(scheduleKey(a.cohort, k)), a.cohort, k);
}

// 그 기수 공휴일 (관리자 수업일 설정의 공휴일, 없으면 기본값)
export async function holidaysOf(cohort: string) {
  const raw = await getSetting(holidayKey(cohort));
  return raw ? parseHolidays(raw, cohort) : defaultHolidays(cohort);
}
