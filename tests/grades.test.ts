// 학생 명단 등급(수강생·예비수강생·일반) · 개강일 오전 9시 권한 오픈 테스트 (실제 DB 미사용)
import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeOf, groupStudents, seenLabel, type CohortWindow } from "@/lib/grades";
import { canViewNow, isOpened, openAtOf, openLabel, viewableCohorts } from "@/lib/viewWindow";

const at = (s: string) => Date.parse(s);
// 11월: 11/2 개강 · 12/1 개강 전날(11/30)까지 열람 / 12월: 12/1(화) 개강 · 1월 개강 전날까지
const windows = new Map<string, CohortWindow>([
  ["2026-10", { openAt: openAtOf("2026-10-05"), until: "2026-11-01" }],
  ["2026-11", { openAt: openAtOf("2026-11-02"), until: "2026-11-30" }],
  ["2026-12", { openAt: openAtOf("2026-12-01"), until: "2027-01-03" }],
]);

test("개강일 오전 9시 = 한국 시간 9시 (첫 수업 10시보다 1시간 전)", () => {
  assert.equal(openAtOf("2026-12-01"), "2026-12-01T09:00:00+09:00");
  assert.equal(openAtOf(null), null);
  assert.equal(isOpened("2026-12-01T09:00:00+09:00", at("2026-12-01T08:59:59+09:00")), false);
  assert.equal(isOpened("2026-12-01T09:00:00+09:00", at("2026-12-01T09:00:00+09:00")), true);
  assert.equal(isOpened(null, 0), true, "개강 시각을 모르면 막지 않아요");
  assert.equal(openLabel("2026-12-01T09:00:00+09:00"), "12/1(화) 오전 9시");
});

test("강의 열람: 개강일 9시 전에는 납부 완료여도 닫혀 있어요, 지난달은 다음 달 개강일 0시에 닫혀요", () => {
  const dec = { until: "2027-01-03", openAt: openAtOf("2026-12-01") };
  const nov = { until: "2026-11-30", openAt: openAtOf("2026-11-02") };
  assert.equal(canViewNow(dec, "2026-11-30", at("2026-11-30T23:00:00+09:00")), false);
  assert.equal(canViewNow(dec, "2026-12-01", at("2026-12-01T08:30:00+09:00")), false);
  assert.equal(canViewNow(dec, "2026-12-01", at("2026-12-01T09:00:00+09:00")), true);
  assert.equal(canViewNow(nov, "2026-11-30", at("2026-11-30T23:59:00+09:00")), true);
  assert.equal(canViewNow(nov, "2026-12-01", at("2026-12-01T00:00:00+09:00")), false);
  // 강의실에서 읽는 기수
  const w = new Map([["n", nov], ["d", dec]]);
  const apps = [{ id: "n", cohort: "2026-11" }, { id: "d", cohort: "2026-12" }];
  assert.deepEqual(viewableCohorts(apps, w, "2026-11-30", at("2026-11-30T12:00:00+09:00")), ["2026-11"]);
  assert.deepEqual(viewableCohorts(apps, w, "2026-12-01", at("2026-12-01T08:00:00+09:00")), []);
  assert.deepEqual(viewableCohorts(apps, w, "2026-12-01", at("2026-12-01T09:30:00+09:00")), ["2026-12"]);
});

test("등급: 11월 수강생 → 12/1 0시 일반, 12월 신청은 9시까지 예비 → 9시부터 수강생", () => {
  const novOnly = [{ cohort: "2026-11", status: "paid" }];
  assert.deepEqual(gradeOf(novOnly, windows, "2026-11-27", at("2026-11-27T12:00:00+09:00")).grades, ["student"]);
  assert.deepEqual(gradeOf(novOnly, windows, "2026-12-01", at("2026-12-01T00:00:00+09:00")).grades, ["general"]);

  const both = [{ cohort: "2026-11", status: "shipped" }, { cohort: "2026-12", status: "paid" }];
  const g1 = gradeOf(both, windows, "2026-11-27", at("2026-11-27T12:00:00+09:00"));
  assert.deepEqual(g1.grades, ["student", "pre"]);
  assert.deepEqual(g1.current, ["2026-11"]);
  assert.deepEqual(g1.pre, [{ cohort: "2026-12", pending: false }]);
  assert.deepEqual(gradeOf(both, windows, "2026-12-01", at("2026-12-01T08:00:00+09:00")).grades, ["pre"]);
  const g3 = gradeOf(both, windows, "2026-12-01", at("2026-12-01T09:00:00+09:00"));
  assert.deepEqual(g3.grades, ["student"]);
  assert.deepEqual(g3.current, ["2026-12"]);
});

test("등급: 예비수강생 입금 대기 표시, 수업 중 낸 입금 대기 신청도 예비, 환불·취소는 등급 없음", () => {
  const pend = gradeOf([{ cohort: "2026-12", status: "pending" }], windows, "2026-11-27", at("2026-11-27T12:00:00+09:00"));
  assert.deepEqual(pend.grades, ["pre"]);
  assert.deepEqual(pend.pre, [{ cohort: "2026-12", pending: true }]);
  // 같은 기수에 입금 대기 + 납부 완료면 '입금 대기'가 아니에요
  assert.deepEqual(gradeOf([{ cohort: "2026-12", status: "pending" }, { cohort: "2026-12", status: "paid" }], windows, "2026-11-27", 0).pre, [{ cohort: "2026-12", pending: false }]);
  // 중간 등록: 수업 중인 11월에 막 낸 신청(입금 대기)
  assert.deepEqual(gradeOf([{ cohort: "2026-11", status: "pending" }], windows, "2026-11-10", at("2026-11-10T12:00:00+09:00")).pre, [{ cohort: "2026-11", pending: true }]);
  assert.deepEqual(gradeOf([{ cohort: "2026-11", status: "refunded" }], windows, "2026-11-10", at("2026-11-10T12:00:00+09:00")).grades, ["general"]);
  assert.deepEqual(gradeOf([{ cohort: "2026-12", status: "cancelled" }], windows, "2026-11-27", 0).grades, ["general"]);
  // 10월만 들은 학생은 일반
  assert.deepEqual(gradeOf([{ cohort: "2026-10", status: "paid" }], windows, "2026-11-27", at("2026-11-27T12:00:00+09:00")).grades, ["general"]);
});

test("학생 묶기: 개인번호 → 카카오·구글 번호, 번호 없는 예전 신청은 같은 이름 묶음이 하나일 때만 붙여요", () => {
  const apps = [
    { id: "1", name: "박지은", student_no: "100001", account_id: "acc-1" },
    { id: "2", name: "박지은", student_no: null, account_id: "acc-1" }, // 같은 계정
    { id: "3", name: "박 지은", student_no: null, account_id: null }, // 이름만 → 박지은 묶음 하나 → 붙임
    { id: "4", name: "김민수", student_no: "100002", account_id: null },
    { id: "5", name: "김민수", student_no: "100003", account_id: null }, // 동명이인
    { id: "6", name: "김민수", student_no: null, account_id: null }, // 김민수 묶음이 둘 → 따로
    { id: "7", name: "이서윤", student_no: null, account_id: null },
  ];
  const groups = groupStudents(apps).map((g) => g.map((a) => a.id).sort());
  assert.deepEqual(groups, [["1", "2", "3"], ["4"], ["5"], ["6"], ["7"]]);
});

test("최근 접속 표시", () => {
  assert.equal(seenLabel(null, "2026-11-27"), "-");
  assert.equal(seenLabel("2026-11-27T01:00:00Z", "2026-11-27"), "오늘");
  assert.equal(seenLabel("2026-11-26T16:00:00Z", "2026-11-27"), "오늘", "한국 시간 11/27 01시");
  assert.equal(seenLabel("2026-11-26T03:00:00Z", "2026-11-27"), "어제");
  assert.equal(seenLabel("2026-11-24T03:00:00Z", "2026-11-27"), "3일 전");
  assert.equal(seenLabel("2026-11-02T03:00:00Z", "2026-11-27"), "11/2");
});
