import "server-only";
import { todayKST } from "./config";
import { getSetting } from "./db";
import { holidaysOf } from "./classCalendar";
import { scheduleKey, schoolDaysFor } from "./schedule";
import { shiftMonth, signupMonthsFor } from "./signupMonths";

async function startAllDays(cohort: string) {
  const [raw, holidays] = await Promise.all([getSetting(scheduleKey(cohort, "start-all")), holidaysOf(cohort)]);
  return schoolDaysFor(raw, cohort, "start-all").filter((d) => !holidays[d]);
}

// 오늘 신청서에서 고를 수 있는 수강 월
export async function signupMonths(today = todayKST()) {
  const thisCohort = today.slice(0, 7);
  const [a, b] = await Promise.all([startAllDays(thisCohort), startAllDays(shiftMonth(thisCohort, 1))]);
  return signupMonthsFor(today, a, b);
}

// 관리 화면 기본 기수: 관리자가 정한 '현재 모집 기수'가 없으면 지금 신청받는 달 중 늦은 달
export async function autoRecruitCohort(today = todayKST()) {
  return (await signupMonths(today)).at(-1)?.cohort ?? thisMonth(today);
}
const thisMonth = (today: string) => today.slice(0, 7);
