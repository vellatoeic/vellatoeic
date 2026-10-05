import type { CourseId, Track } from "./config";

export type ScheduleClass = "start-all" | "start-mw" | "start-tt" | "solve-all" | "solve-mw" | "solve-tt" | "intensive-all";

export const SCHEDULE_CLASSES: Record<ScheduleClass, string> = {
  "start-all": "시작반 종합반",
  "start-mw": "시작반 격일반 월수",
  "start-tt": "시작반 격일반 화목",
  "solve-all": "문풀반 종합반",
  "solve-mw": "문풀반 격일반 월수",
  "solve-tt": "문풀반 격일반 화목",
  "intensive-all": "속성반",
};

export function scheduleClassFor(course: CourseId, track: Track): ScheduleClass {
  if (course === "intensive") return "intensive-all";
  if (track === "alt_mw") return `${course}-mw`;
  if (track === "alt_tt") return `${course}-tt`;
  if (track === "alt") return `${course}-mw`;
  return `${course}-all`;
}

export function scheduleKey(cohort: string, klass: ScheduleClass) {
  return `schooldays_${cohort}_${klass}`;
}

function isDateInCohort(day: string, cohort: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !day.startsWith(`${cohort}-`)) return false;
  const [year, month, date] = day.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date;
}

export function holidayKey(cohort: string) {
  return `holidays_${cohort}`;
}

export function defaultHolidays(cohort: string): Record<string, string> {
  if (cohort !== "2026-10") return {};
  return {
    "2026-10-05": "공휴일",
    "2026-10-09": "한글날",
  };
}

export function parseSchoolDays(value: string, cohort: string): string[] {
  try {
    const result: unknown = JSON.parse(value);
    if (!Array.isArray(result)) return [];
    return [...new Set(result.filter((d): d is string => typeof d === "string" && isDateInCohort(d, cohort)))].sort();
  } catch {
    return [];
  }
}

export function parseHolidays(value: string, cohort: string): Record<string, string> {
  try {
    const result: unknown = JSON.parse(value);
    if (!result || typeof result !== "object" || Array.isArray(result)) return {};
    return Object.fromEntries(Object.entries(result)
      .filter(([day, name]) => isDateInCohort(day, cohort) && typeof name === "string" && name.trim())
      .map(([day, name]) => [day, String(name).trim().slice(0, 40)]));
  } catch {
    return {};
  }
}

export function defaultSchoolDays(cohort: string, klass: ScheduleClass): string[] {
  // 2026년 10월은 개강일과 공휴일 조정으로 일반 월~목 패턴이 아니에요.
  if (cohort === "2026-10" && !klass.endsWith("-mw") && !klass.endsWith("-tt")) {
    return [
      "2026-10-06", "2026-10-07", "2026-10-08",
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16",
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22",
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29",
    ];
  }
  const match = /^(\d{4})-(\d{2})$/.exec(cohort);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstMonday = new Date(Date.UTC(year, month - 1, 1));
  firstMonday.setUTCDate(firstMonday.getUTCDate() + ((8 - firstMonday.getUTCDay()) % 7));
  const weekdays = klass.endsWith("-mw") ? [1, 3] : klass.endsWith("-tt") ? [2, 4] : [1, 2, 3, 4];
  const limit = weekdays.length === 2 ? 8 : 16;
  const days: string[] = [];
  for (let day = firstMonday.getUTCDate(); day <= last && days.length < limit; day++) {
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekdays.includes(dow)) days.push(`${cohort}-${String(day).padStart(2, "0")}`);
  }
  return days;
}

export function homeworkAssignmentDays(scheduleDays: string[]): string[] {
  return [...new Set(scheduleDays)].sort().slice(1); // 첫 수업에는 숙제가 없어요.
}

// 숙제는 언제든 제출할 수 있지만, 수업일 당일 또는 다음 날 제출한 것만 별을 받아요.
export function isHomeworkStickerEligible(lessonDay: string, submittedAt: string | null | undefined): boolean {
  if (!submittedAt) return false;
  const submitted = Date.parse(submittedAt);
  if (!Number.isFinite(submitted)) return false;
  const submittedDay = new Date(submitted + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const nextDay = new Date(Date.parse(`${lessonDay}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return submittedDay === lessonDay || submittedDay === nextDay;
}

export function weekDaysInMonth(cohort: string): (string | null)[][] {
  const match = /^(\d{4})-(\d{2})$/.exec(cohort);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = firstDow === 0 || firstDow === 6 ? 0 : (firstDow + 6) % 7;
  const cells: (string | null)[] = [...Array(offset).fill(null)];
  for (let day = 1; day <= last; day++) {
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (dow !== 0 && dow !== 6) cells.push(`${cohort}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 5) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 5) weeks.push(cells.slice(i, i + 5));
  return weeks;
}

export function previousMonth(cohort: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(cohort);
  if (!match) return cohort;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftSchoolDays(days: string[], fromCohort: string, toCohort: string): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(toCohort);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const target = new Set<string>();
  for (const source of days) {
    const [y, m, d] = source.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const occurrence = Math.floor((d - 1) / 7);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const firstMatching = 1 + ((weekday - first.getUTCDay() + 7) % 7);
    const shiftedDay = firstMatching + occurrence * 7;
    if (shiftedDay <= last) target.add(`${toCohort}-${String(shiftedDay).padStart(2, "0")}`);
  }
  return [...target].sort();
}
