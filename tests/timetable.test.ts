// 일정표: 개강일부터 자동 채우기, 월수반·화목반 → 7개 반 수업일, 앞달 말 개강, 특강 종류·초안 맞추기, 공휴일 자동
import { test } from "node:test";
import assert from "node:assert/strict";
import { autoFill, classDaysFromMarks, holidaysFor, inRange, marksFromDays, mismatchedClasses, planSpecialSync, summarize, timetableWarnings, timetableWeeks } from "@/lib/timetable";
import { defaultHolidays, parseSchoolDays, weekDaysFor, dayNumberLabel } from "@/lib/schedule";

const DEC_MW = ["2026-12-01", "2026-12-03", "2026-12-07", "2026-12-09", "2026-12-14", "2026-12-16", "2026-12-21", "2026-12-23"];
const DEC_TT = ["2026-12-02", "2026-12-04", "2026-12-08", "2026-12-10", "2026-12-15", "2026-12-17", "2026-12-22", "2026-12-24"];
const P5 = "PART 5 액기스 특강";
const MOCK = "적중 모의고사 + 풀이";

test("12월: 12/1(화) 개강이면 1주차는 화~금, 회차대로 월수반·화목반이 번갈아요 (SQL 38과 같음)", () => {
  const m = autoFill("2026-12", "2026-12-01", { "2026-12-25": "성탄절" });
  const s = summarize(m);
  assert.deepEqual(s.mw, DEC_MW);
  assert.deepEqual(s.tt, DEC_TT);
  assert.equal(s.first, "2026-12-01");
  assert.equal(s.last, "2026-12-24");
  assert.equal(s.total, 16);
  assert.deepEqual(timetableWarnings(m), []);
});

test("평달: 첫 월요일 개강이면 월~목, 공휴일 주는 금요일까지", () => {
  const nov = summarize(autoFill("2026-11", "2026-11-02", {}));
  assert.equal(nov.last, "2026-11-26");
  assert.deepEqual(nov.mw.slice(0, 2), ["2026-11-02", "2026-11-04"]);
  // 2027-10: 10/4(월) 대체공휴일 · 10/11(월) 대체공휴일 → 그 주는 화~금
  const oct = autoFill("2027-10", "2027-10-04", defaultHolidays("2027-10"));
  assert.equal(oct["2027-10-04"], undefined);
  assert.deepEqual(Object.keys(oct).slice(0, 4), ["2027-10-05", "2027-10-06", "2027-10-07", "2027-10-08"]);
  assert.equal(oct["2027-10-11"], undefined);
  assert.equal(Object.keys(oct).length, 16);
});

test("종강일을 주면 그날까지만 채워요", () => {
  const m = autoFill("2026-12", "2026-12-01", {}, "2026-12-10");
  assert.equal(summarize(m).last, "2026-12-10");
  assert.equal(summarize(m).total, 8);
  assert.deepEqual(autoFill("2026-12", "2026-12-10", {}, "2026-12-01"), {});
});

test("앞달 말 개강: 12월반이 11/30(월)에 시작해도 12월 수업으로 저장·표시돼요", () => {
  // 달력은 앞달 마지막 주 ~ 다음 달 첫 주
  const weeks = timetableWeeks("2026-12");
  assert.equal(weeks[0][0], "2026-11-22");
  assert.equal(weeks.at(-1)!.at(-1), "2027-01-09");
  assert.equal(inRange("2026-11-30", "2026-12"), true);
  assert.equal(inRange("2026-11-15", "2026-12"), false);
  const m = autoFill("2026-12", "2026-11-30", { "2026-12-25": "성탄절" });
  const s = summarize(m);
  assert.equal(s.first, "2026-11-30");
  assert.equal(s.last, "2026-12-24"); // 1주차 11/30(월)~12/3(목)
  assert.equal(s.total, 16);
  // 저장값 읽기: 앞뒤 한 달까지는 그 기수 수업일로 인정
  assert.deepEqual(parseSchoolDays(JSON.stringify(["2026-11-30", "2026-12-01", "2026-10-30", "2027-02-01"]), "2026-12"), ["2026-11-30", "2026-12-01"]);
  // 스티커판(월~금): 첫 줄이 11/30부터, 칸 글자는 '11/30'
  const sticker = weekDaysFor("2026-12", Object.keys(m));
  assert.deepEqual(sticker[0], ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"]);
  assert.equal(dayNumberLabel("2026-11-30", "2026-12"), "11/30");
  assert.equal(dayNumberLabel("2026-12-01", "2026-12"), "1");
  // 평소 달은 예전 달력과 같아요
  assert.deepEqual(weekDaysFor("2026-12", DEC_MW)[0], [null, "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"]);
});

test("앞달 말 개강: 테스트는 첫 수업일부터 그 기수 기간, 미리 내기도 달을 넘어 돼요", async () => {
  const { earlyTestDay, testMonthOpen } = await import("@/lib/tests");
  const days = ["2026-11-30", "2026-12-01", "2026-12-02"];
  assert.equal(testMonthOpen("2026-12", days, "2026-11-30"), true);
  assert.equal(testMonthOpen("2026-12", days, "2026-11-27"), false); // 개강 전
  assert.equal(testMonthOpen("2026-12", days, "2026-12-31"), true);
  assert.equal(testMonthOpen("2026-12", days, "2027-01-02"), false);
  assert.equal(earlyTestDay(days, "2026-11-30", "2026-12"), "2026-12-01");
  assert.equal(earlyTestDay(days, "2026-11-30"), null); // 기수를 모르면 예전처럼 같은 달만
  assert.equal(earlyTestDay(["2026-10-29", "2026-11-02"], "2026-10-29", "2026-10"), null);
});

test("주 4일반 = 월수반 + 화목반, 격일반은 자기 칸만 (시작반·문풀반·속성반 모두 같은 날)", () => {
  const d = classDaysFromMarks(autoFill("2026-12", "2026-12-01", {}));
  assert.equal(d["start-all"].length, 16);
  assert.deepEqual(d["solve-all"], d["start-all"]);
  assert.deepEqual(d["intensive-all"], d["start-all"]);
  assert.deepEqual(d["start-mw"], DEC_MW);
  assert.deepEqual(d["solve-tt"], DEC_TT);
});

test("저장된 반별 수업일 → 일정표로 되돌리기, 다른 반 찾기", () => {
  const all = [...DEC_MW, ...DEC_TT].sort();
  const m = marksFromDays(all, DEC_MW, DEC_TT);
  const days = { ...classDaysFromMarks(m) };
  assert.deepEqual(mismatchedClasses(days, m), []);
  days["solve-mw"] = DEC_MW.slice(0, 7);
  assert.deepEqual(mismatchedClasses(days, m), ["문풀반 격일반 월수"]);
  // 주 4일반에만 있는 날은 적은 쪽 반으로
  const extra = marksFromDays([...DEC_MW, ...DEC_TT.slice(0, 7), "2026-12-28"], DEC_MW, DEC_TT.slice(0, 7));
  assert.equal(extra["2026-12-28"], "tt");
});

test("공휴일은 자동: 범위 안 대한민국 공휴일 + 예전 저장값, 수업을 넣은 날은 수업이 우선", () => {
  assert.deepEqual(holidaysFor("2026-12", {}, {}), { "2026-12-25": "성탄절", "2027-01-01": "신정" });
  assert.deepEqual(holidaysFor("2026-12", { "2026-12-31": "학원 휴무" }, { "2026-12-25": "mw" }), { "2026-12-31": "학원 휴무", "2027-01-01": "신정" });
});

test("특강: 날짜마다 종류를 골라요 · 공개한 특강은 그대로, 공개 전 초안만 바꾸고 옮기고 만들고 지워요", () => {
  const ex = [
    { id: "a", event_date: "2026-12-05", title: P5, published: false },
    { id: "b", event_date: "2026-12-19", title: MOCK, published: false },
    { id: "z", event_date: "2026-11-27", title: MOCK, published: true },
  ];
  // 그대로 저장 → 할 일 없음
  const same = planSpecialSync("2026-12", [{ date: "2026-12-05", title: P5 }, { date: "2026-12-19", title: MOCK }], ex);
  assert.deepEqual([same.create, same.move, same.remove], [[], [], []]);
  // 모의고사를 12/26으로 → 초안 b를 옮겨요(이름·시간은 그대로)
  const p = planSpecialSync("2026-12", [{ date: "2026-12-05", title: P5 }, { date: "2026-12-26", title: MOCK }], ex);
  assert.deepEqual(p.move, [{ id: "b", date: "2026-12-26" }]);
  assert.deepEqual([p.create, p.remove], [[], []]);
  // 같은 날 종류만 바꾸면 이름·시간만 바꿔요
  const swap = planSpecialSync("2026-12", [{ date: "2026-12-05", title: MOCK }, { date: "2026-12-19", title: MOCK }], ex);
  assert.deepEqual(swap.move, [{ id: "a", date: "2026-12-05", title: MOCK, starts_at: "10:00", ends_at: null }]);
  // 하나만 고르면 남은 초안은 지워요
  assert.deepEqual(planSpecialSync("2026-12", [{ date: "2026-12-05", title: P5 }], ex).remove, ["b"]);
  // 초안이 없으면 새로 만들어요 (고른 종류의 시간), 다른 달 날짜는 빼요
  const fresh = planSpecialSync("2027-01", [{ date: "2027-01-16", title: MOCK }, { date: "2027-01-02", title: P5 }, { date: "2026-12-26", title: P5 }], []);
  assert.deepEqual(fresh.create.map((c) => [c.date, c.title, c.ends_at]), [["2027-01-02", P5, "12:00"], ["2027-01-16", MOCK, null]]);
  // 공개한 특강은 빼도·바꿔도 남아요
  const pub = [{ id: "p", event_date: "2026-12-05", title: P5, published: true }];
  const kept = planSpecialSync("2026-12", [{ date: "2026-12-05", title: MOCK }], pub);
  assert.deepEqual([kept.picks, kept.create, kept.move, kept.remove], [[{ date: "2026-12-05", title: P5 }], [], [], []]);
});

test("공휴일 기본값: 저장 안 한 달은 대한민국 공휴일, 10월(2026)은 예전 그대로", () => {
  assert.deepEqual(defaultHolidays("2026-10"), { "2026-10-05": "공휴일", "2026-10-09": "한글날" });
  assert.equal(defaultHolidays("2027-02")["2027-02-09"], "대체공휴일");
  assert.equal(defaultHolidays("2027-03")["2027-03-01"], "삼일절");
  assert.deepEqual(defaultHolidays("2027-04"), {});
});

// ── 저장하면 모든 곳이 일정표를 따라가요 (메모리 DB) ──
test("일정표 저장 → 7개 반 수업일 · 학생 종강일 · 음원 기간 · 열람 마감 · 특강 초안", async () => {
  const { setSetting, createApplication, getApplication, updateApplication, listSpecialLectures, getSetting } = await import("@/lib/db");
  const { scheduleDays, classDaysOf, holidaysOf } = await import("@/lib/classCalendar");
  const { saveTimetableData, loadTimetable } = await import("@/lib/timetableServer");
  const { studentAudioWindow } = await import("@/lib/audio");
  const { studentEnd, cohortUntil } = await import("@/lib/viewWindowServer");
  const { syncSpecialDrafts } = await import("@/lib/specialDrafts");
  const { classCohortNow } = await import("@/lib/classCohort");
  const { hashPin } = await import("@/lib/auth");
  const C = "2027-04";
  const marks = autoFill(C, "2027-04-05", {});
  await saveTimetableData(C, marks, [{ date: "2027-04-24", title: MOCK }, { date: "2027-04-10", title: P5 }]);
  const s = summarize(marks);
  assert.deepEqual(await scheduleDays(C, "start-mw"), s.mw);
  assert.deepEqual(await scheduleDays(C, "solve-tt"), s.tt);
  assert.equal((await scheduleDays(C, "intensive-all")).length, 16);
  // 4월 공휴일은 없고, 다음 달 노동절(5/1)·대체공휴일(5/3)은 저장하지 않아요
  assert.deepEqual(await holidaysOf(C), {});

  const id = await createApplication({
    cohort: C, kind: "online", course: "solve", track: "alt_tt", continuing: false, slot: "am", pickup_date: null, pickup_time: null,
    books: ["lc1"], pickup: "classroom", name: "일정표학생", phone: "010-0000-0000", depositor: "일정표학생", address: null, amount: 20000, pin_hash: hashPin("1234"),
  });
  await updateApplication(id, { status: "paid" });
  const app = (await getApplication(id))!;
  assert.deepEqual(await classDaysOf(app), s.tt);
  assert.equal(await studentEnd(app), s.tt.at(-1)); // 종강일 = 화목반 마지막 수업일
  assert.deepEqual(await studentAudioWindow(app), { start: s.tt[0], end: s.tt.at(-1) }); // 음원은 개강일부터 종강일까지
  // 다시 보기는 지금처럼: 다음 달 개강 전날까지 — 다음 달(5월)이 4/26(월)에 앞당겨 개강하면 4/25까지
  await saveTimetableData("2027-05", autoFill("2027-05", "2027-04-26", holidaysFor("2027-05", {}, {})), []);
  assert.equal(await cohortUntil(C), "2027-04-25");
  // 4/26은 4월 수업이 끝난 뒤라 5월 기수가 '수업 기수'예요
  assert.equal(await classCohortNow("2027-04-26"), "2027-05");
  // 5월 공휴일(5/3 대체공휴일·5/5 어린이날)은 자동으로 빠지고 공휴일로 저장돼요
  assert.equal((await scheduleDays("2027-05", "start-all")).includes("2027-05-05"), false);
  assert.equal((await holidaysOf("2027-05"))["2027-05-05"], "어린이날");
  // 공휴일에도 수업을 넣으면 수업이 우선 (공휴일 목록에서 빠져요)
  await saveTimetableData("2027-08", { "2027-08-16": "mw", "2027-08-17": "tt" }, []); // 8/16(월) 대체공휴일
  assert.deepEqual(await scheduleDays("2027-08", "start-all"), ["2027-08-16", "2027-08-17"]);
  assert.equal((await holidaysOf("2027-08"))["2027-08-16"], undefined);
  assert.equal((await holidaysOf("2027-08"))["2027-08-15"], "광복절");

  // 특강: 고른 종류로 초안, 다시 저장하면 초안만 옮겨요
  const drafts = () => listSpecialLectures().then((l) => l.filter((e) => e.event_date.startsWith(C)).map((e) => [e.event_date, e.title, e.published]).sort());
  assert.deepEqual(await drafts(), [["2027-04-10", P5, false], ["2027-04-24", MOCK, false]]);
  await saveTimetableData(C, marks, [{ date: "2027-04-10", title: P5 }, { date: "2027-04-17", title: MOCK }]);
  assert.deepEqual(await drafts(), [["2027-04-10", P5, false], ["2027-04-17", MOCK, false]]);
  assert.equal(await getSetting(`special_weekday:${C}`), "6");
  // [확인했어요](예전 특강 요일 계산)를 눌러도 고른 날짜가 그대로예요
  await syncSpecialDrafts(C);
  assert.deepEqual(await drafts(), [["2027-04-10", P5, false], ["2027-04-17", MOCK, false]]);
  // 불러오기: 저장한 그대로
  const t = await loadTimetable(C);
  assert.deepEqual(t.marks, marks);
  assert.deepEqual(t.specials.map((p) => [p.date, p.title]).sort(), [["2027-04-10", P5], ["2027-04-17", MOCK]]);
  assert.equal(t.saved, true);
  assert.deepEqual(t.mismatch, []);
  await setSetting("noop", "");
});
