// 보증금 입금 문자 자동 확인 테스트. 임시 저장소(가짜 데이터)에서만 실행돼요.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleBankSms } from "@/lib/deposits";
import { createSpecialLecture, createSpecialRegistration, expireSpecialDeposits, isPreview, listDepositEvents, listSpecialLectures, listSpecialRegistrations } from "@/lib/db";

async function setup() {
  await createSpecialLecture({ event_date: "2026-10-17", title: "테스트 특강", starts_at: "10:00", ends_at: null, registration_deadline: null });
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

test("맞는 신청이 없고 교재비로 가능한 금액이면 '신청서 대기'로 기록 (특강 신청도 없음)", async () => {
  await setup();
  assert.equal((await handleBankSms("[우리은행] 입금 10,000원 10/07 1002***1 없는사람 잔액 1원")).result, "waiting");
});

test("교재비로도 불가능한 금액이면 무시하고 기록도 남기지 않아요", async () => {
  const { add, find } = await setup();
  const id = await add("박세나");
  const before = (await listDepositEvents(1000)).length;
  assert.equal((await handleBankSms("[신한은행] 입금 25,000원 박세나")).result, "ignored");
  assert.equal((await find(id)).deposit, "pending");
  assert.equal((await listDepositEvents(1000)).length, before);
});

test("불라방 신청은 보증금 대상이 아니에요", async () => {
  const { add, find } = await setup();
  const id = await add("최온라", "online");
  // 불라방은 보증금이 없어서 특강 입금으로 보지 않아요 → 교재비일 수 있어 '신청서 대기'
  assert.equal((await handleBankSms("[신한은행] 입금 10,000원 최온라")).result, "waiting");
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
  assert.deepEqual(Object.keys(e).sort(), ["amount", "application_id", "id", "name", "received_at", "registration_id", "result", "target", "ybm_order_id"]);
});

// ── 교재비 입금 자동 확인 ──
import { createApplication, getApplication } from "@/lib/db";
import { hashPin } from "@/lib/auth";

const newApp = (depositor: string, amount: number) => createApplication({
  cohort: "2026-10", kind: "online", course: "start", track: "all", continuing: false, slot: "am", pickup_date: null, pickup_time: null,
  books: ["concept", "start_rc", "lc1"], pickup: "classroom", name: depositor, phone: "01000000000", depositor, address: null, amount, pin_hash: hashPin("1234"),
});

test("교재비: 입금자명·금액이 한 명과 맞으면 자동 납부 확인", async () => {
  const id = await newApp("문교재", 30000);
  assert.equal((await handleBankSms("[신한은행] 입금 30,000원 문교재 잔액 1원")).result, "matched");
  assert.equal((await getApplication(id))?.status, "paid");
});

test("교재비: 같은 입금자명·금액 신청이 2건이면 확정하지 않고 '확인 필요'", async () => {
  const a = await newApp("쌍둥이", 20000);
  const b = await newApp("쌍둥이", 20000);
  assert.equal((await handleBankSms("[신한은행] 입금 20,000원 쌍둥이")).result, "review");
  assert.equal((await getApplication(a))?.status, "pending");
  assert.equal((await getApplication(b))?.status, "pending");
});

test("교재비: 입금자명은 맞는데 금액이 다르면 확정하지 않고 '확인 필요' 기록", async () => {
  const id = await newApp("금액다름", 34000);
  assert.equal((await handleBankSms("[신한은행] 입금 30,000원 금액다름")).result, "unmatched");
  assert.equal((await getApplication(id))?.status, "pending");
});

test("교재비 1만 원(LC 단과)과 특강 보증금 1만 원이 같은 이름으로 겹치면 '확인 필요'", async () => {
  const { add, find } = await setup();
  const reg = await add("겹침이");
  const app = await newApp("겹침이", 10000);
  assert.equal((await handleBankSms("[신한은행] 입금 10,000원 겹침이")).result, "review");
  assert.equal((await find(reg)).deposit, "pending");
  assert.equal((await getApplication(app))?.status, "pending");
});

test("우리 학생과 관계없는 입금은 기록하지 않아요", async () => {
  const before = (await listDepositEvents(1000)).length;
  assert.equal((await handleBankSms("[신한은행] 입금 55,000원 모르는분")).result, "ignored");
  assert.equal((await listDepositEvents(1000)).length, before);
});

test("이미 납부 확인된 신청은 다시 바꾸지 않아요", async () => {
  const id = await newApp("이미납부", 10000);
  assert.equal((await handleBankSms("[신한은행] 입금 10,000원 이미납부")).result, "matched");
  assert.equal((await handleBankSms("[신한은행] 입금 10,000원 이미납부")).result, "waiting");
  assert.equal((await getApplication(id))?.status, "paid");
});

import { createYbmOrder, getYbmOrder } from "@/lib/db";

const newYbm = (name: string, depositor = name) =>
  createYbmOrder({ name, phone: "01011112222", address: "[48000] 부산 테스트로 1, 101호", depositor, amount: 14000 }, { data: Buffer.from("x"), type: "image/jpeg" });

test("YBM 인강: 입금자명·14,000원이 맞으면 자동 입금 확인 → 발송 대기", async () => {
  const id = await newYbm("인강생", "인강엄마");
  assert.equal((await handleBankSms("[농협] 입금 14,000원 인강엄마")).result, "matched");
  assert.equal((await getYbmOrder(id))?.status, "paid");
  const ev = (await listDepositEvents(1000)).find((e) => e.ybm_order_id === id);
  assert.equal(ev?.application_id ?? null, null);
});

test("YBM 인강 주문과 학원 택배 신청(14,000원)이 같은 이름으로 겹치면 '확인 필요'", async () => {
  const order = await newYbm("겹친인강");
  const app = await newApp("겹친인강", 14000);
  assert.equal((await handleBankSms("[농협] 입금 14,000원 겹친인강")).result, "review");
  assert.equal((await getYbmOrder(order))?.status, "pending");
  assert.equal((await getApplication(app))?.status, "pending");
});

test("YBM 인강: 금액이 다르면 확정하지 않고 '확인 필요' 기록", async () => {
  const id = await newYbm("만원만");
  assert.equal((await handleBankSms("[농협] 입금 10,000원 만원만")).result, "unmatched");
  assert.equal((await getYbmOrder(id))?.status, "pending");
});

import { cleanupYbmOrders, updateYbmOrders } from "@/lib/db";

test("YBM 인강: 발송 3개월 지난 주문은 개인정보째 지우고, 그 전 주문은 남겨요", async () => {
  const old = await newYbm("오래된주문");
  const recent = await newYbm("최근주문");
  const day = 24 * 3600 * 1000;
  await updateYbmOrders([old], { status: "shipped", shipped_at: new Date(Date.now() - 91 * day).toISOString() });
  await updateYbmOrders([recent], { status: "shipped", shipped_at: new Date(Date.now() - 10 * day).toISOString() });
  await cleanupYbmOrders();
  assert.equal(await getYbmOrder(old), null);
  assert.equal((await getYbmOrder(recent))?.name, "최근주문");
});

// ── 신청서보다 먼저 온 입금 (G) ──
import { isBookAmount, linkWaitingDeposit } from "@/lib/deposits";

test("교재비로 가능한 금액: 1~4권 ± 택배비, 인강 주문 1만 4천 원", () => {
  for (const n of [10000, 14000, 20000, 24000, 30000, 34000, 40000, 44000]) assert.equal(isBookAmount(n), true, String(n));
  for (const n of [5000, 25000, 50000, 55000, 13000]) assert.equal(isBookAmount(n), false, String(n));
});

test("입금이 먼저 오고 신청서가 나중에 오면 자동으로 납부 확인", async () => {
  assert.equal((await handleBankSms("[신한은행] 입금 30,000원 선입금")).result, "waiting");
  const id = await newApp("선입금", 30000);
  assert.equal(await linkWaitingDeposit({ kind: "app", id, depositor: "선입금", amount: 30000 }), "linked");
  assert.equal((await getApplication(id))?.status, "paid");
  const ev = (await listDepositEvents(1000)).find((e) => e.application_id === id);
  assert.equal(ev?.result, "resolved");
});

test("금액이 다르면 연결하지 않아요", async () => {
  await handleBankSms("[신한은행] 입금 20,000원 금액틀림");
  const id = await newApp("금액틀림", 30000);
  assert.equal(await linkWaitingDeposit({ kind: "app", id, depositor: "금액틀림", amount: 30000 }), "none");
  assert.equal((await getApplication(id))?.status, "pending");
});

test("같은 이름·금액 대기 입금이 여러 건이면 확정하지 않고 '확인 필요'", async () => {
  await handleBankSms("[신한은행] 입금 20,000원 두번입금");
  await handleBankSms("[신한은행] 입금 20,000원 두번입금");
  const id = await newApp("두번입금", 20000);
  assert.equal(await linkWaitingDeposit({ kind: "app", id, depositor: "두번입금", amount: 20000 }), "review");
  assert.equal((await getApplication(id))?.status, "pending");
});

test("인강 주문보다 먼저 온 1만 4천 원도 주문이 들어오면 연결", async () => {
  await handleBankSms("[농협] 입금 14,000원 인강먼저");
  const id = await newYbm("인강먼저");
  assert.equal(await linkWaitingDeposit({ kind: "ybm", id, depositor: "인강먼저", amount: 14000 }), "linked");
  assert.equal((await getYbmOrder(id))?.status, "paid");
});
