// 격일반 이어듣기·두 달째 요일·개강 직전 택배 안내 테스트 (DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { altTrackError, findPrevAlt, lateDeliveryWarning, planBooks, NOT_FOUND_NOTICE } from "@/lib/altContinue";
import type { Application } from "@/lib/db";
import { hashPin, checkPin } from "@/lib/auth";

const app = (over: Partial<Application>): Application => ({
  id: "x", cohort: "2026-10", kind: "onsite", course: "start", track: "alt_mw", continuing: false, slot: "am", pickup: "classroom",
  pickup_date: null, pickup_time: null, books: [], name: "이어듣기", phone: null, depositor: "이어듣기", address: null, amount: 30000,
  pin_hash: hashPin("1234"), status: "paid", created_at: "2026-10-01T00:00:00Z", ...over,
} as Application);
const pin = (p: string) => (a: Application) => checkPin(p, a.pin_hash);

test("지난달 격일반 기록 있음 → 시작반 이어듣기 자동 (LC 교재만)", () => {
  const prev = findPrevAlt([app({})], pin("1234"), "2026-11", "start");
  assert.ok(prev);
  const plan = planBooks({ course: "start", track: "alt_tt", pickup: "classroom", round: 1, prev, wantContinuing: false });
  assert.equal(plan.continuing, true);
  assert.equal(plan.books.length, 1);
  assert.equal(plan.amount, 10000);
});

test("기록 없음 → 처음 듣는 과정(교재 3권), '네'를 골랐으면 안내", () => {
  const plan = planBooks({ course: "start", track: "alt_tt", pickup: "classroom", round: 1, prev: null, wantContinuing: true });
  assert.equal(plan.continuing, false);
  assert.equal(plan.books.length, 3);
  assert.equal(plan.notice, NOT_FOUND_NOTICE);
});

test("다른 비밀번호·미납·다른 반·두 달 전 기록은 못 찾아요", () => {
  assert.equal(findPrevAlt([app({})], pin("9999"), "2026-11", "start"), null);
  assert.equal(findPrevAlt([app({ status: "pending" })], pin("1234"), "2026-11", "start"), null);
  assert.equal(findPrevAlt([app({ course: "solve" })], pin("1234"), "2026-11", "start"), null);
  assert.equal(findPrevAlt([app({ cohort: "2026-09" })], pin("1234"), "2026-11", "start"), null);
  assert.equal(findPrevAlt([app({ track: "all" })], pin("1234"), "2026-11", "start"), null);
});

test("두 달째: 월·수 → 화·목만, 화·목 → 월·수만 (시작반·문풀반 모두)", () => {
  assert.equal(altTrackError({ track: "alt_mw" }, "alt_tt"), null);
  assert.match(altTrackError({ track: "alt_mw" }, "alt_mw")!, /지난달 월·수반을 들었다면 이번 달은 화·목반이에요/);
  assert.equal(altTrackError({ track: "alt_tt" }, "alt_mw"), null);
  assert.match(altTrackError({ track: "alt_tt" }, "alt_tt")!, /이번 달은 월·수반이에요/);
  const solvePrev = findPrevAlt([app({ course: "solve", track: "alt_tt" })], pin("1234"), "2026-11", "solve");
  assert.ok(altTrackError(solvePrev, "alt_tt"));
  // 문풀반은 이어듣기 할인이 없어 교재 그대로
  assert.equal(planBooks({ course: "solve", track: "alt_mw", pickup: "classroom", round: 1, prev: solvePrev, wantContinuing: false }).continuing, false);
});

test("처음 듣는 학생은 요일 제한 없음", () => {
  assert.equal(altTrackError(null, "alt_mw"), null);
  assert.equal(altTrackError(null, "alt_tt"), null);
});

test("개강 직전 택배 안내: 첫 수업일 3일 전부터 마지막 수업일까지", () => {
  assert.equal(lateDeliveryWarning("2026-10-29", "2026-11-02", "2026-11-26"), false);
  assert.equal(lateDeliveryWarning("2026-10-30", "2026-11-02", "2026-11-26"), true);
  assert.equal(lateDeliveryWarning("2026-11-26", "2026-11-02", "2026-11-26"), true);
  assert.equal(lateDeliveryWarning("2026-11-27", "2026-11-02", "2026-11-26"), false);
});
