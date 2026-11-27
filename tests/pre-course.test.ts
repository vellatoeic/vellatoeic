// 개강 전 학생: 단톡방은 반 개강 전날부터, 개강 전 학생에게 '○월 수업 준비 중' 카드
import { test } from "node:test";
import assert from "node:assert/strict";
import { chatGate, pickPreCourse } from "@/lib/preCourse";

test("단톡방: 개강 전날부터 열려요, 그 전에는 여는 날만", () => {
  assert.deepEqual(chatGate(["2026-12-01"], "2026-11-20"), { open: false, opensOn: "2026-11-30" });
  assert.deepEqual(chatGate(["2026-12-01"], "2026-11-30"), { open: true });
  assert.deepEqual(chatGate(["2026-12-01"], "2026-12-03"), { open: true });
  // 11월 수강 중 + 12월 신청(이어 듣는 학생): 11월 반이 이미 열려 있어서 그대로 보여요
  assert.deepEqual(chatGate(["2026-11-02", "2026-12-01"], "2026-11-20"), { open: true });
  // 대상 신청이 없으면 카드도 없어요, 수업일을 모르면 막지 않아요
  assert.equal(chatGate([], "2026-11-20"), null);
  assert.deepEqual(chatGate([null], "2026-11-20"), { open: true });
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

test("메모리 DB: 12월 불라방 학생이 11/20에 들어오면 개강 전 카드 + 단톡방은 11/30부터", async () => {
  const { setSetting, createApplication, getApplication, updateApplication } = await import("@/lib/db");
  const { preCourseFor, chatGateFor } = await import("@/lib/preCourse");
  const { scheduleKey } = await import("@/lib/schedule");
  const { hashPin } = await import("@/lib/auth");
  const C = "2026-12";
  await setSetting(scheduleKey(C, "solve-all"), JSON.stringify(["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-24"]));
  const id = await createApplication({
    cohort: C, kind: "online", course: "solve", track: "all", continuing: false, slot: "pm", pickup_date: null, pickup_time: null,
    books: ["solve_rc2", "lc2"], pickup: "delivery", name: "개강전학생", phone: "010-1111-2222", depositor: "개강전학생", address: "부산 사하구 낙동대로 1", amount: 24000, pin_hash: hashPin("1234"),
  });
  const pending = (await getApplication(id))!;
  // 입금 전: 카드는 보이고(교재비 확인 중), 단톡방 대상은 아니에요
  assert.equal((await preCourseFor([pending], "2026-11-20"))?.first, "2026-12-01");
  assert.equal(await chatGateFor([pending], "2026-11-20"), null);
  await updateApplication(id, { status: "paid" });
  const paid = (await getApplication(id))!;
  assert.deepEqual(await chatGateFor([paid], "2026-11-20"), { open: false, opensOn: "2026-11-30" });
  assert.deepEqual(await chatGateFor([paid], "2026-11-30"), { open: true });
  assert.equal(await preCourseFor([paid], "2026-12-01"), null);
});
