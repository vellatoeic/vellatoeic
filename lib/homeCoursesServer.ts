import "server-only";
import { todayKST } from "./config";
import { getSetting } from "./db";
import { holidaysOf } from "./classCalendar";
import { SCHEDULE_CLASSES, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";
import { signupMonths } from "./signupMonthsServer";

export type HomeCourseMonth = { cohort: string; month: number; starts: Partial<Record<ScheduleClass, string>> };

// 첫 화면 강좌 시간표에 보여줄 달: 지금 신청받는 달 중 늦은 달 (신청서와 같은 규칙)
// 반마다 개강일 = [수업일 설정]에 저장한 수업일 중 공휴일을 뺀 첫날 (저장 안 한 달은 기본값)
export async function homeCourseMonth(today = todayKST()): Promise<HomeCourseMonth | null> {
  const month = (await signupMonths(today)).at(-1);
  if (!month) return null;
  const cohort = month.cohort;
  const holidays = await holidaysOf(cohort);
  const classes = Object.keys(SCHEDULE_CLASSES) as ScheduleClass[];
  const raws = await Promise.all(classes.map((k) => getSetting(scheduleKey(cohort, k))));
  const starts: Partial<Record<ScheduleClass, string>> = {};
  classes.forEach((k, i) => {
    const first = schoolDaysFor(raws[i], cohort, k).filter((d) => !holidays[d]).sort()[0];
    if (first) starts[k] = first;
  });
  return { cohort, month: Number(cohort.slice(5, 7)), starts };
}
