import "server-only";
import { deleteAudios, getSetting, listApplications, listAudios, type Application, type LcAudio } from "./db";
import { canWatch, audioBooksFor as booksOf } from "./access";
import { todayKST } from "./config";
import { kstDate } from "./studentDays";
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

// 학생별 다운로드 기간 = max(반 첫 수업일, 납부 확인일)부터 14일 (중간 등록생도 14일 보장)
// 관리자가 [음원 7일 다시 열기]를 누르면 그 날까지 늘어나요.
export function audioWindowFor(classStart: string, paidAt: string | null | undefined, extendedUntil: string | null | undefined) {
  const paid = paidAt ? kstDate(paidAt) : "";
  const start = paid > classStart ? paid : classStart;
  const base = addDays(start, AUDIO_DAYS - 1);
  return { start, end: extendedUntil && extendedUntil > base ? extendedUntil : base };
}

export async function studentAudioWindow(app: Application) {
  const w = await classWindow(app.cohort, scheduleClassFor(app.course, app.track));
  return w ? audioWindowFor(w.start, app.paid_at, app.audio_extended_until) : null;
}

// 이 기수 음원을 받을 수 있는 마지막 날: 모든 반 기간과 모든 학생 기간(연장 포함) 중 가장 늦은 날.
export async function audioExpiresOn(cohort: string) {
  const windows = await Promise.all((Object.keys(SCHEDULE_CLASSES) as ScheduleClass[]).map((k) => classWindow(cohort, k)));
  const apps = (await listApplications()).filter((a) => a.cohort === cohort && canWatch(a) && booksOf(a).length > 0);
  const students = await Promise.all(apps.map((a) => studentAudioWindow(a)));
  return [...windows, ...students].reduce<string>((last, w) => (w && w.end > last ? w.end : last), "");
}

// 자동 정리: 그 기수 기간(연장 포함)이 끝나고 7일이 지나면 음원 파일을 지워요.
// 새 음원을 올릴 때와 관리자 첫 화면을 열 때 실행해요.
export async function autoCleanupAudios(today = todayKST()) {
  const all = await listAudios();
  let removed = 0;
  for (const cohort of [...new Set(all.map((a) => a.cohort))]) {
    const end = await audioExpiresOn(cohort);
    if (end && addDays(end, 7) < today) {
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
