// [강의 관리] '오늘 수업 링크' 판: 시간표 칸 → 반·RC/LC·시간대 자동 연결
import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD_ROWS, dateLabel, defaultTitle, liveRowId, rowStatus, sessionNo, targetsOf } from "@/lib/lectureBoard";
import { covers } from "@/lib/access";
import type { Application, Lecture } from "@/lib/db";

const row = (id: string) => BOARD_ROWS.find((r) => r.id === id)!;
const app = (over: Partial<Application>): Application => ({
  id: "a", cohort: "2026-12", kind: "online", course: "start", track: "all", continuing: false, slot: "pm", pickup: "delivery",
  pickup_date: null, pickup_time: null, books: [], name: "학생", phone: null, depositor: "학생", address: null, amount: 0,
  pin_hash: "h", status: "paid", created_at: "2026-11-20T00:00:00Z", ...over,
}) as Application;
const lectureOf = (t: ReturnType<typeof targetsOf>[number]): Lecture => ({ id: "l", cohort: "2026-12", ...t, title: "x", youtube_id: "abc", created_at: "2026-12-01T10:00:00Z" });

test("시간표 6칸: 오전 시작 RC → LC 공통 → 문풀 RC / 저녁 문풀 RC → LC 공통 → 시작 RC", () => {
  assert.deepEqual(BOARD_ROWS.map((r) => `${r.slot} ${r.from} ${r.label}`), [
    "am 10:00 시작반 RC", "am 11:10 LC 공통", "am 12:20 문풀반 RC",
    "pm 18:00 문풀반 RC", "pm 19:10 LC 공통", "pm 20:20 시작반 RC",
  ]);
});

test("LC 공통은 시작반·문풀반 두 곳에, RC는 그 반에만", () => {
  assert.deepEqual(targetsOf(row("am-lc")).map((t) => t.course), ["start", "solve"]);
  assert.deepEqual(targetsOf(row("pm-start-rc")), [{ course: "start", part: "rc", slot: "pm" }]);
});

test("권한 규칙 그대로: 시작반 RC 칸은 문풀반 학생에게 안 보여요, LC 공통은 두 반·속성반 모두", () => {
  const startRc = lectureOf(targetsOf(row("pm-start-rc"))[0]);
  assert.equal(covers(app({ course: "start" }), startRc), true);
  assert.equal(covers(app({ course: "solve" }), startRc), false);
  assert.equal(covers(app({ course: "intensive" }), startRc), true);
  assert.equal(covers(app({ course: "start", track: "lc" }), startRc), false); // LC 단과는 RC 안 봐요
  const lcs = targetsOf(row("pm-lc")).map(lectureOf);
  for (const course of ["start", "solve", "intensive"] as const) assert.equal(lcs.some((l) => covers(app({ course }), l)), true, course);
});

test("날짜·회차·기본 제목", () => {
  assert.equal(dateLabel("2026-12-01"), "12/1(화)");
  const days = ["2026-12-01", "2026-12-02", "2026-12-03"];
  assert.equal(sessionNo(days, "2026-12-03"), 3);
  assert.equal(sessionNo(days, "2026-12-05"), null);
  assert.equal(defaultTitle(row("am-start-rc"), "2026-12-03", 3), "3회 · 12/3(목) 시작반 RC · 오전반");
  assert.equal(defaultTitle(row("pm-lc"), "2026-12-05", null), "12/5(토) LC 공통 · 저녁반");
});

test("올린 칸 표시: 제목에 날짜가 있거나 그날(한국 시각) 올린 것, LC 공통 한쪽만 있으면 빠진 반 알려 줘요", () => {
  const base = { cohort: "2026-12", youtube_id: "y1" };
  const ls = [
    { ...base, course: "start" as const, part: "lc" as const, slot: "am" as const, title: "1회 · 12/1(화) LC 공통 · 오전반", created_at: "2026-11-30T23:00:00Z" },
    { ...base, course: "start" as const, part: "rc" as const, slot: "pm" as const, title: "제목 바꿈", created_at: "2026-12-01T11:30:00Z" }, // 한국 시각 12/1 20:30
    { ...base, course: "solve" as const, part: "rc" as const, slot: "pm" as const, title: "다른 날", created_at: "2026-12-01T16:00:00Z" }, // 한국 시각 12/2 01:00
  ];
  const lc = rowStatus(row("am-lc"), ls, "2026-12", "2026-12-01");
  assert.equal(lc.done, true);
  assert.deepEqual(lc.missing, ["solve"]);
  assert.equal(rowStatus(row("pm-start-rc"), ls, "2026-12", "2026-12-01").done, true);
  assert.equal(rowStatus(row("pm-solve-rc"), ls, "2026-12", "2026-12-01").done, false);
  assert.equal(rowStatus(row("pm-start-rc"), ls, "2027-01", "2026-12-01").done, false); // 다른 기수
});

test("지금 수업 칸: 시작 10분 전부터 끝날 때까지", () => {
  assert.equal(liveRowId("09:49"), null);
  assert.equal(liveRowId("09:50"), "am-start-rc");
  assert.equal(liveRowId("11:05"), "am-lc");
  assert.equal(liveRowId("19:30"), "pm-lc");
  assert.equal(liveRowId("21:20"), "pm-start-rc");
  assert.equal(liveRowId("21:30"), null);
});
