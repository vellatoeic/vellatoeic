// 중간 등록생 첫 수업일 테스트 (DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { studentDays, studentStartDay } from "@/lib/studentDays";
import { watchSummary } from "@/lib/watchlist";

const days = ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];

test("개강 전에 신청하면 반 첫 수업일부터", () => {
  assert.equal(studentStartDay(days, "2026-09-28T03:00:00Z"), "2026-10-06");
});

test("2주차에 신청하면 신청일 이후 첫 수업일부터 (한국 날짜 기준)", () => {
  // 10/12 23:30 KST = 10/12 14:30 UTC → 10/12 수업부터
  assert.equal(studentStartDay(days, "2026-10-12T14:30:00Z"), "2026-10-12");
  // 10/9(금) 신청 → 10/12(월)부터
  assert.equal(studentStartDay(days, "2026-10-09T01:00:00Z"), "2026-10-12");
  assert.deepEqual(studentDays(days, "2026-10-09T01:00:00Z"), ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]);
});

test("중간 등록생은 신청 전 수업일이 결석으로 세지지 않아요", () => {
  const mine = studentDays(days, "2026-10-09T01:00:00Z");
  const s = watchSummary(mine, [{ day: "2026-10-12" }, { day: "2026-10-13" }], [], "2026-10-14");
  assert.equal(s.absent, 0);
  assert.equal(s.past, 2);
  assert.deepEqual(s.reasons, []);
});
