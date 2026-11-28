// 개강 전 학생: 단톡방은 달마다 새 방(자기 수강 달 방만, 개강 전날 ~ 열람 마감일), 개강 전 학생에게 '○월 수업 준비 중' 카드,
// 공지 '대상 수강 월'(신규생에게 지난달 공지는 안 보여요)
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickChat, pickPreCourse } from "@/lib/preCourse";
import { isForEveryone, myNotices, noticeMatches, type Notice } from "@/lib/notices";

const NOV = { cohort: "2026-11", first: "2026-11-02", until: "2026-11-30", hasLink: true };
const DEC = { cohort: "2026-12", first: "2026-12-01", until: "2027-01-03", hasLink: true };

test("단톡방: 자기 수강 달 방만, 개강 전날부터 열람 마감일까지", () => {
  // 12월 신규생: 11/20에는 '11/30부터', 11/30부터 12월 방
  assert.deepEqual(pickChat([DEC], "2026-11-20"), { cohort: "2026-12", open: false, opensOn: "2026-11-30" });
  assert.deepEqual(pickChat([DEC], "2026-11-30"), { cohort: "2026-12", open: true });
  // 11월만 듣는 학생: 11월 방은 11/30(열람 마감)까지, 12월 방은 안 보여요
  assert.deepEqual(pickChat([NOV], "2026-11-20"), { cohort: "2026-11", open: true });
  assert.equal(pickChat([NOV], "2026-12-01"), null);
  // 11월 → 12월 이어 듣는 학생: 11월에는 11월 방, 11/30부터 12월 방(새 방)
  assert.deepEqual(pickChat([NOV, DEC], "2026-11-20"), { cohort: "2026-11", open: true });
  assert.deepEqual(pickChat([NOV, DEC], "2026-11-30"), { cohort: "2026-12", open: true });
  // 12월 방 링크를 아직 안 넣었으면 11월 방 그대로
  assert.deepEqual(pickChat([NOV, { ...DEC, hasLink: false }], "2026-11-30"), { cohort: "2026-11", open: true });
  assert.equal(pickChat([], "2026-11-20"), null);
});

test("개강 전 학생: 수업 중인 신청이 없고 다가오는 신청이 있을 때만", () => {
  const dec = { app: { id: "dec" }, days: ["2026-12-01", "2026-12-24"] };
  const nov = { app: { id: "nov" }, days: ["2026-11-02", "2026-11-26"] };
  assert.deepEqual(pickPreCourse([dec], "2026-11-20"), { app: { id: "dec" }, first: "2026-12-01", dStart: 11 });
  assert.equal(pickPreCourse([nov, dec], "2026-11-20"), null); // 11월 수업 중
  assert.equal(pickPreCourse([nov, dec], "2026-11-27")?.app.id, "dec"); // 11월 종강 뒤 ~ 12월 개강 전
  assert.equal(pickPreCourse([dec], "2026-12-01"), null); // 개강일부터는 카드 없음
  assert.equal(pickPreCourse([{ app: { id: "x" }, days: [] }], "2026-11-20"), null);
});

test("공지 대상 수강 월: 그 달 수강생에게만, 방문자에게는 안 보여요", () => {
  const base = { id: "n", title: "t", to_label: "", lead: "", sections: [], link_label: null, link_url: null, targets: [], starts_on: "2026-11-01", ends_on: "2026-12-31", popup: true, pinned: false, created_at: "2026-11-01" };
  const nov: Notice = { ...base, id: "nov", cohort: "2026-11" };
  const dec: Notice = { ...base, id: "dec", cohort: "2026-12" };
  const all: Notice = { ...base, id: "all", cohort: null };
  const s = (cohort: string) => ({ course: "solve" as const, track: "all" as const, kind: "online" as const, slot: "pm" as const, cohort });
  // 12월 신규생: 11월 공지는 안 보여요
  assert.deepEqual(myNotices([nov, dec, all], [s("2026-12")], "2026-11-28").map((n) => n.id).sort(), ["all", "dec"]);
  // 11월 수업 중 + 12월 신청(이어 듣는 학생): 둘 다
  assert.deepEqual(myNotices([nov, dec, all], [s("2026-11")], "2026-11-20", [s("2026-12")]).map((n) => n.id).sort(), ["all", "dec", "nov"]);
  // 방문자: 모든 달 + 조건 없는 공지만
  assert.equal(isForEveryone(all), true);
  assert.equal(isForEveryone(dec), false);
  assert.equal(noticeMatches(dec, []), false);
  // 반 조건 + 수강 월: 둘 다 맞아야
  const decStart: Notice = { ...dec, targets: [{ courses: ["start"] }] };
  assert.equal(noticeMatches(decStart, [s("2026-12")]), false);
  assert.equal(noticeMatches(decStart, [{ ...s("2026-12"), course: "start" }]), true);
});

test("메모리 DB: 단톡방은 그 달 링크로, 12월 신규생은 11/30부터", async () => {
  const { setSetting, createApplication, getApplication, updateApplication } = await import("@/lib/db");
  const { preCourseFor, chatRoomFor, chatUrlKey, chatCodeKey } = await import("@/lib/preCourse");
  const { scheduleKey } = await import("@/lib/schedule");
  const { hashPin } = await import("@/lib/auth");
  const C = "2026-12";
  await setSetting(scheduleKey(C, "solve-all"), JSON.stringify(["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-24"]));
  await setSetting(chatUrlKey("2026-11"), "https://open.kakao.com/o/november");
  const id = await createApplication({
    cohort: C, kind: "online", course: "solve", track: "all", continuing: false, slot: "pm", pickup_date: null, pickup_time: null,
    books: ["solve_rc2", "lc2"], pickup: "delivery", name: "개강전학생", phone: "010-1111-2222", depositor: "개강전학생", address: "부산 사하구 낙동대로 1", amount: 24000, pin_hash: hashPin("1234"),
  });
  const pending = (await getApplication(id))!;
  // 입금 전: 준비 카드는 보이고, 단톡방 대상은 아니에요
  assert.equal((await preCourseFor([pending], "2026-11-20"))?.first, "2026-12-01");
  assert.equal(await chatRoomFor([pending], "2026-11-20"), null);
  await updateApplication(id, { status: "paid" });
  const paid = (await getApplication(id))!;
  assert.deepEqual(await chatRoomFor([paid], "2026-11-20"), { state: "soon", cohort: C, opensOn: "2026-11-30" });
  // 12월 링크를 아직 안 넣었으면 '곧 올라와요' (11월 방은 안 보여요)
  assert.deepEqual(await chatRoomFor([paid], "2026-11-30"), { state: "waiting", cohort: C });
  await setSetting(chatUrlKey(C), "https://open.kakao.com/o/december");
  await setSetting(chatCodeKey(C), "1201");
  assert.deepEqual(await chatRoomFor([paid], "2026-11-30"), { state: "open", cohort: C, url: "https://open.kakao.com/o/december", code: "1201" });
  assert.equal(await preCourseFor([paid], "2026-12-01"), null);
});
