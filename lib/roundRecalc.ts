// ── 교재 회차를 바꾸면 그 기수 신청 교재 다시 계산 (DB 없이 계산) ──
// 입금 대기·납부 완료·발송 완료 신청(취소·환불 제외)의 교재를 새 회차로. 금액이 같으면 그대로,
// 다르면 입금 대기만 새 금액, 납부 완료·발송 완료는 금액을 유지하고 차이만 알려요.
import { booksFor, calcAmount, isAlt, type BookId } from "./config";
import type { Application } from "./db";

export type RoundChange = { app: Application; books: BookId[]; amount: number; diff: number };

export function recalcForRound(apps: Application[], cohort: string, round: 1 | 2): RoundChange[] {
  return apps
    .filter((a) => a.cohort === cohort && (a.status === "pending" || a.status === "paid" || a.status === "shipped"))
    .map((a) => {
      const books = booksFor(a.course, a.track, round, a.course === "start" && isAlt(a.track) && a.continuing);
      const fresh = calcAmount(books, a.pickup);
      return { app: a, books, amount: a.status === "pending" ? fresh : a.amount, diff: fresh - a.amount };
    })
    .filter((c) => c.books.join(",") !== c.app.books.join(",") || c.amount !== c.app.amount);
}
