// 2026년 12월 일정 점검 (12/1 화요일 개강 · 1주차 화~금) — 임시 저장소에서만
// supabase/38_december_schedule.sql에 적힌 값을 그대로 읽어 저장한 뒤 앱 계산 결과를 확인해요.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { roundOf } from "@/lib/config";
import { createApplication, getApplication, isPreview, listSpecialLectures, setSetting } from "@/lib/db";
import { hashPin } from "@/lib/auth";
import { holidaysOf } from "@/lib/classCalendar";
import { classCohortNow } from "@/lib/classCohort";
import { isClassDay, nextClassDay } from "@/lib/attendanceDays";
import { courseEndNotices } from "@/lib/courseEndPopups";
import { planFor } from "@/lib/dailyTests";
import { liveState } from "@/lib/live";
import { monthlyChecklist } from "@/lib/monthlyChecklist";
import { isHomeworkStickerEligible, schoolDaysFor, scheduleKey, weekDaysInMonth, type ScheduleClass } from "@/lib/schedule";
import { openingDay, syncSpecialDrafts } from "@/lib/specialDrafts";
import { deadlinePopupOpen } from "@/lib/specialPopups";
import { signupMonths } from "@/lib/signupMonthsServer";
import { boardStatus } from "@/lib/stickerComplete";
import { studentDays } from "@/lib/studentDays";
import { dayNumber, testsForClassDay } from "@/lib/tests";
import { cohortUntil, studentEnd } from "@/lib/viewWindowServer";

const C = "2026-12";
const sql = readFileSync(new URL("../supabase/38_december_schedule.sql", import.meta.url), "utf8");
const saved = new Map([...sql.matchAll(/\('((?:schooldays_2026-12_[a-z-]+)|holidays_2026-12|special_weekday:2026-12|schedule_confirmed:2026-12)',\s*'([^']*)'\)/g)].map((m) => [m[1], m[2]]));
before(async () => {
  for (const [k, v] of saved) await setSetting(k, v);
});

const days = (k: ScheduleClass) => schoolDaysFor(saved.get(scheduleKey(C, k)) ?? "", C, k);
const allDays = ["01", "02", "03", "04", "07", "08", "09", "10", "14", "15", "16", "17", "21", "22", "23", "24"].map((d) => `${C}-${d}`);
const mw = ["01", "03", "07", "09", "14", "16", "21", "23"].map((d) => `${C}-${d}`);
const tt = ["02", "04", "08", "10", "15", "17", "22", "24"].map((d) => `${C}-${d}`);

const mkApp = async (cohort: string, course: "start" | "solve" | "intensive", track: "all" | "alt_mw" | "alt_tt", createdTag = "") => {
  const id = await createApplication({
    cohort, kind: "onsite", course, track, continuing: false, slot: "pm", pickup_date: null, pickup_time: null,
    books: [], pickup: "classroom", name: `점검${cohort}${course}${track}${createdTag}`, phone: null, depositor: "x", address: null, amount: 0, pin_hash: hashPin("1234"),
  });
  return (await getApplication(id))!;
};

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

test("SQL 38: 7개 반 수업일·공휴일·특강 요일·수업일 확인이 모두 들어 있어요", async () => {
  assert.equal(saved.size, 10);
  for (const k of ["start-all", "solve-all", "intensive-all"] as const) assert.deepEqual(days(k), allDays);
  for (const k of ["start-mw", "solve-mw"] as const) assert.deepEqual(days(k), mw);
  for (const k of ["start-tt", "solve-tt"] as const) assert.deepEqual(days(k), tt);
  assert.deepEqual(await holidaysOf(C), { "2026-12-25": "성탄절" });
  assert.equal(saved.get("special_weekday:2026-12"), "6");
  assert.equal(saved.get("schedule_confirmed:2026-12"), "1");
});

test("개강일 12/1 · 종강일 종합·속성 12/24, 격일 월수 12/23(8회차), 화목 12/24", async () => {
  assert.equal(await openingDay(C), "2026-12-01");
  assert.equal(await studentEnd(await mkApp(C, "start", "all")), "2026-12-24");
  assert.equal(await studentEnd(await mkApp(C, "intensive", "all")), "2026-12-24");
  assert.equal(await studentEnd(await mkApp(C, "solve", "alt_mw")), "2026-12-23");
  assert.equal(await studentEnd(await mkApp(C, "solve", "alt_tt")), "2026-12-24");
});

test("11월 열람 마감 11/30 · 11/26 종강 팝업 문구", async () => {
  assert.equal(await cohortUntil("2026-11"), "2026-11-30");
  const end = await studentEnd(await mkApp("2026-11", "start", "all"));
  assert.equal(end, "2026-11-26");
  const input = { cohort: "2026-11", end, until: "2026-11-30", kind: "online" as const, hasNext: false };
  assert.equal(courseEndNotices([input], "2026-11-25").length, 0);
  const [n] = courseEndNotices([input], "2026-11-26");
  assert.equal(n.title, "🎁 종강 기념! 11월 강의를 11/30(월)까지 열어 둘게요");
  assert.equal(n.lead, "한 달 동안 수고 많았어요 :) 놓친 강의와 특강은 **11/30(월)까지** 강의실 📚 지난 강의와 특강 페이지에서 다시 볼 수 있어요.");
  assert.equal(n.link_label, "12월 수강 신청하기");
  assert.equal(courseEndNotices([input], "2026-11-30").length, 1);
  assert.equal(courseEndNotices([input], "2026-12-01").length, 0);
  // 12월 신청이 있으면 신청 버튼 없이 안내만
  assert.equal(courseEndNotices([{ ...input, hasNext: true }], "2026-11-26")[0].link_label, null);
});

test("12월 교재는 2회차", () => assert.equal(roundOf(C), 2));

test("신청서 수강 월: 11/25엔 '12월 수업 · 12/1~12/24'만, 12월 중간 등록은 12/10(2주차 마지막 수업일)까지", async () => {
  assert.deepEqual((await signupMonths("2026-11-25")).map((m) => `${m.label} · ${m.range}`), ["12월 수업 · 12/1~12/24"]);
  assert.deepEqual((await signupMonths("2026-12-01")).map((m) => m.cohort), [C]);
  assert.deepEqual((await signupMonths("2026-12-10")).map((m) => m.cohort), [C]);
  assert.deepEqual((await signupMonths("2026-12-11")).map((m) => m.cohort), ["2027-01"]);
});

test("특강 초안: 12/5(토) PART 5 액기스 10:00~12:00, 12/19(토) 적중 모의고사 10:00~ · 마감 팝업 12/3 00:00 ~ 12/4 17:00", async () => {
  assert.equal((await syncSpecialDrafts(C)).created, 2);
  const list = (await listSpecialLectures()).filter((e) => e.event_date.startsWith(C)).sort((a, b) => a.event_date.localeCompare(b.event_date));
  assert.deepEqual(list.map((e) => [e.event_date, e.title, e.starts_at, e.ends_at, e.published]), [
    ["2026-12-05", "PART 5 액기스 특강", "10:00", "12:00", false],
    ["2026-12-19", "적중 모의고사 + 풀이", "10:00", null, false],
  ]);
  assert.equal((await syncSpecialDrafts(C)).created, 0); // SQL로 이미 만들었으면 [확인했어요]를 다시 눌러도 중복 없음
  const ev = { id: "d1", event_date: "2026-12-05", starts_at: "10:00", registration_deadline: null, published: true };
  assert.equal(deadlinePopupOpen(ev, Date.parse("2026-12-02T23:59:00+09:00")), false);
  assert.equal(deadlinePopupOpen(ev, Date.parse("2026-12-03T00:00:00+09:00")), true);
  assert.equal(deadlinePopupOpen(ev, Date.parse("2026-12-04T17:00:00+09:00")), false);
});

test("'이번 달 할 일'(11/25): 12월 준비 · 수업일 확인 ✅ · 공휴일 12/25 표시 · 특강은 초안 공개 전", async () => {
  const { cohort, first, items } = await monthlyChecklist("2026-11-25");
  assert.equal(cohort, C);
  assert.equal(first, "2026-12-01");
  const schedule = items.find((i) => i.key === "schedule")!;
  assert.equal(schedule.state, "done");
  assert.match(schedule.warn ?? "", /12\/25 성탄절/);
  assert.equal(items.find((i) => i.key === "special")!.state, "todo"); // [특강 관리]에서 공개해야 ✅
});

test("수업 기수: 11/26까지 11월, 11/27부터 12월", async () => {
  assert.equal(await classCohortNow("2026-11-26"), "2026-11");
  assert.equal(await classCohortNow("2026-11-27"), C);
  assert.equal(await classCohortNow("2026-12-04"), C);
});

test("12/4(금) 수업: 종합·화목반은 출석되고 월수반은 '다음 수업 12/7'", () => {
  assert.equal(isClassDay(days("start-all"), {}, "2026-12-04"), true);
  assert.equal(isClassDay(days("solve-tt"), {}, "2026-12-04"), true);
  assert.equal(isClassDay(days("solve-mw"), {}, "2026-12-04"), false);
  assert.equal(nextClassDay(days("solve-mw"), {}, "2026-12-04"), "2026-12-07");
  // 격일반 첫 주는 회차 기준: 월수반 12/1(화)·12/3(목), 화목반 12/2(수)·12/4(금)
  assert.equal(isClassDay(days("start-mw"), {}, "2026-12-01"), true);
  assert.equal(isClassDay(days("start-tt"), {}, "2026-12-01"), false);
  assert.equal(nextClassDay(days("start-tt"), {}, "2026-12-01"), "2026-12-02");
});

test("12/4(금) 숙제 별: 12/4·12/5(토) 제출은 ⭐, 12/7(월) 제출은 별 없음", () => {
  assert.equal(isHomeworkStickerEligible("2026-12-04", "2026-12-04T13:00:00Z"), true); // 12/4 22:00
  assert.equal(isHomeworkStickerEligible("2026-12-04", "2026-12-05T14:59:00Z"), true); // 12/5 23:59
  assert.equal(isHomeworkStickerEligible("2026-12-04", "2026-12-05T15:00:00Z"), false); // 12/6 00:00
  assert.equal(isHomeworkStickerEligible("2026-12-04", "2026-12-07T01:00:00Z"), false);
});

test("라이브 버튼: 12/4(금) 저녁 문풀반은 빨간 버튼, 월수반은 다음 라이브 12/7(월)", () => {
  const at = Date.parse("2026-12-04T19:30:00+09:00");
  assert.equal(liveState({ course: "solve", track: "all", slot: "pm" }, days("solve-all"), at).open, true);
  const mwState = liveState({ course: "solve", track: "alt_mw", slot: "pm" }, days("solve-mw"), at);
  assert.equal(mwState.open, false);
  assert.match(mwState.open ? "" : mwState.next ?? "", /^12\/7\(월\)/);
});

test("데일리 테스트: DAY 1(12/1) 없음, 12/2 단어 1·RC 21, 12/4(금) DAY 4, 12/24 DAY 16 단어 15·RC 35", async () => {
  const { plan, solveAllDays } = await planFor(C);
  assert.equal(dayNumber(solveAllDays, "2026-12-01"), 1);
  assert.deepEqual(plan.get("2026-12-01"), []);
  assert.deepEqual(plan.get("2026-12-02"), [{ kind: "word", no: 1, questions: 20 }, { kind: "rc", no: 21, questions: 25 }]);
  assert.equal(dayNumber(solveAllDays, "2026-12-04"), 4);
  assert.deepEqual(plan.get("2026-12-04")!.map((t) => t.no), [3, 23]);
  assert.equal(dayNumber(solveAllDays, "2026-12-24"), 16);
  assert.deepEqual(plan.get("2026-12-24")!.map((t) => t.no), [15, 35]);
  // 격일반은 같은 날짜 종합 번호를, 본인 수업일에만
  assert.deepEqual(testsForClassDay(plan, days("solve-mw"), "2026-12-01"), []);
  assert.deepEqual(testsForClassDay(plan, days("solve-mw"), "2026-12-03").map((t) => t.no), [2, 22]);
  assert.deepEqual(testsForClassDay(plan, days("solve-tt"), "2026-12-04").map((t) => t.no), [3, 23]);
  assert.deepEqual(testsForClassDay(plan, days("solve-mw"), "2026-12-04"), []);
});

test("스티커판: 첫 줄 [빈칸, 12/1~12/4], 12/4 숙제를 토요일에 내도 완성", () => {
  const weeks = weekDaysInMonth(C);
  assert.deepEqual(weeks[0], [null, "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"]);
  const hw = allDays.map((d) => ({ day: d, created_at: d === "2026-12-04" ? "2026-12-05T03:00:00Z" : `${d}T12:00:00Z` }));
  assert.equal(boardStatus(allDays, allDays.map((d) => ({ day: d })), hw, "2026-12-24").complete, true);
});

test("중간 등록: 12/5(토) 신청하면 첫 수업일 12/7", () => {
  assert.equal(studentDays(allDays, "2026-12-05T02:00:00Z")[0], "2026-12-07");
});
