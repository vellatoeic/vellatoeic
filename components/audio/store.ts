// LC 음원 '받음' 기록 (기기별 localStorage, 기수별). 실패해도 화면은 정상으로 보여요.
const gotKey = (cohort: string) => `vella_audio_got:${cohort}`;
const doneKey = (cohort: string) => `vella_audio_done:${cohort}`;
export const popupKey = (cohort: string) => `vella_audio_popup:${cohort}`;
export const AUDIO_EVENT = "vella-audio";

export function readGot(cohort: string): string[] {
  try { return JSON.parse(localStorage.getItem(gotKey(cohort)) ?? "[]"); } catch { return []; }
}
export function markGot(cohort: string, id: string) {
  try {
    const got = new Set(readGot(cohort));
    got.add(id);
    localStorage.setItem(gotKey(cohort), JSON.stringify([...got]));
  } catch {}
  window.dispatchEvent(new Event(AUDIO_EVENT));
}
// 다 받은 날 (그 다음 날부터 배너를 숨겨요)
export function readDone(cohort: string): string {
  try { return localStorage.getItem(doneKey(cohort)) ?? ""; } catch { return ""; }
}
export function writeDone(cohort: string, day: string) {
  try { if (!localStorage.getItem(doneKey(cohort))) localStorage.setItem(doneKey(cohort), day); } catch {}
}
export function readFlag(key: string) {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}
export function writeFlag(key: string) {
  try { localStorage.setItem(key, "1"); } catch {}
}
export function scrollToAudio() {
  document.getElementById("lc-audio")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
