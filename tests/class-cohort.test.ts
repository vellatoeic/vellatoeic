// 모집 기수와 수업 기수 분리 테스트 (임시 저장소에서만)
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickCohort, classAppsFor, classCohortNow } from "@/lib/classCohort";
import { createApplication, getApplication, isPreview, setSetting, updateApplication, currentCohort } from "@/lib/db";
import { hashPin } from "@/lib/auth";
import { classDaysOf, holidaysOf } from "@/lib/classCalendar";
import { isClassDay } from "@/lib/attendanceDays";
import { liveState } from "@/lib/live";
import { planFor } from "@/lib/dailyTests";
import { testsForClassDay } from "@/lib/tests";
import { canWatch } from "@/lib/access";

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

test("수업 기수: 수업 기간 안 → 다가오는 기수 → 가장 최근 기수", () => {
  const w = [
    { cohort: "2026-10", start: "2026-10-06", end: "2026-10-29" },
    { cohort: "2026-11", start: "2026-11-02", end: "2026-11-26" },
  ];
  assert.equal(pickCohort(w, "2026-10-27"), "2026-10");
  assert.equal(pickCohort(w, "2026-10-31"), "2026-11"); // 10월 수업이 끝나면 다가오는 11월
  assert.equal(pickCohort(w, "2026-12-05"), "2026-11"); // 다 끝났으면 가장 최근
  assert.equal(pickCohort(w, "2026-10-01"), "2026-10");
});

const newApp = async (cohort: string, name: string) => {
  const id = await createApplication({
    cohort, kind: "onsite", course: "solve", track: "all", continuing: false, slot: "am", pickup_date: null, pickup_time: null,
    books: ["solve_rc1", "lc1"], pickup: "classroom", name, phone: null, depositor: name, address: null, amount: 20000, pin_hash: hashPin("1234"),
  });
  await updateApplication(id, { status: "paid" });
  return (await getApplication(id))!;
};

test("모집 기수 2026-11 + 오늘 10/27: 10월 학생의 라이브·출석·테스트가 열려요", async () => {
  await setSetting("current_cohort", "2026-11");
  assert.equal(await currentCohort(), "2026-11");
  const today = "2026-10-27";
  const oct = await newApp("2026-10", "시월학생");
  const nov = await newApp("2026-11", "시월학생"); // 다음 달도 미리 신청한 학생

  // 수업 기수는 10월
  assert.equal(await classCohortNow(today), "2026-10");
  const { cohort, apps } = await classAppsFor([oct, nov], today);
  assert.equal(cohort, "2026-10");
  assert.deepEqual(apps.map((a) => a.id), [oct.id]);
  assert.ok(canWatch(apps[0]));

  // 출석: 10/27(화)은 문풀반 종합 수업일
  const days = await classDaysOf(oct);
  assert.equal(isClassDay(days, await holidaysOf(oct.cohort), today), true);

  // 라이브: 문풀반 오전 첫 수업 11:10(LC) → 11:05에 열려요
  assert.equal(liveState(oct, days, Date.parse(`${today}T11:05:00+09:00`)).open, true);

  // 테스트: 그날 테스트가 있어요
  const { plan } = await planFor(oct.cohort);
  assert.ok(testsForClassDay(plan, days, today).length > 0);

  // 10월 수업이 끝난 10/31에는 11월이 수업 기수
  assert.equal((await classAppsFor([oct, nov], "2026-10-31")).cohort, "2026-11");
  await setSetting("current_cohort", "");
});
