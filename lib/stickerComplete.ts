// ── 스티커판 완성 (화면·관리자 집계 공통, DB 없이 계산) ──
// - 출석: 학생 수업일 전부 (지각도 출석)
// - 숙제(⭐): 마지막 수업일을 뺀 수업일 전부. 마지막 날은 출석만 하면 돼요.
// - 수업일은 중간 등록생이면 신청 후 수업일(studentDays)로 넘겨 주세요.
import { isHomeworkStickerEligible } from "./schedule";
import type { Track } from "./config";

export type Missing = { day: string; kind: "출석" | "숙제" };
export type BoardStatus = {
  total: number; hwTotal: number; attended: number; hw: number; last: string | null;
  complete: boolean;
  lastOnly: boolean; // 마지막 날 출석만 남음
  missing: Missing[]; // 아직 안 된 것 (마지막 날 출석은 그날이 오기 전엔 빼요)
};

export function boardStatus(days: string[], attendance: { day: string }[], homework: { day: string; created_at: string }[], today: string): BoardStatus {
  const sorted = [...new Set(days)].sort();
  const last = sorted.at(-1) ?? null;
  const came = new Set(attendance.map((a) => a.day));
  const stars = new Set(homework.filter((h) => isHomeworkStickerEligible(h.day, h.created_at)).map((h) => h.day));
  const hwDays = sorted.filter((d) => d !== last);
  const attended = sorted.filter((d) => came.has(d)).length;
  const hw = hwDays.filter((d) => stars.has(d)).length;
  const complete = sorted.length > 0 && attended === sorted.length && hw === hwDays.length;
  const missing: Missing[] = [
    ...sorted.filter((d) => !came.has(d) && !(d === last && today <= d)).map((day) => ({ day, kind: "출석" as const })),
    ...hwDays.filter((d) => !stars.has(d)).map((day) => ({ day, kind: "숙제" as const })),
  ].sort((a, b) => a.day.localeCompare(b.day));
  return { total: sorted.length, hwTotal: hwDays.length, attended, hw, last, complete, lastOnly: !complete && missing.length === 0, missing };
}

// 선물 대상: 종합반·속성반·단과(RC/LC). 격일반은 제외
export const giftEligibleTrack = (track: Track) => track === "all" || track === "rc" || track === "lc";

// 선물 뽑기 가능 기간: 마지막 수업일부터 7일
export function giftWindowOpen(last: string | null, today: string) {
  if (!last) return false;
  const end = new Date(Date.parse(`${last}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
  return last <= today && today <= end;
}
