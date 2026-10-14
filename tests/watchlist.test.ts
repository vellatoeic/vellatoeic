// 관리 필요 학생 규칙 테스트 (DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { watchSummary } from "@/lib/watchlist";

const days = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-12", "2026-10-13", "2026-10-14"];
const att = (...d: string[]) => d.map((day) => ({ day }));

test("오늘 수업은 결석으로 세지 않아요", () => {
  const s = watchSummary(days, att("2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-12", "2026-10-13"), [], "2026-10-14");
  assert.equal(s.absent, 0);
  assert.equal(s.past, 6);
});

test("최근 2회 연속 결석이면 관리 필요", () => {
  const s = watchSummary(days, att("2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"), [], "2026-10-14");
  assert.equal(s.streak, 2);
  assert.ok(s.reasons.includes("최근 2회 연속 결석"));
});

test("띄엄띄엄 결석 3회면 관리 필요, 연속은 아님", () => {
  const s = watchSummary(days, att("2026-10-06", "2026-10-08", "2026-10-13"), [], "2026-10-14");
  assert.equal(s.absent, 3);
  assert.equal(s.streak, 0);
  assert.deepEqual(s.reasons.filter((r) => r.startsWith("결석")), ["결석 3회"]);
});

test("숙제: 첫 수업일은 빼고, 다음 날 기한이 안 지난 어제 수업도 빼요", () => {
  const all = att(...days);
  // 오늘 10/14 → 기한 지난 날: 10/6, 10/7, 10/8, 10/12 (10/13은 오늘까지 제출 가능)
  const s = watchSummary(days, all, ["2026-10-06"], "2026-10-14");
  assert.equal(s.hwDue, 4);
  assert.equal(s.hwMissing, 3);
  assert.ok(s.reasons.includes("숙제 미제출 3회"));
});

test("잘 나오는 학생은 이유가 없어요", () => {
  const s = watchSummary(days, att(...days), days, "2026-10-14");
  assert.deepEqual(s.reasons, []);
});
