// 보증금 입금 문자 자동 확인 테스트. 임시 저장소(가짜 데이터)에서만 실행돼요.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleBankSms } from "@/lib/deposits";
import { createSpecialLecture, createSpecialRegistration, expireSpecialDeposits, isPreview, listDepositEvents, listSpecialLectures, listSpecialRegistrations } from "@/lib/db";

async function setup() {
  await createSpecialLecture({ event_date: "2026-10-17", title: "테스트 특강", starts_at: "10:00", ends_at: null });
  const event = (await listSpecialLectures()).at(-1)!;
  const add = (name: string, mode: "onsite" | "online" = "onsite") =>
    createSpecialRegistration({ special_lecture_id: event.id, application_id: null, mode, name, deposit: mode === "onsite" ? "pending" : null });
  return { event, add, find: async (id: string) => (await listSpecialRegistrations(event.id)).find((r) => r.id === id)! };
}

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

test("이름·금액이 한 명과 맞으면 자동 확정", async () => {
  const { add, find } = await setup();
  const id = await add("김하나");
  const r = await handleBankSms("[신한은행] 입금 10,000원 김하나 잔액 50,000원");
  assert.equal(r.result, "matched");
  assert.equal((await find(id)).deposit, "paid");
});

test("같은 이름 대기 신청이 2건이면 확정하지 않고 기록만 '확인 필요' (신청은 그대로)", async () => {
  const { add, find } = await setup();
  const a = await add("이두리");
  const b = await add("이두리");
  const r = await handleBankSms("[카카오뱅크] 이두리님이 10,000원을 입금했습니다.");
  assert.equal(r.result, "review");
  assert.equal((await find(a)).deposit, "pending");
  assert.equal((await find(b)).deposit, "pending");
});

test("맞는 신청이 없으면 '확인 필요'로 기록만", async () => {
  await setup();
  assert.equal((await handleBankSms("[우리은행] 입금 10,000원 10/07 1002***1 없는사람 잔액 1원")).result, "unmatched");
});

test("금액이 1만 원이 아니면 무시하고 기록도 남기지 않아요", async () => {
  const { add, find } = await setup();
  const id = await add("박세나");
  const before = (await listDepositEvents(1000)).length;
  assert.equal((await handleBankSms("[신한은행] 입금 20,000원 박세나")).result, "ignored");
  assert.equal((await find(id)).deposit, "pending");
  assert.equal((await listDepositEvents(1000)).length, before);
});

test("불라방 신청은 보증금 대상이 아니에요", async () => {
  const { add, find } = await setup();
  const id = await add("최온라", "online");
  assert.equal((await handleBankSms("[신한은행] 입금 10,000원 최온라")).result, "unmatched");
  assert.equal((await find(id)).deposit, null);
});

test("신청 후 30분이 지나면 자동 취소되고, 늦은 입금은 확정되지 않아요", async () => {
  const { add, find } = await setup();
  const id = await add("정늦음");
  (await find(id)).created_at = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  await expireSpecialDeposits(30);
  assert.equal((await find(id)).deposit, "cancelled");
  assert.equal((await handleBankSms("[신한은행] 입금 10,000원 정늦음")).result, "unmatched");
  assert.equal((await find(id)).deposit, "cancelled");
});

test("신청 후 30분 안이면 취소되지 않아요", async () => {
  const { add, find } = await setup();
  const id = await add("한아직");
  (await find(id)).created_at = new Date(Date.now() - 29 * 60 * 1000).toISOString();
  await expireSpecialDeposits(30);
  assert.equal((await find(id)).deposit, "pending");
});

test("웹훅은 30분 지난 대기 신청을 확정하지 않고, 취소 등 다른 변경도 하지 않아요", async () => {
  const { add, find } = await setup();
  const id = await add("오지각");
  (await find(id)).created_at = new Date(Date.now() - 40 * 60 * 1000).toISOString();
  assert.equal((await handleBankSms("[신한은행] 입금 10,000원 오지각")).result, "unmatched");
  assert.equal((await find(id)).deposit, "pending");
});

test("문자 원문은 저장하지 않고 이름·금액·시각·결과만 남겨요", async () => {
  const e = (await listDepositEvents(1))[0];
  assert.deepEqual(Object.keys(e).sort(), ["amount", "id", "name", "received_at", "registration_id", "result", "target"]);
});
