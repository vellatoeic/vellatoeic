// ── 입금 기록 수동 연결 · 교재 직접 수정 (DB 없이 계산) ──
import { BOOKS, booksFor, calcAmount, type BookId } from "./config";
import type { Application, YbmOrder } from "./db";

// 그 반 교재 목록 (그 기수 회차 기준 전체 교재). 이 중에서 산 교재만 골라요.
export const classBookOptions = (a: Pick<Application, "course" | "track">, round: 1 | 2): BookId[] => booksFor(a.course, a.track, round, false);

// 고른 교재가 그 반 교재 안에 있는지 확인하고 금액(택배비 포함)을 계산
export function adjustedBooks(a: Pick<Application, "course" | "track" | "pickup">, round: 1 | 2, picked: string[]) {
  const options = classBookOptions(a, round);
  const books = options.filter((b) => picked.includes(b));
  return { books, amount: calcAmount(books, a.pickup), labels: books.map((b) => BOOKS[b]) };
}

const norm = (s: string) => s.replace(/\s+/g, "");

// [학생 연결] 후보: 이름·입금자명이 같은(또는 검색어를 포함한) 신청 — 이번 달·다음 달, 입금 대기 + 자동 취소(7일 안) + 관리자 취소
export function linkCandidates(apps: Application[], orders: YbmOrder[], query: string, months: string[], nowMs = Date.now()) {
  const q = norm(query);
  const recent = (iso?: string | null) => !!iso && Date.parse(iso) >= nowMs - 7 * 86400000;
  const okStatus = (x: { status: string; cancel_reason?: string | null; cancelled_at?: string | null }) =>
    x.status === "pending" || (x.status === "cancelled" && (x.cancel_reason === "admin" || (x.cancel_reason === "timeout" && recent(x.cancelled_at))));
  const hit = (x: { name: string; depositor: string }) => !!q && (norm(x.name).includes(q) || norm(x.depositor).includes(q));
  return {
    apps: apps.filter((a) => months.includes(a.cohort) && okStatus(a) && hit(a)).sort((x, y) => y.created_at.localeCompare(x.created_at)),
    orders: orders.filter((o) => okStatus(o) && hit(o)).sort((x, y) => y.created_at.localeCompare(x.created_at)),
  };
}
