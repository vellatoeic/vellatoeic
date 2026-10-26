// 신청 기수 변경 규칙 테스트 (DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { planCohortMove, movableCohorts } from "@/lib/cohortMove";
import type { Application } from "@/lib/db";

const app = (over: Partial<Application> = {}): Application => ({
  id: "a1", cohort: "2026-10", kind: "online", course: "solve", track: "all", continuing: false, slot: "pm", pickup: "delivery",
  pickup_date: null, pickup_time: null, books: ["solve_rc2", "lc2"], name: "김이동", phone: "01000000000", depositor: "김이동",
  address: "부산", amount: 24000, pin_hash: "h1", status: "paid", created_at: "2026-10-01T00:00:00Z", ...over,
} as Application);

test("고를 수 있는 기수: 이번 달 ~ 다음 달 (연말 넘김 포함)", () => {
  assert.deepEqual(movableCohorts("2026-10"), ["2026-10", "2026-11"]);
  assert.deepEqual(movableCohorts("2026-12"), ["2026-12", "2027-01"]);
});

test("기수를 옮기면 교재를 새 회차로 다시 계산하고, 금액이 같으면 그대로", () => {
  const r = planCohortMove(app(), "2026-11", 1, [app()]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.patch.books, ["solve_rc1", "lc1"]);
  assert.equal(r.patch.amount, 24000);
  assert.equal(r.amountChanged, false);
  assert.equal(r.patch.cohort, "2026-11");
  assert.equal("status" in r.patch || "slot" in r.patch || "kind" in r.patch || "pin_hash" in r.patch, false);
});

test("금액이 달라지면 새 금액과 '금액 변경됨'", () => {
  const r = planCohortMove(app({ amount: 20000 }), "2026-11", 1, []);
  assert.equal(r.ok && r.amountChanged, true);
  assert.equal(r.ok && r.patch.amount, 24000);
});

test("옮길 기수에 같은 이름 신청이 있으면 막고, 동명이인이면 체크해서 옮겨요", () => {
  const other = { id: "b1", cohort: "2026-11", name: "김이동", status: "paid" as const };
  assert.equal(planCohortMove(app(), "2026-11", 1, [app(), other]).ok, false);
  assert.equal(planCohortMove(app(), "2026-11", 1, [app(), other], true).ok, true);
  // 환불된 신청은 겹쳐도 괜찮아요
  assert.equal(planCohortMove(app(), "2026-11", 1, [app(), { ...other, status: "refunded" as const }]).ok, true);
});

test("같은 기수로는 옮기지 않아요", () => {
  assert.equal(planCohortMove(app(), "2026-10", 2, []).ok, false);
});
