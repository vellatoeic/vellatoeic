// 운영 자동화 + 중간 등록 시나리오 테스트 (임시 저장소에서만)
import { test } from "node:test";
import assert from "node:assert/strict";
import { secondWeekLastDay, signupMonthsFor } from "@/lib/signupMonths";
import { audioWindowFor } from "@/lib/audio";
import { liveFor, popupNotices, readKey, type Notice } from "@/lib/notices";
import { createApplication, getApplication, isPreview, updateApplication } from "@/lib/db";
import { hashPin } from "@/lib/auth";
import { studentTests } from "@/lib/dailyTests";
import { monthlyChecklist, targetCohort } from "@/lib/monthlyChecklist";

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

// 10월 시작반 종합: 10/5 개천절 대체, 10/9 한글날 → 1주차 10/6~8, 2주차 10/12~15
const oct = ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-19", "2026-10-29"];
const nov = ["2026-11-02", "2026-11-26"];

// ── A) 신청서 수강 월 ──
test("A: 2주차 마지막 수업일 = 10/15", () => assert.equal(secondWeekLastDay(oct), "2026-10-15"));

test("A: 10/9 신청서 → 이번 달(10월)만", () => {
  assert.deepEqual(signupMonthsFor("2026-10-09", oct, nov).map((m) => m.cohort), ["2026-10"]);
});

test("A: 10/15 → 10월·11월 둘 다 (기간 표시 포함)", () => {
  const m = signupMonthsFor("2026-10-15", oct, nov);
  assert.deepEqual(m.map((x) => x.cohort), ["2026-10", "2026-11"]);
  assert.equal(m[1].label, "11월 수업");
  assert.equal(m[1].range, "11/2~11/26");
});

test("A: 10/16 (중간 등록 마감 후) → 다음 달만", () => {
  assert.deepEqual(signupMonthsFor("2026-10-16", oct, nov).map((m) => m.cohort), ["2026-11"]);
});

test("A: 월초 개강 전(11/1) → 이번 달(11월)만, 다음 달은 15일부터", () => {
  assert.deepEqual(signupMonthsFor("2026-11-01", ["2026-11-02", "2026-11-03", "2026-11-09", "2026-11-12"], []).map((m) => m.cohort), ["2026-11"]);
});

// ── C) LC 음원 기간 ──
test("C: 개강 전에 납부하면 반 첫 수업일부터 14일", () => {
  assert.deepEqual(audioWindowFor("2026-10-06", "2026-09-30T05:00:00Z", null), { start: "2026-10-06", end: "2026-10-19" });
});

test("C: 중간 등록생은 납부 확인일부터 14일 보장", () => {
  assert.deepEqual(audioWindowFor("2026-10-06", "2026-10-13T05:00:00Z", null), { start: "2026-10-13", end: "2026-10-26" });
});

test("C: [음원 7일 다시 열기]로 늘어난 날까지", () => {
  assert.equal(audioWindowFor("2026-10-06", null, "2026-10-30").end, "2026-10-30");
  assert.equal(audioWindowFor("2026-10-06", null, "2026-10-10").end, "2026-10-19"); // 원래 기간보다 짧으면 그대로
});

// ── D) 매달 반복 공지 ──
const repeatNotice: Notice = {
  id: "n1", title: "첫 주 안내", to_label: "", lead: "", sections: [], link_label: null, link_url: null, targets: [],
  starts_on: "2026-10-01", ends_on: "2099-12-31", popup: true, pinned: false, repeat_monthly: true, repeat_days: 7, created_at: "2026-10-01T00:00:00Z",
};
const tt = { course: "start" as const, track: "alt_tt" as const, kind: "onsite" as const, slot: "am" as const };

test("D: 화목반은 화요일 개강일부터 7일 동안", () => {
  const s = [{ ...tt, cohort: "2026-10", start: "2026-10-06" }];
  assert.equal(liveFor(repeatNotice, s, "2026-10-05"), false);
  assert.equal(liveFor(repeatNotice, s, "2026-10-06"), true);
  assert.equal(liveFor(repeatNotice, s, "2026-10-12"), true);
  assert.equal(liveFor(repeatNotice, s, "2026-10-13"), false);
});

test("D: 10월에 확인했어도 11월 개강하면 다시 떠요", () => {
  const read = new Set([readKey(repeatNotice, "2026-10")]);
  assert.equal(popupNotices([repeatNotice], [{ ...tt, cohort: "2026-10", start: "2026-10-06" }], read, "2026-10-07").length, 0);
  assert.equal(popupNotices([repeatNotice], [{ ...tt, cohort: "2026-11", start: "2026-11-03" }], read, "2026-11-03").length, 1);
});

test("D: 중간 등록생은 신청 후 첫 수업일부터 n일", () => {
  assert.equal(liveFor(repeatNotice, [{ ...tt, cohort: "2026-10", start: "2026-10-13" }], "2026-10-19"), true);
});

// ── H) 중간 등록생: 신청 전 테스트는 밀린 테스트에 안 나와요 ──
test("H: 10/9 신청한 문풀반 학생의 밀린 테스트는 10/12 이후만", async () => {
  const id = await createApplication({
    cohort: "2026-10", kind: "onsite", course: "solve", track: "all", continuing: false, slot: "am", pickup_date: null, pickup_time: null,
    books: ["solve_rc2", "lc2"], pickup: "classroom", name: "중간등록", phone: null, depositor: "중간등록", address: null, amount: 20000, pin_hash: hashPin("1234"),
  });
  await updateApplication(id, { status: "paid" });
  const app = (await getApplication(id))!;
  app.created_at = "2026-10-09T03:00:00Z";
  const { missed } = await studentTests(app, "2026-10-14");
  assert.ok(missed.length > 0);
  assert.ok(missed.every((t) => t.day >= "2026-10-12"), missed.map((t) => t.day).join(","));
  // 납부 확인 시각이 남아요 (음원 기간 시작)
  assert.ok(app.paid_at);
});

// ── B) 이번 달 할 일 ──
test("B: 개강 후에는 다음 달, 개강 전(월초)에는 이번 달을 준비해요", async () => {
  assert.equal(await targetCohort("2026-10-27"), "2026-11");
  assert.equal(await targetCohort("2026-11-01"), "2026-11");
});

test("B: 날짜가 안 된 항목은 회색 '○일부터'", async () => {
  const { items } = await monthlyChecklist("2026-10-10");
  const audio = items.find((i) => i.key === "audio")!;
  assert.equal(audio.state, "later");
  assert.equal(audio.from, "2026-10-26"); // 11/2 개강 7일 전
  assert.equal(items.find((i) => i.key === "special")!.state, "later"); // 20일부터
  const later = await monthlyChecklist("2026-10-27");
  assert.equal(later.items.find((i) => i.key === "audio")!.state, "todo");
});
