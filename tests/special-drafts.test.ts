// 특강 자동 생성 · 마감 팝업 테스트 (임시 저장소에서만)
import { test } from "node:test";
import assert from "node:assert/strict";
import { publicSpecials, specialDatesFor } from "@/lib/specialPlan";
import { syncSpecialDrafts, weekdayKey } from "@/lib/specialDrafts";
import { specialDeadlineNotices, deadlinePopupOpen } from "@/lib/specialPopups";
import { createSpecialLecture, isPreview, listSpecialLectures, setSetting } from "@/lib/db";

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

test("1주차·3주차 날짜: 11월(11/2 월 개강) 금요일 → 11/6, 11/20", () => {
  assert.deepEqual(specialDatesFor("2026-11-02", 5), ["2026-11-06", "2026-11-20"]);
});

test("토요일이면 11/7, 11/21 · 화요일 개강(10/6)이어도 그 주 요일", () => {
  assert.deepEqual(specialDatesFor("2026-11-02", 6), ["2026-11-07", "2026-11-21"]);
  assert.deepEqual(specialDatesFor("2026-10-06", 5), ["2026-10-09", "2026-10-23"]);
});

test("초안 만들기: 2개 생성, 다시 눌러도 중복 없음, 요일을 바꾸면 초안만 날짜 이동", async () => {
  const cohort = "2027-03";
  await setSetting(weekdayKey(cohort), "5");
  const first = await syncSpecialDrafts(cohort);
  assert.equal(first.created, 2);
  assert.equal((await syncSpecialDrafts(cohort)).created, 0); // 중복 방지
  const drafts = (await listSpecialLectures()).filter((e) => e.event_date.startsWith(cohort));
  assert.equal(drafts.length, 2);
  assert.ok(drafts.every((e) => e.published === false));
  await setSetting(weekdayKey(cohort), "6");
  const moved = await syncSpecialDrafts(cohort);
  assert.equal(moved.moved, 2);
  const after = (await listSpecialLectures()).filter((e) => e.event_date.startsWith(cohort));
  assert.equal(after.length, 2);
  assert.ok(after.every((e) => new Date(`${e.event_date}T00:00:00Z`).getUTCDay() === 6));
});

test("같은 날짜 특강이 이미 있으면 초안을 만들지 않아요", async () => {
  const cohort = "2027-05";
  await setSetting(weekdayKey(cohort), "5");
  await createSpecialLecture({ event_date: "2027-05-07", title: "기존 특강", starts_at: "10:00", ends_at: null, registration_deadline: null });
  const r = await syncSpecialDrafts(cohort);
  assert.equal(r.created, 1); // 5/7은 이미 있어서 2차만
});

test("공개 전 초안은 학생에게 안 보여요", () => {
  const list = [{ id: "a", published: false }, { id: "b", published: true }, { id: "c" }];
  assert.deepEqual(publicSpecials(list).map((e) => e.id), ["b", "c"]);
});

// ── 마감 팝업 ──
const ev = { id: "ev1", event_date: "2026-11-06", starts_at: "10:00", registration_deadline: null, published: true }; // 마감 11/5 17:00
const at = (iso: string) => Date.parse(iso);

test("마감 팝업 기간: 마감 전날 00:00 ~ 마감 시각", () => {
  assert.equal(deadlinePopupOpen(ev, at("2026-11-03T23:59:00+09:00")), false);
  assert.equal(deadlinePopupOpen(ev, at("2026-11-04T00:00:00+09:00")), true);
  assert.equal(deadlinePopupOpen(ev, at("2026-11-05T16:59:00+09:00")), true);
  assert.equal(deadlinePopupOpen(ev, at("2026-11-05T17:00:00+09:00")), false);
});

test("마감 팝업 대상: 그 달 납부 완료 + 아직 신청 안 한 학생만", () => {
  const now = at("2026-11-05T09:00:00+09:00");
  const paidNov = { id: "p1", cohort: "2026-11", status: "paid" };
  assert.equal(specialDeadlineNotices([ev], [paidNov], [], now).length, 1);
  assert.equal(specialDeadlineNotices([ev], [paidNov], [{ special_lecture_id: "ev1", application_id: "p1", deposit: "pending" }], now).length, 0); // 이미 신청
  assert.equal(specialDeadlineNotices([ev], [paidNov], [{ special_lecture_id: "ev1", application_id: "p1", deposit: "cancelled" }], now).length, 1); // 취소됐으면 다시 안내
  assert.equal(specialDeadlineNotices([ev], [{ id: "p2", cohort: "2026-11", status: "pending" }], [], now).length, 0); // 미납
  assert.equal(specialDeadlineNotices([ev], [{ id: "p3", cohort: "2026-10", status: "paid" }], [], now).length, 0); // 다른 달
  assert.equal(specialDeadlineNotices([{ ...ev, published: false }], [paidNov], [], now).length, 0); // 초안
  const n = specialDeadlineNotices([ev], [paidNov], [], now)[0];
  assert.equal(n.title, "🎤 11/6(금) 특강 · 11/5(목) 17:00 신청 마감!");
  assert.equal(n.link_url, "/special");
});
