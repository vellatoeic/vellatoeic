// ── 격일반 이어듣기·두 달째 요일 (DB 없이 계산, 서버 판단이 기준) ──
// 지난달 기수 + 같은 이름 + 같은 비밀번호 + 같은 반(시작반/문풀반) 격일반 + 납부 완료 신청이 있으면 '두 달째'.
// - 시작반 격일반 두 달째: 이어듣기 자동(LC 교재만). 기록이 없으면 처음 듣는 과정(교재 3권).
// - 두 달째는 지난달 반대 요일만: 월·수 → 화·목, 화·목 → 월·수 (요일 미지정 'alt'는 제한 없음)
import { booksFor, calcAmount, isAlt, type CourseId, type Pickup, type Track } from "./config";
import type { Application } from "./db";
import { shiftMonth } from "./signupMonths";

const DAY: Partial<Record<Track, string>> = { alt_mw: "월·수", alt_tt: "화·목" };

export function findPrevAlt(found: Application[], pinOk: (a: Application) => boolean, cohort: string, course: CourseId): Application | null {
  const prev = shiftMonth(cohort, -1);
  return found
    .filter((a) => a.cohort === prev && a.course === course && isAlt(a.track) && (a.status === "paid" || a.status === "shipped") && pinOk(a))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export function requiredAltTrack(prev: Pick<Application, "track"> | null): Track | null {
  if (!prev) return null;
  return prev.track === "alt_mw" ? "alt_tt" : prev.track === "alt_tt" ? "alt_mw" : null;
}

// 두 달째인데 지난달과 같은 요일을 고르면 막아요
export function altTrackError(prev: Pick<Application, "track"> | null, chosen: Track): string | null {
  const need = requiredAltTrack(prev);
  if (!need || !isAlt(chosen) || chosen === need) return null;
  return `지난달 ${DAY[prev!.track]}반을 들었다면 이번 달은 ${DAY[need]}반이에요 (두 달 완성 과정). ${DAY[need]}반을 골라 주세요.`;
}

export const NOT_FOUND_NOTICE = "지난달 격일반 기록을 찾지 못했어요. 처음 듣는 과정(교재 3권)으로 신청돼요. 지난달과 다른 비밀번호를 썼다면 지난달 비밀번호로 다시 입력해 주세요.";

// 교재·금액 (서버 판단): 시작반 격일반은 지난달 기록이 있을 때만 이어듣기
export function planBooks(p: { course: CourseId; track: Track; pickup: Pickup; round: 1 | 2; prev: Application | null; wantContinuing: boolean }) {
  const continuing = p.course === "start" && isAlt(p.track) && !!p.prev;
  const books = booksFor(p.course, p.track, p.round, continuing);
  const notice = p.course === "start" && isAlt(p.track) && p.wantContinuing && !p.prev ? NOT_FOUND_NOTICE : null;
  return { continuing, books, amount: calcAmount(books, p.pickup), notice };
}

// 개강 직전 택배 안내: 학생 반 첫 수업일 3일 전부터 마지막 수업일까지
export function lateDeliveryWarning(today: string, first: string | null, last: string | null) {
  if (!first || !last) return false;
  const from = new Date(Date.parse(`${first}T00:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10);
  return today >= from && today <= last;
}
export const LATE_DELIVERY_TEXT = "📦 지금 신청하면 첫 수업 전에 교재가 도착하기 어려워요 (평일 2~3일). 1층 데스크 수령을 추천해요.";
