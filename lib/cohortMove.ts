import { booksFor, calcAmount, isAlt } from "./config";
import type { Application } from "./db";

// 신청 기수 옮기기: 교재는 새 기수의 교재 회차로 다시 계산하고, 금액이 달라지면 새 금액으로 바꿔요.
// 납부 상태·수강 시간·수강 형태·비밀번호는 그대로예요.
export type CohortMove =
  | { ok: true; patch: Pick<Application, "cohort" | "books" | "amount">; amountChanged: boolean }
  | { ok: false; error: string };

export function planCohortMove(a: Application, target: string, round: 1 | 2, all: Pick<Application, "id" | "cohort" | "name" | "status">[], force = false): CohortMove {
  if (!/^\d{4}-\d{2}$/.test(target)) return { ok: false, error: "옮길 기수를 골라 주세요." };
  if (a.cohort === target) return { ok: false, error: `${a.name}: 이미 그 기수예요.` };
  // 옮길 기수에 같은 이름 신청(환불 제외)이 있으면 막아요. 비밀번호는 암호화돼 있어 같은지 비교할 수 없어서
  // 이름으로 확인하고, 동명이인이면 '같은 이름이 있어도 옮기기'(force)로 옮겨요.
  if (!force && all.some((x) => x.id !== a.id && x.cohort === target && x.name === a.name && x.status !== "refunded")) {
    return { ok: false, error: `${a.name}: 옮길 기수에 같은 이름 신청이 이미 있어요 (같은 학생이면 중복이에요. 동명이인이면 '같은 이름이 있어도 옮기기'를 체크)` };
  }
  const continuing = a.course === "start" && isAlt(a.track) && a.continuing;
  const books = booksFor(a.course, a.track, round, continuing);
  const amount = calcAmount(books, a.pickup);
  return { ok: true, patch: { cohort: target, books, amount }, amountChanged: amount !== a.amount };
}

// 고를 수 있는 기수: 이번 달 ~ 다음 달
export function movableCohorts(thisMonth: string) {
  const [y, m] = thisMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return [thisMonth, `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`];
}
