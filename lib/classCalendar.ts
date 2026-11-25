import "server-only";
import { getSetting, type Application } from "./db";
import { defaultHolidays, holidayKey, parseHolidays, scheduleClassFor, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";

// ── 수업일 한곳 ──
// 수업일은 반마다 따로 저장하지만 공휴일은 기수 전체에 하나예요.
// 그래서 공휴일을 나중에 다른 반 화면에서 추가하면, 먼저 저장한 반의 수업일에는 그날이 남아 있을 수 있어요.
// 수업일이 필요한 곳은 이 함수들을 써서 항상 '저장한 수업일(없으면 기본값) − 그 기수 공휴일'을 받아요.

// 그 기수 공휴일 (관리자 수업일 설정의 공휴일, 없으면 기본값)
export async function holidaysOf(cohort: string) {
  const raw = await getSetting(holidayKey(cohort));
  return raw ? parseHolidays(raw, cohort) : defaultHolidays(cohort);
}

// 그 반의 기수 수업일 (공휴일 제외, 날짜순)
export async function scheduleDays(cohort: string, klass: ScheduleClass) {
  const [raw, holidays] = await Promise.all([getSetting(scheduleKey(cohort, klass)), holidaysOf(cohort)]);
  return schoolDaysFor(raw, cohort, klass).filter((d) => !holidays[d]).sort();
}

// 그 학생 반의 이번 기수 수업일 (관리자 수업일 설정 기준, 공휴일 제외)
export async function classDaysOf(a: Pick<Application, "cohort" | "course" | "track">) {
  return scheduleDays(a.cohort, scheduleClassFor(a.course, a.track));
}
