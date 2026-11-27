// 학생 '내 정보' (처음 로그인 뒤 한 장에 한 질문)
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPhone, cleanReasons, cleanTarget, phoneLabel, profileDone, stepsLeft } from "@/lib/profile";

test("남은 질문: 연결 → 휴대폰 → 목표 점수 → 공부 이유 순서, 다 하면 끝", () => {
  assert.deepEqual(stepsLeft(null, true), ["link", "phone", "target", "reason"]);
  assert.deepEqual(stepsLeft(null, false), ["phone", "target", "reason"]);
  assert.deepEqual(stepsLeft({ phone: "01012345678", target_score: null, reasons: [] }, false), ["target", "reason"]);
  assert.deepEqual(stepsLeft({ phone: "01012345678", target_score: 750, reasons: ["job"] }, false), []);
  assert.equal(profileDone({ phone: "01012345678", target_score: 750, reasons: ["job"] }), true);
  assert.equal(profileDone({ phone: "01012345678", target_score: 750, reasons: [] }), false);
});

test("휴대폰: 하이픈·공백 무시, 010으로 시작하는 10~11자리만", () => {
  assert.equal(cleanPhone("010-1234-5678"), "01012345678");
  assert.equal(cleanPhone(" 010 123 4567 "), "0101234567");
  assert.equal(cleanPhone("02-123-4567"), null);
  assert.equal(cleanPhone("010-1234"), null);
  assert.equal(phoneLabel("01012345678"), "010-1234-5678");
});

test("목표 점수: 10~990, 5점 단위로", () => {
  assert.equal(cleanTarget("750"), 750);
  assert.equal(cleanTarget("753"), 755);
  assert.equal(cleanTarget("0"), null);
  assert.equal(cleanTarget("1000"), null);
  assert.equal(cleanTarget("점수"), null);
});

test("공부 이유: 정해진 카드만, 겹치지 않게", () => {
  assert.deepEqual(cleanReasons(["job", "job", "hack", "etc"]), ["job", "etc"]);
  assert.deepEqual(cleanReasons([]), []);
});
