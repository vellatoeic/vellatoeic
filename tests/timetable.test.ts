// 일정표: 개강일부터 자동 채우기, 월수반·화목반 → 7개 반 수업일, 특강 초안 맞추기, 공휴일 기본값
import { test } from "node:test";
import assert from "node:assert/strict";
import { autoFill, classDaysFromMarks, marksFromDays, mismatchedClasses, planSpecialSync, summarize, timetableWarnings } from "@/lib/timetable";
import { defaultHolidays } from "@/lib/schedule";

const DEC_MW = ["2026-12-01", "2026-12-03", "2026-12-07", "2026-12-09", "2026-12-14", "2026-12-16", "2026-12-21", "2026-12-23"];
const DEC_TT = ["2026-12-02", "2026-12-04", "2026-12-08", "2026-12-10", "2026-12-15", "2026-12-17", "2026-12-22", "2026-12-24"];

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

test("특강: 공개한 특강은 그대로, 공개 전 초안만 옮기고 만들고 지워요", () => {
  const ex = [
    { id: "a", event_date: "2026-12-05", title: "PART 5 액기스 특강", published: false },
    { id: "b", event_date: "2026-12-19", title: "적중 모의고사 + 풀이", published: false },
    { id: "z", event_date: "2026-11-27", title: "적중 모의고사 + 풀이", published: true },
  ];
  // 그대로 저장 → 할 일 없음
  assert.deepEqual(planSpecialSync("2026-12", ["2026-12-05", "2026-12-19"], ex), { dates: ["2026-12-05", "2026-12-19"], create: [], move: [], remove: [] });
  // 2차를 12/26으로 → 초안 b를 옮겨요
  const p = planSpecialSync("2026-12", ["2026-12-05", "2026-12-26"], ex);
  assert.deepEqual(p.move.map((m) => [m.id, m.date, m.title]), [["b", "2026-12-26", "적중 모의고사 + 풀이"]]);
  assert.deepEqual([p.create, p.remove], [[], []]);
  // 하나만 고르면 남은 초안은 지워요
  assert.deepEqual(planSpecialSync("2026-12", ["2026-12-05"], ex).remove, ["b"]);
  // 초안이 없으면 새로 만들어요 (순서대로 1차·2차 제목)
  const fresh = planSpecialSync("2027-01", ["2027-01-16", "2027-01-02"], []);
  assert.deepEqual(fresh.create.map((c) => [c.date, c.title, c.ends_at]), [["2027-01-02", "PART 5 액기스 특강", "12:00"], ["2027-01-16", "적중 모의고사 + 풀이", null]]);
  // 공개한 특강은 빼도 남아요
  const pub = [{ id: "p", event_date: "2026-12-05", title: "PART 5 액기스 특강", published: true }];
  assert.deepEqual(planSpecialSync("2026-12", [], pub), { dates: ["2026-12-05"], create: [], move: [], remove: [] });
});

test("공휴일 기본값: 저장 안 한 달은 대한민국 공휴일, 10월(2026)은 예전 그대로", () => {
  assert.deepEqual(defaultHolidays("2026-10"), { "2026-10-05": "공휴일", "2026-10-09": "한글날" });
  assert.equal(defaultHolidays("2027-02")["2027-02-09"], "대체공휴일");
  assert.equal(defaultHolidays("2027-03")["2027-03-01"], "삼일절");
  assert.deepEqual(defaultHolidays("2027-04"), {});
});

// ── 저장하면 모든 곳이 일정표를 따라가요 (메모리 DB) ──
test("일정표 저장 → 7개 반 수업일 · 학생 종강일 · 음원 기간 · 열람 마감 · 특강 초안", async () => {
  const { setSetting, createApplication, getApplication, updateApplication, listSpecialLectures } = await import("@/lib/db");
  const { scheduleDays, classDaysOf } = await import("@/lib/classCalendar");
  const { saveTimetableData, loadTimetable } = await import("@/lib/timetableServer");
  const { studentAudioWindow } = await import("@/lib/audio");
  const { studentEnd, cohortUntil } = await import("@/lib/viewWindowServer");
  const { syncSpecialDrafts } = await import("@/lib/specialDrafts");
  const { hashPin } = await import("@/lib/auth");
  const C = "2027-04";
  const marks = autoFill(C, "2027-04-05", {});
  await saveTimetableData(C, marks, { "2027-04-30": "학원 휴무" }, ["2027-04-24", "2027-04-10"]);
  const s = summarize(marks);
  assert.deepEqual(await scheduleDays(C, "start-mw"), s.mw);
  assert.deepEqual(await scheduleDays(C, "solve-tt"), s.tt);
  assert.equal((await scheduleDays(C, "intensive-all")).length, 16);

  const id = await createApplication({
    cohort: C, kind: "online", course: "solve", track: "alt_tt", continuing: false, slot: "am", pickup_date: null, pickup_time: null,
    books: ["lc1"], pickup: "classroom", name: "일정표학생", phone: "010-0000-0000", depositor: "일정표학생", address: null, amount: 20000, pin_hash: hashPin("1234"),
  });
  await updateApplication(id, { status: "paid" });
  const app = (await getApplication(id))!;
  assert.deepEqual(await classDaysOf(app), s.tt);
  assert.equal(await studentEnd(app), s.tt.at(-1)); // 종강일 = 화목반 마지막 수업일
  const audio = await studentAudioWindow(app);
  assert.deepEqual(audio, { start: s.tt[0], end: s.tt.at(-1) }); // 음원은 개강일부터 종강일까지
  // 다시 보기는 지금처럼: 다음 달 개강 전날까지 (다음 달 일정표 저장 후)
  await saveTimetableData("2027-05", autoFill("2027-05", "2027-05-04", {}), {}, []);
  assert.equal(await cohortUntil(C), "2027-05-03");

  // 특강: 고른 날짜 순서대로 1차·2차 초안, 다시 저장하면 초안만 옮겨요
  const drafts = () => listSpecialLectures().then((l) => l.filter((e) => e.event_date.startsWith(C)).map((e) => [e.event_date, e.title, e.published]).sort());
  assert.deepEqual(await drafts(), [["2027-04-10", "PART 5 액기스 특강", false], ["2027-04-24", "적중 모의고사 + 풀이", false]]);
  await saveTimetableData(C, marks, {}, ["2027-04-10", "2027-04-17"]);
  assert.deepEqual(await drafts(), [["2027-04-10", "PART 5 액기스 특강", false], ["2027-04-17", "적중 모의고사 + 풀이", false]]);
  // [확인했어요](예전 특강 요일 계산)를 눌러도 고른 날짜가 그대로예요
  await setSetting(`special_weekday:${C}`, "6");
  await syncSpecialDrafts(C);
  assert.deepEqual(await drafts(), [["2027-04-10", "PART 5 액기스 특강", false], ["2027-04-17", "적중 모의고사 + 풀이", false]]);
  // 불러오기: 저장한 그대로
  const t = await loadTimetable(C);
  assert.deepEqual(t.marks, marks);
  assert.deepEqual(t.specials.map((p) => p.date).sort(), ["2027-04-10", "2027-04-17"]);
  assert.equal(t.saved, true);
  assert.deepEqual(t.mismatch, []);
});
