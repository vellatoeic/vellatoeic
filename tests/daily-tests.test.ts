// 문풀반 데일리 테스트 번호 규칙 테스트 (DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTestAnswer, testPlan, testsForClassDay } from "@/lib/tests";
import { schoolDaysFor } from "@/lib/schedule";

const oct = schoolDaysFor("", "2026-10", "solve-all");
const nov = schoolDaysFor("", "2026-11", "solve-all");

test("DAY 1은 테스트 없음, DAY 2부터 단어 1번", () => {
  const p = testPlan("2026-10", oct);
  assert.deepEqual(p.get(oct[0]), []);
  assert.deepEqual(p.get(oct[1])?.find((t) => t.kind === "word"), { kind: "word", no: 1, questions: 20 });
});

test("짝수달(10월) RC는 21번부터, 21번은 25문항·이후 30문항", () => {
  const p = testPlan("2026-10", oct);
  assert.deepEqual(p.get(oct[1])?.find((t) => t.kind === "rc"), { kind: "rc", no: 21, questions: 25 });
  assert.deepEqual(p.get(oct[2])?.find((t) => t.kind === "rc"), { kind: "rc", no: 22, questions: 30 });
});

test("홀수달(11월) RC는 1번부터, 1번은 25문항", () => {
  const p = testPlan("2026-11", nov);
  assert.deepEqual(p.get(nov[1])?.find((t) => t.kind === "rc"), { kind: "rc", no: 1, questions: 25 });
});

test("RC는 한 달 20개까지, 그 뒤 수업일은 단어만", () => {
  const days = Array.from({ length: 24 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
  const p = testPlan("2026-11", days);
  assert.equal(p.get(days[20])?.find((t) => t.kind === "rc")?.no, 20); // DAY 21 → RC 20
  assert.equal(p.get(days[21])?.find((t) => t.kind === "rc"), undefined); // DAY 22 → RC 없음
  assert.equal(p.get(days[21])?.find((t) => t.kind === "word")?.no, 21);
});

test("격일반은 본인 수업일에만, 그날 종합 번호를 그대로", () => {
  const p = testPlan("2026-10", oct);
  const mw = schoolDaysFor("", "2026-10", "solve-mw");
  for (const d of oct) {
    const t = testsForClassDay(p, mw, d);
    if (mw.includes(d)) assert.deepEqual(t, p.get(d));
    else assert.deepEqual(t, []);
  }
});

test("관리자 수정이 우선해요 (번호·문항 바꾸기, 없음으로 만들기)", () => {
  const p = testPlan("2026-10", oct, [
    { day: oct[2], kind: "rc", test_no: 25, questions: 28 },
    { day: oct[3], kind: "word", test_no: null, questions: null },
  ]);
  assert.deepEqual(p.get(oct[2])?.find((t) => t.kind === "rc"), { kind: "rc", no: 25, questions: 28 });
  assert.equal(p.get(oct[3])?.find((t) => t.kind === "word"), undefined);
});

test("맞은 개수와 틀린 번호 확인", () => {
  assert.equal(checkTestAnswer(30, 27, [3, 8, 12]), null);
  assert.equal(checkTestAnswer(30, 27, []), null);
  assert.match(checkTestAnswer(30, 27, [3, 8]) ?? "", /맞지 않아요/);
  assert.match(checkTestAnswer(20, 21, []) ?? "", /0~20/);
});

// ── 학생별 통계 (임시 저장소의 가짜 학생으로) ──
import { createApplication, isPreview, saveTestResult, updateApplications } from "@/lib/db";
import { cohortTestStats, takesTests } from "@/lib/dailyTests";
import { hashPin } from "@/lib/auth";
import type { CourseId, Track } from "@/lib/config";

async function student(name: string, course: CourseId, track: Track, paid = true) {
  const id = await createApplication({
    cohort: "2026-10", kind: "online", course, track, continuing: false, slot: "am", pickup_date: null, pickup_time: null,
    books: [], pickup: "classroom", name, phone: "01000000000", depositor: name, address: null, amount: 0, pin_hash: hashPin("1234"),
  });
  if (paid) await updateApplications([id], { status: "paid" });
  return id;
}

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

test("테스트 대상: 문풀반·속성반 납부 완료만 (시작반·입금 대기 X)", async () => {
  await student("문풀가", "solve", "all");
  await student("속성가", "intensive", "all");
  await student("시작가", "start", "all");
  await student("미납가", "solve", "all", false);
  const { stats } = await cohortTestStats("2026-10", "2026-10-12");
  const names = stats.map((s) => s.app.name);
  assert.ok(names.includes("문풀가") && names.includes("속성가"));
  assert.ok(!names.includes("시작가") && !names.includes("미납가"));
  assert.equal(takesTests(stats.find((s) => s.app.name === "문풀가")!.app), true);
});

test("미제출 횟수와 최근 3회 연속 하락", async () => {
  const id = await student("하락이", "solve", "all");
  // 10월 DAY 2~4 (10/7, 10/8, 10/12) RC 점수가 25→20→15로 계속 떨어짐, 단어는 10/7만 제출
  await saveTestResult({ app_id: id, cohort: "2026-10", day: "2026-10-07", kind: "rc", test_no: 21, questions: 25, score: 25, wrong: [], late: false });
  await saveTestResult({ app_id: id, cohort: "2026-10", day: "2026-10-08", kind: "rc", test_no: 22, questions: 30, score: 20, wrong: [], late: false });
  await saveTestResult({ app_id: id, cohort: "2026-10", day: "2026-10-12", kind: "rc", test_no: 23, questions: 30, score: 15, wrong: [], late: false });
  await saveTestResult({ app_id: id, cohort: "2026-10", day: "2026-10-07", kind: "word", test_no: 1, questions: 20, score: 18, wrong: [], late: false });
  const s = (await cohortTestStats("2026-10", "2026-10-13")).stats.find((x) => x.app.id === id)!;
  assert.equal(s.declining, true);
  assert.equal(s.missing, 2); // 단어 10/8, 10/12 미제출 (오늘 10/13 것은 아직 안 셈)
  assert.equal(s.avg.word, 90);
});
