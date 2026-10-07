import "server-only";
import { getSetting, type Application, type LcAudio } from "./db";
import { SCHEDULE_CLASSES, scheduleClassFor, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";

export const AUDIO_DAYS = 14; // 첫 수업일부터 다운로드할 수 있는 날 수
export const AUDIO_MAX_BYTES = 50 * 1024 * 1024; // Supabase 무료 요금제 파일 한 개 최대 크기
export const AUDIO_BOOKS = ["lc1", "lc2"] as const;
export const isAudioBook = (v: string): v is LcAudio["book"] => v === "lc1" || v === "lc2";

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function classWindow(cohort: string, klass: ScheduleClass) {
  const days = schoolDaysFor(await getSetting(scheduleKey(cohort, klass)), cohort, klass);
  if (days.length === 0) return null;
  return { start: days[0], end: addDays(days[0], AUDIO_DAYS - 1) };
}

export { audioBooksFor } from "./access";

// 학생 본인 반의 다운로드 기간 (첫 수업일 ~ 14일째)
export function studentAudioWindow(app: Application) {
  return classWindow(app.cohort, scheduleClassFor(app.course, app.track));
}

// 이 기수 음원을 받을 수 있는 반 중 가장 늦게 끝나는 날. 이 날이 지나면 정리해도 돼요.
export async function audioExpiresOn(cohort: string) {
  const windows = await Promise.all((Object.keys(SCHEDULE_CLASSES) as ScheduleClass[]).map((k) => classWindow(cohort, k)));
  return windows.reduce<string>((last, w) => (w && w.end > last ? w.end : last), "");
}

export function dayDiff(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
