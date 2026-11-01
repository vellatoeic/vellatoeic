// 교재 회차 저장 버그 · 회차 변경 시 교재 재계산 테스트
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recalcForRound } from "@/lib/roundRecalc";
import { roundOf } from "@/lib/config";
import type { Application } from "@/lib/db";

const app = (over: Partial<Application>): Application => ({
  id: "x", cohort: "2026-11", kind: "online", course: "start", track: "all", continuing: false, slot: "am", pickup: "delivery",
  pickup_date: null, pickup_time: null, books: ["concept", "start_rc", "lc2"], name: "회차", phone: "01000000000", depositor: "회차",
  address: "부산", amount: 34000, pin_hash: "h", status: "pending", created_at: "2026-10-20T00:00:00Z", ...over,
} as Application);

test("기본 설정 저장(saveSettings)은 교재 회차를 건드리지 않아요 (모집 기수를 바꿔도 회차 그대로)", () => {
  const src = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("export async function saveSettings"), src.indexOf("\n}\n", src.indexOf("export async function saveSettings")));
  assert.ok(body.length > 0);
  assert.equal(/round_/.test(body), false);
});

test("11월 자동 회차는 1회차", () => assert.equal(roundOf("2026-11"), 1));

test("회차를 1로 바꾸면 시작반 LC2 → LC1, 문풀반 RC2·LC2 → RC1·LC1", () => {
  const start = app({ id: "s" });
  const solve = app({ id: "v", course: "solve", books: ["solve_rc2", "lc2"], amount: 24000 });
  const changes = recalcForRound([start, solve], "2026-11", 1);
  assert.deepEqual(changes.find((c) => c.app.id === "s")!.books, ["concept", "start_rc", "lc1"]);
  assert.deepEqual(changes.find((c) => c.app.id === "v")!.books, ["solve_rc1", "lc1"]);
  assert.ok(changes.every((c) => c.diff === 0)); // 권수가 같아 금액은 그대로
});

test("취소·환불·다른 기수는 건드리지 않고, 이미 맞는 신청은 목록에 없어요", () => {
  const list = [
    app({ id: "c", status: "cancelled" }), app({ id: "r", status: "refunded" }),
    app({ id: "o", cohort: "2026-10" }), app({ id: "ok", books: ["concept", "start_rc", "lc1"] }),
  ];
  assert.equal(recalcForRound(list, "2026-11", 1).length, 0);
});

test("금액이 달라지면 입금 대기만 새 금액, 납부 완료는 금액 유지하고 차이만", () => {
  const pend = app({ id: "p", amount: 20000 }); // 잘못 저장된 금액
  const paid = app({ id: "q", amount: 20000, status: "paid" });
  const [a, b] = recalcForRound([pend, paid], "2026-11", 1);
  assert.equal(a.amount, 34000);
  assert.equal(b.amount, 20000);
  assert.equal(b.diff, 14000);
});
