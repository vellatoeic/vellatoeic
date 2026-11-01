import "server-only";
import { getSetting, type Application } from "./db";
import { classDaysOf, holidaysOf } from "./classCalendar";
import { SCHEDULE_CLASSES, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";
import { shiftMonth } from "./signupMonths";
import { viewUntil } from "./viewWindow";

const realDays = async (cohort: string, k: ScheduleClass) => {
  const [raw, holidays] = await Promise.all([getSetting(scheduleKey(cohort, k)), holidaysOf(cohort)]);
  return schoolDaysFor(raw, cohort, k).filter((d) => !holidays[d]).sort();
};

// 그 기수 실제 열람 마감일 = 다음 달 시작반 종합반 첫 수업일 전날 (없으면 그 기수 마지막 수업일 + 7일)
export async function cohortUntil(cohort: string) {
  const next = (await realDays(shiftMonth(cohort, 1), "start-all"))[0] ?? null;
  const lasts = await Promise.all((Object.keys(SCHEDULE_CLASSES) as ScheduleClass[]).map(async (k) => (await realDays(cohort, k)).at(-1) ?? ""));
  return viewUntil(next, lasts.filter(Boolean));
}

// 학생 종강일 = 학생 반 마지막 수업일
export async function studentEnd(a: Application) {
  const [days, holidays] = await Promise.all([classDaysOf(a), holidaysOf(a.cohort)]);
  return days.filter((d) => !holidays[d]).sort().at(-1) ?? `${a.cohort}-28`;
}

// 신청마다 { 종강일, 마감일 }. 같은 기수 신청이 여러 개면 가장 늦은 종강일로 맞춰요.
export async function viewInfo(apps: Application[]) {
  const ends = new Map(await Promise.all(apps.map(async (a) => [a.id, await studentEnd(a)] as const)));
  const untils = new Map(await Promise.all([...new Set(apps.map((a) => a.cohort))].map(async (c) => [c, await cohortUntil(c)] as const)));
  const out = new Map<string, { end: string; until: string }>();
  for (const a of apps) {
    const end = apps.filter((x) => x.cohort === a.cohort).map((x) => ends.get(x.id)!).sort().at(-1)!;
    out.set(a.id, { end, until: untils.get(a.cohort)! });
  }
  return out;
}
