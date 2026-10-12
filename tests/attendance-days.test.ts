// 수업 없는 날 출석 막기 · 특강 마감 계산 테스트 (DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { isClassDay, nextClassDay } from "@/lib/attendanceDays";
import { defaultHolidays, schoolDaysFor } from "@/lib/schedule";
import { deadlineBadge, defaultDeadline, kstLabel, specialRegistrationOpen } from "@/lib/special";

const h = defaultHolidays("2026-10"); // 10/5 공휴일, 10/9 한글날
const mw = schoolDaysFor("", "2026-10", "solve-mw");
const all = schoolDaysFor("", "2026-10", "solve-all");

test("격일반 월수 학생이 화요일(10/13)에 찍으면 출석 안 됨", () => {
  assert.equal(isClassDay(mw, h, "2026-10-13"), false);
  assert.equal(isClassDay(mw, h, "2026-10-14"), true); // 수요일은 됨
});

test("공휴일(10/9 한글날, 10/5)에는 출석 안 됨", () => {
  assert.equal(isClassDay([...all, "2026-10-09"], h, "2026-10-09"), false); // 수업일 목록에 잘못 들어 있어도 공휴일이면 막아요
  assert.equal(isClassDay(all, h, "2026-10-05"), false);
});

test("주말·수업일이 아닌 날은 출석 안 됨, 종합반 평일 수업일은 됨", () => {
  assert.equal(isClassDay(all, h, "2026-10-10"), false); // 토요일
  assert.equal(isClassDay(all, h, "2026-10-12"), true);
});

test("다음 수업일 안내: 월수반 10/13(화) → 10/14(수)", () => {
  assert.equal(nextClassDay(mw, h, "2026-10-13"), "2026-10-14");
  assert.equal(nextClassDay(mw, h, "2026-10-30"), null);
});

test("특강 마감 기본값은 전날 17:00 (10/17 → 10/16 17:00)", () => {
  assert.equal(kstLabel(defaultDeadline("2026-10-17")), "10/16(금) 17:00");
  const e = { event_date: "2026-10-17", starts_at: "10:00" };
  assert.equal(specialRegistrationOpen(e, Date.parse("2026-10-16T16:59:00+09:00")), true);
  assert.equal(specialRegistrationOpen(e, Date.parse("2026-10-16T17:00:00+09:00")), false);
  assert.equal(specialRegistrationOpen({ ...e, registration_deadline: "2026-10-17T09:00:00+09:00" }, Date.parse("2026-10-16T18:00:00+09:00")), true);
});

test("마감 배지: 24시간 넘게 남음 / 24시간 이내 / 1시간 이내 / 지남", () => {
  const e = { event_date: "2026-10-17", starts_at: "10:00" };
  assert.equal(deadlineBadge(e, Date.parse("2026-10-14T12:00:00+09:00")), "⏰ 10/16(금) 17:00 마감");
  assert.equal(deadlineBadge(e, Date.parse("2026-10-16T09:30:00+09:00")), "⏰ 마감 D-1 · 7시간 남음");
  assert.equal(deadlineBadge(e, Date.parse("2026-10-16T16:30:00+09:00")), "⏰ 곧 마감");
  assert.equal(deadlineBadge(e, Date.parse("2026-10-16T17:30:00+09:00")), null);
});
