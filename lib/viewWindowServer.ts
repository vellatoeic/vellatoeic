import "server-only";
import { getSetting, type Application } from "./db";
import { classDaysOf, holidaysOf } from "./classCalendar";
import { SCHEDULE_CLASSES, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";
import { shiftMonth } from "./signupMonths";
import { openAtOf, viewUntil } from "./viewWindow";

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

// 그 기수 권한 오픈 시각 = 개강일(모든 반 중 가장 이른 수업일, 공휴일 제외) 오전 9시. 수업일이 하나도 없으면 null(막지 않음)
export async function cohortOpenAt(cohort: string) {
  const firsts = await Promise.all((Object.keys(SCHEDULE_CLASSES) as ScheduleClass[]).map(async (k) => (await realDays(cohort, k))[0] ?? ""));
  return openAtOf(firsts.filter(Boolean).sort()[0] ?? null);
}

// 학생 종강일 = 학생 반 마지막 수업일
export async function studentEnd(a: Application) {
  const [days, holidays] = await Promise.all([classDaysOf(a), holidaysOf(a.cohort)]);
  return days.filter((d) => !holidays[d]).sort().at(-1) ?? `${a.cohort}-28`;
}

// 신청마다 { 종강일, 마감일, 개강 시각 }. 같은 기수 신청이 여러 개면 가장 늦은 종강일로 맞춰요.
export async function viewInfo(apps: Application[]) {
  const ends = new Map(await Promise.all(apps.map(async (a) => [a.id, await studentEnd(a)] as const)));
  const cohorts = [...new Set(apps.map((a) => a.cohort))];
  const [untils, opens] = await Promise.all([
    Promise.all(cohorts.map(async (c) => [c, await cohortUntil(c)] as const)).then((x) => new Map(x)),
    Promise.all(cohorts.map(async (c) => [c, await cohortOpenAt(c)] as const)).then((x) => new Map(x)),
  ]);
  const out = new Map<string, { end: string; until: string; openAt: string | null }>();
  for (const a of apps) {
    const end = apps.filter((x) => x.cohort === a.cohort).map((x) => ends.get(x.id)!).sort().at(-1)!;
    out.set(a.id, { end, until: untils.get(a.cohort)!, openAt: opens.get(a.cohort) ?? null });
  }
  return out;
}

// 기수마다 { 개강 시각, 열람 마감일 } (학생 명단 등급 계산용)
export async function cohortWindows(cohorts: string[]) {
  const list = [...new Set(cohorts)];
  return new Map(await Promise.all(list.map(async (c) => [c, { openAt: await cohortOpenAt(c), until: await cohortUntil(c) }] as const)));
}
