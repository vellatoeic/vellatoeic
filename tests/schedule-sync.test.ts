// 일정표 연동: 수업일은 반마다, 공휴일은 기수 전체에 저장돼요.
// 공휴일을 다른 반 화면에서 나중에 추가해도, 먼저 저장한 반의 수업일·테스트·기수 범위에서 그날이 빠져야 해요.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setSetting, createApplication, getApplication, updateApplication } from "@/lib/db";
import { classDaysOf, scheduleDays } from "@/lib/classCalendar";
import { planFor, classDaysOf as testClassDays } from "@/lib/dailyTests";
import { classCohortNow } from "@/lib/classCohort";
import { holidayKey, scheduleKey } from "@/lib/schedule";
import { hashPin } from "@/lib/auth";

const C = "2027-03";
// 문풀반 종합: 3/2(화)부터 월~목 16회 (3/3 포함으로 먼저 저장된 상태)
const SOLVE = ["2027-03-02", "2027-03-03", "2027-03-04", "2027-03-08", "2027-03-09", "2027-03-10", "2027-03-11", "2027-03-15", "2027-03-16", "2027-03-17", "2027-03-18", "2027-03-22", "2027-03-23", "2027-03-24", "2027-03-25", "2027-03-29"];

test("나중에 추가한 공휴일은 먼저 저장한 반의 수업일에서도 빠져요", async () => {
  await setSetting(scheduleKey(C, "solve-all"), JSON.stringify(SOLVE));
  await setSetting(holidayKey(C), JSON.stringify({ "2027-03-03": "테스트 공휴일" }));
  const days = await scheduleDays(C, "solve-all");
  assert.equal(days.includes("2027-03-03"), false);
  assert.equal(days.length, 15);
  assert.deepEqual(days, [...days].sort());
});

test("데일리 테스트 DAY 번호도 공휴일을 건너뛰어요", async () => {
  const { solveAllDays, plan } = await planFor(C);
  assert.equal(solveAllDays.includes("2027-03-03"), false);
  assert.equal(plan.has("2027-03-03"), false); // 공휴일에는 테스트가 없어요
});

test("학생 반 수업일(스티커판·출석·숙제 별·테스트)도 같은 값이에요", async () => {
  const id = await createApplication({
    cohort: C, kind: "onsite", course: "solve", track: "all", continuing: false, slot: "pm", pickup_date: null, pickup_time: null,
    books: ["solve_rc1", "lc1"], pickup: "classroom", name: "일정테스트", phone: null, depositor: "일정테스트", address: null, amount: 20000, pin_hash: hashPin("1234"),
  });
  await updateApplication(id, { status: "paid" });
  const app = (await getApplication(id))!;
  const a = await classDaysOf(app);
  const b = await testClassDays(app);
  assert.deepEqual(a, b);
  assert.equal(a.includes("2027-03-03"), false);
});

test("수업 기수 범위는 공휴일인 첫날을 개강일로 보지 않아요", async () => {
  // 모든 반 첫날을 공휴일로 만들면, 그날은 아직 수업 기수가 아니에요 (다가오는 기수로 판단)
  await setSetting(holidayKey(C), JSON.stringify({ "2027-03-02": "개강일 공휴일" }));
  for (const k of ["start-all", "start-mw", "start-tt", "solve-all", "solve-mw", "solve-tt", "intensive-all"] as const) {
    await setSetting(scheduleKey(C, k), JSON.stringify(["2027-03-02", "2027-03-04", "2027-03-09"]));
  }
  const first = (await scheduleDays(C, "start-all"))[0];
  assert.equal(first, "2027-03-04");
  assert.equal(await classCohortNow("2027-03-04"), C);
});
