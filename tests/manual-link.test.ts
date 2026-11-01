// 입금 수동 연결 · 교재 직접 수정 테스트 (DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { adjustedBooks, classBookOptions, linkCandidates } from "@/lib/manualLink";
import { adjustedSkipped, recalcForRound } from "@/lib/roundRecalc";
import { planCohortMove } from "@/lib/cohortMove";
import type { Application, YbmOrder } from "@/lib/db";

const NOW = Date.parse("2026-11-03T03:00:00Z");
const app = (over: Partial<Application>): Application => ({
  id: "a", cohort: "2026-11", kind: "online", course: "start", track: "all", continuing: false, slot: "am", pickup: "classroom",
  pickup_date: null, pickup_time: null, books: ["concept", "start_rc", "lc1"], name: "연결학생", phone: "01000000000", depositor: "연결학생",
  address: null, amount: 30000, pin_hash: "h", status: "pending", created_at: "2026-11-01T00:00:00Z", ...over,
} as Application);

test("교재 조정 금액: 산 교재만 골라 계산 (택배비 포함), 그 반 교재가 아닌 건 빼요", () => {
  const a = app({});
  assert.deepEqual(classBookOptions(a, 1), ["concept", "start_rc", "lc1"]);
  assert.equal(adjustedBooks(a, 1, ["lc1"]).amount, 10000);
  assert.equal(adjustedBooks({ ...a, pickup: "delivery" }, 1, ["lc1"]).amount, 14000);
  assert.deepEqual(adjustedBooks(a, 1, ["lc1", "solve_rc1"]).books, ["lc1"]);
});

test("금액이 다른 입금 수동 연결: 입금 1만원이면 LC만 골라야 확인돼요", () => {
  const a = app({});
  const r = adjustedBooks(a, 1, ["lc1"]);
  assert.equal(r.amount === 10000, true); // 입금액과 같아서 확인 가능
  assert.equal(adjustedBooks(a, 1, ["concept", "lc1"]).amount === 10000, false); // 다르면 막아요
});

test("[학생 연결] 후보: 입금 대기·자동 취소(7일 안)·관리자 취소, 이번 달·다음 달만", () => {
  const list = [
    app({ id: "p" }),
    app({ id: "t", status: "cancelled", cancel_reason: "timeout", cancelled_at: "2026-11-01T00:00:00Z" }),
    app({ id: "old", status: "cancelled", cancel_reason: "timeout", cancelled_at: "2026-10-20T00:00:00Z" }),
    app({ id: "m", status: "cancelled", cancel_reason: "admin", cancelled_at: "2026-10-01T00:00:00Z" }),
    app({ id: "paid", status: "paid" }),
    app({ id: "oct", cohort: "2026-10" }),
    app({ id: "other", name: "다른학생", depositor: "다른학생" }),
    app({ id: "dep", name: "자녀", depositor: "연결학생" }),
  ];
  const r = linkCandidates(list, [], "연결학생", ["2026-11", "2026-12"], NOW);
  assert.deepEqual(r.apps.map((a) => a.id).sort(), ["dep", "m", "p", "t"]);
});

test("[학생 연결] 인강 주문도 같은 규칙", () => {
  const o = { id: "y", name: "연결학생", depositor: "연결학생", status: "cancelled", cancel_reason: "timeout", cancelled_at: "2026-11-02T00:00:00Z", created_at: "2026-11-02T00:00:00Z" } as YbmOrder;
  assert.equal(linkCandidates([], [o], "연결", ["2026-11"], NOW).orders.length, 1);
});

test("교재 조정 신청은 회차 재계산·기수 이동에서 교재를 바꾸지 않아요", () => {
  const adjusted = app({ id: "adj", books: ["lc2"], amount: 10000, books_adjusted: true });
  assert.equal(recalcForRound([adjusted], "2026-11", 1).length, 0);
  assert.deepEqual(adjustedSkipped([adjusted], "2026-11").map((a) => a.id), ["adj"]);
  const move = planCohortMove(adjusted, "2026-12", 2, []);
  assert.ok(move.ok && move.patch.books.join() === "lc2" && move.patch.amount === 10000);
});
