import "server-only";
import { TRACK_PARTS } from "./config";
import { getSetting, type Application, type LcAudio } from "./db";
import { canWatch } from "./access";
import { scheduleClassFor, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";

export const AUDIO_DAYS = 14; // 첫 수업일부터 다운로드할 수 있는 날 수
export const AUDIO_MAX_BYTES = 50 * 1024 * 1024; // Supabase 무료 요금제 파일 한 개 최대 크기

// 이 음원(시작반/문풀반)을 받는 수업들. 속성반은 두 반 음원을 모두 받아요.
const AUDIO_CLASSES: Record<LcAudio["course"], ScheduleClass[]> = {
  start: ["start-all", "start-mw", "start-tt", "intensive-all"],
  solve: ["solve-all", "solve-mw", "solve-tt", "intensive-all"],
};

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

// LC를 듣는 납부 완료 학생만 (종합·LC 단과·격일·속성반 O, RC 단과 X)
export function takesLcAudio(app: Application) {
  return canWatch(app) && TRACK_PARTS[app.track].includes("lc");
}

export function audioCoursesFor(app: Application): LcAudio["course"][] {
  return app.course === "intensive" ? ["start", "solve"] : [app.course];
}

// 학생 본인 반의 다운로드 기간 (첫 수업일 ~ 14일째)
export function studentAudioWindow(app: Application) {
  return classWindow(app.cohort, scheduleClassFor(app.course, app.track));
}

// 이 기수·반 음원을 받을 수 있는 수업 중 가장 늦게 끝나는 날. 이 날이 지나면 정리해도 돼요.
export async function audioExpiresOn(cohort: string, course: LcAudio["course"]) {
  const windows = await Promise.all(AUDIO_CLASSES[course].map((k) => classWindow(cohort, k)));
  return windows.reduce<string>((last, w) => (w && w.end > last ? w.end : last), "");
}

export function dayDiff(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
