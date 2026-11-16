import "server-only";
import { deleteAudios, getSetting, listCohortApplications, listAudios, type Application, type LcAudio } from "./db";
import { canWatch, audioBooksFor as booksOf } from "./access";
import { todayKST } from "./config";
import { kstDate } from "./studentDays";
import { SCHEDULE_CLASSES, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";
import { classDaysOf, holidaysOf } from "./classCalendar";

export const AUDIO_MIN_DAYS = 7; // 종강 직전 납부 학생에게 보장하는 최소 다운로드 날 수 (납부일 포함)
export const AUDIO_CLEANUP_DAYS = 7; // 모든 학생 마감일이 지나고 이만큼 뒤에 음원 기록 정리
export const AUDIO_BOOKS = ["lc1", "lc2"] as const;
export const isAudioBook = (v: string): v is LcAudio["book"] => v === "lc1" || v === "lc2";

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// 반의 실제 수업일 (공휴일 제외): 첫 수업일 ~ 종강일
async function classWindow(cohort: string, klass: ScheduleClass) {
  const [raw, holidays] = await Promise.all([getSetting(scheduleKey(cohort, klass)), holidaysOf(cohort)]);
  const days = schoolDaysFor(raw, cohort, klass).filter((d) => !holidays[d]).sort();
  if (days.length === 0) return null;
  return { start: days[0], end: days.at(-1)! };
}

export { audioBooksFor } from "./access";

// 학생별 다운로드 기간 = max(반 첫 수업일, 납부 확인일) ~ 학생 반 종강일(마지막 수업일, 격일반은 8회차)
// 종강 7일 전 이후에 납부했으면 납부일부터 최소 7일 보장. [음원 7일 다시 열기]가 더 늦으면 그 날까지.
export function audioWindowFor(classStart: string, classEnd: string, paidAt: string | null | undefined, extendedUntil: string | null | undefined) {
  const paid = paidAt ? kstDate(paidAt) : "";
  const start = paid > classStart ? paid : classStart;
  const minEnd = paid ? addDays(paid, AUDIO_MIN_DAYS - 1) : "";
  const base = minEnd > classEnd ? minEnd : classEnd;
  return { start, end: extendedUntil && extendedUntil > base ? extendedUntil : base };
}

export async function studentAudioWindow(app: Application) {
  const [days, holidays] = await Promise.all([classDaysOf(app), holidaysOf(app.cohort)]);
  const real = days.filter((d) => !holidays[d]).sort();
  if (real.length === 0) return null;
  return audioWindowFor(real[0], real.at(-1)!, app.paid_at, app.audio_extended_until);
}

// 이 기수 음원을 받을 수 있는 마지막 날: 모든 반 종강일과 모든 학생 마감일(최소 7일·연장 포함) 중 가장 늦은 날.
export async function audioExpiresOn(cohort: string) {
  const windows = await Promise.all((Object.keys(SCHEDULE_CLASSES) as ScheduleClass[]).map((k) => classWindow(cohort, k)));
  const apps = (await listCohortApplications(cohort)).filter((a) => canWatch(a) && booksOf(a).length > 0);
  const students = await Promise.all(apps.map((a) => studentAudioWindow(a)));
  return [...windows, ...students].reduce<string>((last, w) => (w && w.end > last ? w.end : last), "");
}

// 자동 정리: 그 기수 모든 학생 마감일(연장 포함) + 7일이 지나면 음원 기록을 지워요.
// 새 음원을 올릴 때와 관리자 첫 화면을 열 때 실행해요.
export async function autoCleanupAudios(today = todayKST()) {
  const all = await listAudios();
  let removed = 0;
  for (const cohort of [...new Set(all.map((a) => a.cohort))]) {
    const end = await audioExpiresOn(cohort);
    if (end && addDays(end, AUDIO_CLEANUP_DAYS) < today) {
      const list = all.filter((a) => a.cohort === cohort);
      await deleteAudios(list);
      removed += list.length;
    }
  }
  return removed;
}

export function dayDiff(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
