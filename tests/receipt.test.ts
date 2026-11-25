// 수강증 자동 확인 — 읽은 글자 → 우리 신청서의 반 (OCR·DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeReceipt, nameOnReceipt } from "@/lib/receipt/analyze";
import { sectionsFor, timeBlockOf, type ReceiptClass } from "@/lib/receipt/classes";
import type { Section } from "@/lib/receipt/match";
import { receiptVerdict, type CheckForVerdict } from "@/lib/receipt/verdict";
import { card } from "./receipt-kit/fixtures";

const here = path.dirname(fileURLToPath(import.meta.url));
const kitSections = (JSON.parse(fs.readFileSync(path.join(here, "receipt-kit/sections.sample.json"), "utf8")) as { sections: Section[] }).sections;
const key = (s: Section) => `${s.level}|${s.program}|${s.kind}|${s.track}|${s.timeBlock}`;
const cls = (cohort: string, course: ReceiptClass["course"], track: ReceiptClass["track"], slot: ReceiptClass["slot"]): ReceiptClass => ({ cohort, course, track, slot });
const DEC = ["2026-12"];
const TODAY = "2026-11-26";

test("반 목록: 한 달 22개, YBM 강좌 페이지 12월 반(키트 목록)과 레벨·과정·종합/단과·요일·시간이 똑같아요", () => {
  const ours = sectionsFor(DEC);
  assert.equal(ours.length, 22);
  assert.deepEqual(ours.map(key).sort(), kitSections.map(key).sort());
});

test("단과 시간은 60분, 종합·격일은 반 시간 그대로", () => {
  assert.equal(timeBlockOf({ course: "start", track: "rc" }, "am"), "10:00~11:00");
  assert.equal(timeBlockOf({ course: "start", track: "rc" }, "pm"), "20:20~21:20");
  assert.equal(timeBlockOf({ course: "solve", track: "rc" }, "am"), "12:20~13:20");
  assert.equal(timeBlockOf({ course: "solve", track: "lc" }, "pm"), "19:10~20:10");
  assert.equal(timeBlockOf({ course: "solve", track: "alt_tt" }, "pm"), "18:00~20:10");
  assert.equal(timeBlockOf({ course: "intensive", track: "all" }, "am"), "10:00~13:20");
});

test("12월 문풀반 종합 저녁 현장 (기본 수강증) → 바로 확인", () => {
  const r = analyzeReceipt(card(), DEC, TODAY);
  assert.equal(r.status, "match");
  assert.deepEqual(r.classes, [cls("2026-12", "solve", "all", "pm")]);
  assert.equal(r.kind, "onsite");
  assert.equal(r.receiptName, "홍길동");
  assert.equal(r.capturedAt, "2026-11-24T19:01:58");
});

test("시작반 종합 오전 불라방 · LC 단과 · RC 단과 · 속성반", () => {
  const online = analyzeReceipt(card({ goal: "650 목표", level: "650+", room: "온라인 강의", days: "[4주-12/01] 월화수목 (월16회 라이브방송)", time: "10:00~12:10" }), DEC, TODAY);
  assert.equal(online.status, "match");
  assert.deepEqual(online.classes, [cls("2026-12", "start", "all", "am")]);
  assert.equal(online.kind, "online");

  const lc = analyzeReceipt(card({ title: "[LC]", goal: "650 목표", level: "650+", time: "19:10~20:10" }), DEC, TODAY);
  assert.deepEqual(lc.classes, [cls("2026-12", "start", "lc", "pm")]);

  const rc = analyzeReceipt(card({ title: "[RC]", time: "12:20~13:20" }), DEC, TODAY);
  assert.deepEqual(rc.classes, [cls("2026-12", "solve", "rc", "am")]);

  const premier = analyzeReceipt(card({ level: "실전속성", days: "[4주-12/01] 월화수목 (월16회) 프리미어반", time: "10:00~13:20" }), DEC, TODAY);
  assert.equal(premier.status, "match");
  assert.deepEqual(premier.classes, [cls("2026-12", "intensive", "all", "am")]);
});

test("격일반 2개월 과정: 12월 월수 → 12월만 받으면 12월 월수, 1월도 받으면 1월 화목까지", () => {
  const t = card({ goal: "650 목표", level: "650+", days: "[4주-12/01] 월수 (월8회)", time: "19:10~21:20" });
  assert.deepEqual(analyzeReceipt(t, DEC, TODAY).classes, [cls("2026-12", "start", "alt_mw", "pm")]);
  assert.deepEqual(analyzeReceipt(t, ["2026-12", "2027-01"], "2026-12-15").classes, [cls("2026-12", "start", "alt_mw", "pm"), cls("2027-01", "start", "alt_tt", "pm")]);
});

test("11월 화목 2개월 수강증으로 12월(두 달째)을 신청하면 12월 월수반", () => {
  const t = card({ month: "11월 과정", goal: "650 목표", level: "650+", days: "[4주-11/03] 화목 (월8회)", time: "19:10~21:20" });
  const r = analyzeReceipt(t, DEC, TODAY);
  assert.equal(r.status, "match");
  assert.deepEqual(r.classes, [cls("2026-12", "start", "alt_mw", "pm")]);
});

test("11월 종합반 수강증은 12월 신청에 못 써요 → 다시 올려 달라고 안내", () => {
  const r = analyzeReceipt(card({ month: "11월 과정", days: "[4주-11/02] 월화수목 (월16회)" }), DEC, TODAY);
  assert.equal(r.status, "reject");
  assert.match(r.message, /11월 과정 수강증이에요\. 지금은 12월 수업 신청만 받아요/);
});

test("제목 첫 글자 오인식(켈라토익) + 강사 칸 정확 → 그대로 확인 / 강사 칸도 없으면 선생님 확인(반은 골라 둠)", () => {
  assert.equal(analyzeReceipt(card().replace("벨라토익", "켈라토익"), DEC, TODAY).status, "match");
  const r = analyzeReceipt(card().replace("벨라토익", "켈라토익").replace("강사 _ 벨라(김지민)", ""), DEC, TODAY);
  assert.equal(r.status, "review");
  assert.deepEqual(r.classes, [cls("2026-12", "solve", "all", "pm")]);
  assert.ok(r.reasons.some((x) => x.includes("벨라토익")));
});

test("강의실 칸을 못 읽으면 현장/불라방을 모르니 선생님 확인", () => {
  const r = analyzeReceipt(card({ room: "" }), DEC, TODAY);
  assert.equal(r.status, "review");
  assert.equal(r.kind, null);
});

test("카톡 대화 같은 다른 화면 → 거절, 시간이 없는 반 → 직접 고르기", () => {
  const kakao = "쌤 저 12월 수강 신청 완료했어요! 벨라토익 750 목표 저녁반 18:00~20:10으로 들을게요\n서면 가는 길에 교재비도 입금할게요 감사합니다";
  assert.equal(analyzeReceipt(kakao, DEC, TODAY).status, "reject");
  // 글자가 너무 적으면(40자 미만) 거절하지 않고 선생님 확인
  assert.equal(analyzeReceipt("벨라토익 750 18:00~20:10", DEC, TODAY).status, "review");
  const none = analyzeReceipt(card({ time: "14:00~16:10" }), DEC, TODAY);
  assert.equal(none.status, "review");
  assert.deepEqual(none.classes, []);
});

test("제출할 때 이름 확인: 수강생 칸 값과 같아야(띄어쓰기 무시)", () => {
  const t = card({ name: "홍길동" });
  assert.equal(nameOnReceipt(t, "홍길동"), true);
  assert.equal(nameOnReceipt(t, "홍 길동"), true);
  assert.equal(nameOnReceipt(t, "김철수"), false);
  assert.equal(nameOnReceipt(t, "홍길"), false);
});

// ── 제출할 때 판정 ──
const matched = (over: Partial<CheckForVerdict> = {}): CheckForVerdict => {
  const r = analyzeReceipt(card(), DEC, TODAY);
  return { outcome: r.status, classes: r.classes, kind: r.kind, receipt_name: r.receiptName, ocr_text: card(), reasons: r.reasons, ...over };
};
const sub = { cohort: "2026-12", course: "solve" as const, track: "all" as const, slot: "pm" as const, kind: "onsite" as const, name: "홍길동" };

test("제출: 수강증과 반·형태·이름이 같으면 자동 확인", () => {
  assert.deepEqual(receiptVerdict(matched(), sub, false), { status: "auto", reasons: [] });
});

test("제출: 수강증과 다른 반·다른 형태는 막아요 (직접 고르기를 누르면 선생님 확인으로 받아요)", () => {
  const wrongClass = receiptVerdict(matched(), { ...sub, course: "start" }, false);
  assert.ok("error" in wrongClass && wrongClass.error.includes("12월 문풀반 주 4일(종합반) · 저녁반"));
  // 현장 수강증 → 불라방 신청은 전환이라 괜찮아요 / 불라방 수강증 → 현장 신청은 막아요
  assert.deepEqual(receiptVerdict(matched(), { ...sub, kind: "online" }, false), { status: "auto", reasons: [] });
  const wrongKind = receiptVerdict(matched({ kind: "online" }), sub, false);
  assert.ok("error" in wrongKind && wrongKind.error.includes("불라방 수강증이에요. 불라방 신청서에서"));
  const overridden = receiptVerdict(matched(), { ...sub, course: "start" }, true);
  assert.ok("status" in overridden && overridden.status === "review" && overridden.reasons.some((x) => x.includes("다른 반")));
});

test("제출: 이름이 다르면 선생님 확인 (이름을 나란히 남겨요)", () => {
  const r = receiptVerdict(matched(), { ...sub, name: "김철수" }, false);
  assert.ok("status" in r && r.status === "review");
  assert.ok("status" in r && r.reasons.includes("수강생 이름이 달라요 (수강증 홍길동 · 신청서 김철수)"));
});

test("제출: 다른 학생이 같은 수강증으로 이미 신청했으면 선생님 확인, 같은 학생(두 달째)은 괜찮아요", () => {
  const r = receiptVerdict(matched(), sub, false, ["박영희"]);
  assert.ok("status" in r && r.status === "review" && r.reasons.some((x) => x.includes("박영희")));
  assert.deepEqual(receiptVerdict(matched(), sub, false, ["홍길동"]), { status: "auto", reasons: [] });
});

test("제출: 읽지 못했거나 애매했던 수강증은 학생이 고른 반으로 받고 선생님 확인", () => {
  const r = receiptVerdict({ outcome: "skipped", classes: [], kind: null, receipt_name: null, ocr_text: null, reasons: ["글자 읽기를 꺼 둔 동안 올린 수강증"] }, sub, false);
  assert.deepEqual(r, { status: "review", reasons: ["글자 읽기를 꺼 둔 동안 올린 수강증"] });
});
