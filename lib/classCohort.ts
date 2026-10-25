import "server-only";
import { todayKST } from "./config";
import { getSetting, type Application } from "./db";
import { classDaysOf, holidaysOf } from "./classCalendar";
import { SCHEDULE_CLASSES, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";

// ── 수업 기수 (날짜 기준) ──
// '현재 모집 기수(current_cohort)'는 새 신청 저장·입금 대기·관리자 기본 기수에만 써요.
// 라이브·출석·테스트·스티커·미션은 이 '수업 기수'로 판단해요. 모집 기수를 다음 달로 바꿔도 이번 달 수업은 그대로예요.
// 규칙: 오늘이 첫 수업일~마지막 수업일 안이면 그 기수 → 없으면 다가오는 기수 → 그것도 없으면 가장 최근 기수.

export type CohortWindow = { cohort: string; start: string; end: string };

export function pickCohort(windows: CohortWindow[], today: string): string | null {
  const ok = windows.filter((w) => w.start && w.end);
  const inside = ok.filter((w) => w.start <= today && today <= w.end).sort((a, b) => b.start.localeCompare(a.start))[0];
  if (inside) return inside.cohort;
  const upcoming = ok.filter((w) => w.start > today).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (upcoming) return upcoming.cohort;
  const recent = ok.filter((w) => w.end < today).sort((a, b) => b.end.localeCompare(a.end))[0];
  return recent?.cohort ?? null;
}

const shiftMonth = (cohort: string, n: number) => {
  const [y, m] = cohort.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// 학생 한 명(여러 달 신청 가능)의 수업 기수와 그 기수 신청들
export async function classAppsFor<T extends Application>(apps: T[], today = todayKST()): Promise<{ cohort: string | null; apps: T[] }> {
  if (apps.length === 0) return { cohort: null, apps: [] };
  const windows = await Promise.all(apps.map(async (a) => {
    const [days, holidays] = await Promise.all([classDaysOf(a), holidaysOf(a.cohort)]);
    const real = days.filter((d) => !holidays[d]).sort();
    return { cohort: a.cohort, start: real[0] ?? "", end: real.at(-1) ?? "" };
  }));
  const cohort = pickCohort(windows, today) ?? [...apps].sort((a, b) => b.cohort.localeCompare(a.cohort))[0].cohort;
  return { cohort, apps: apps.filter((a) => a.cohort === cohort) };
}

// 학원 전체의 수업 기수 (관리자 출석·공지 대상 등). 이번 달 앞뒤 한 달씩 모든 반 수업일로 판단해요.
export async function classCohortNow(today = todayKST()): Promise<string> {
  const month = today.slice(0, 7);
  const candidates = [shiftMonth(month, -1), month, shiftMonth(month, 1)];
  const windows = await Promise.all(candidates.map(async (cohort) => {
    const all = (await Promise.all((Object.keys(SCHEDULE_CLASSES) as ScheduleClass[]).map(async (k) =>
      schoolDaysFor(await getSetting(scheduleKey(cohort, k)), cohort, k)))).flat().sort();
    return { cohort, start: all[0] ?? "", end: all.at(-1) ?? "" };
  }));
  return pickCohort(windows, today) ?? month;
}
