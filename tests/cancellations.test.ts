// 교재비 신청·인강 주문 30분 입금 규칙 + 자동 취소 테스트 (임시 저장소에서만)
import { test } from "node:test";
import assert from "node:assert/strict";
import { depositDeadline, expireUnpaid, purgeTimedOut, visibleToAdmin } from "@/lib/cancellations";
import { createApplication, createDepositEvent, createYbmOrder, getApplication, getYbmOrder, isPreview, listDepositEvents, setSetting, updateApplication, type Application } from "@/lib/db";
import { handleBankSms } from "@/lib/deposits";
import { hashPin, checkPin } from "@/lib/auth";
import { isActive, loginApps } from "@/lib/access";
import { recentApplications } from "@/lib/adminAlerts";
import { boardsFor } from "@/lib/gifts";

const MIN = 60 * 1000;
const T0 = Date.parse("2026-10-29T01:00:00Z"); // 규칙을 켠 시각

async function newApp(name: string, createdMs: number, depositor = name, amount = 30000): Promise<Application> {
  const id = await createApplication({
    cohort: "2026-11", kind: "onsite", course: "start", track: "all", continuing: false, slot: "am", pickup_date: null, pickup_time: null,
    books: ["concept", "start_rc", "lc1"], pickup: "classroom", name, phone: null, depositor, address: null, amount, pin_hash: hashPin("1234"),
  });
  const a = (await getApplication(id))!;
  a.created_at = new Date(createdMs).toISOString(); // 임시 저장소라 직접 바꿔요
  return a;
}

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

test("30분 지난 새 신청은 자동 취소(timeout)", async () => {
  await setSetting("deposit_timeout_from", new Date(T0).toISOString());
  const a = await newApp("삼십분", T0 + MIN);
  await expireUnpaid(T0 + 20 * MIN);
  assert.equal((await getApplication(a.id))?.status, "pending"); // 아직 20분
  await expireUnpaid(T0 + 32 * MIN);
  const b = (await getApplication(a.id))!;
  assert.equal(b.status, "cancelled");
  assert.equal(b.cancel_reason, "timeout");
});

test("규칙을 켜기 전 신청은 자동 취소하지 않아요", async () => {
  await setSetting("deposit_timeout_from", new Date(T0).toISOString());
  const old = await newApp("예전신청", T0 - 60 * MIN);
  assert.equal(depositDeadline(old, new Date(T0).toISOString()), null);
  await expireUnpaid(T0 + 3 * 86400000);
  assert.equal((await getApplication(old.id))?.status, "pending");
});

test("인강 주문도 30분 지나면 자동 취소", async () => {
  await setSetting("deposit_timeout_from", new Date(T0).toISOString());
  const id = await createYbmOrder({ name: "인강늦음", phone: "01011112222", address: "[48000] 부산 테스트로 1, 101호", depositor: "인강늦음", amount: 14000 }, { data: Buffer.from("x"), type: "image/jpeg" });
  (await getYbmOrder(id))!.created_at = new Date(T0 + MIN).toISOString();
  await expireUnpaid(T0 + 40 * MIN);
  assert.equal((await getYbmOrder(id))?.status, "cancelled");
});

test("자동 취소 후 24시간 안 늦은 입금은 입금자명 기준으로 되살려 납부 확인", async () => {
  await setSetting("deposit_timeout_from", "2000-01-01T00:00:00Z");
  const a = await newApp("늦은학생", Date.now() - 2 * 3600 * 1000, "늦은엄마", 30000);
  await updateApplication(a.id, { status: "cancelled", cancel_reason: "timeout", cancelled_at: new Date(Date.now() - 3600 * 1000).toISOString() });
  assert.equal((await handleBankSms("[신한은행] 입금 30,000원 늦은엄마")).result, "matched");
  const b = (await getApplication(a.id))!;
  assert.equal(b.status, "paid");
  assert.equal(b.cancel_reason, null);
  assert.ok(b.paid_at);
});

test("되살릴 후보가 여러 명이면 확정하지 않고 '확인 필요'", async () => {
  await setSetting("deposit_timeout_from", "2000-01-01T00:00:00Z");
  for (const n of ["쌍둥1", "쌍둥2"]) {
    const a = await newApp(n, Date.now() - 2 * 3600 * 1000, "같은입금자", 20000);
    await updateApplication(a.id, { status: "cancelled", cancel_reason: "timeout", cancelled_at: new Date(Date.now() - 600 * 1000).toISOString() });
  }
  assert.equal((await handleBankSms("[신한은행] 입금 20,000원 같은입금자")).result, "review");
});

test("자동 취소는 관리자 목록에 안 보이고, 관리자 취소는 보여요 (최근 신청 포함)", async () => {
  const t = await newApp("숨김취소", Date.now());
  await updateApplication(t.id, { status: "cancelled", cancel_reason: "timeout", cancelled_at: new Date().toISOString() });
  const m = await newApp("관리취소", Date.now());
  await updateApplication(m.id, { status: "cancelled", cancel_reason: "admin", cancelled_at: new Date().toISOString() });
  assert.equal(visibleToAdmin((await getApplication(t.id))!), false);
  assert.equal(visibleToAdmin((await getApplication(m.id))!), true);
  const recent = await recentApplications();
  assert.equal(recent.some((x) => x.id === t.id), false);
  assert.equal(recent.find((x) => x.id === m.id)?.warn, "취소");
});

test("자동 취소 7일 뒤 삭제, 입금 기록은 남고 연결만 풀려요", async () => {
  const a = await newApp("칠일삭제", Date.now() - 9 * 86400000);
  await updateApplication(a.id, { status: "cancelled", cancel_reason: "timeout", cancelled_at: new Date(Date.now() - 8 * 86400000).toISOString() });
  await createDepositEvent({ target: "book", name: "칠일삭제", amount: 30000, result: "resolved", registration_id: null, application_id: a.id, ybm_order_id: null });
  await purgeTimedOut();
  assert.equal(await getApplication(a.id), null);
  const ev = (await listDepositEvents(1000)).find((e) => e.name === "칠일삭제");
  assert.ok(ev);
  assert.equal(ev?.application_id, null);
});

test("취소된 신청만 있으면 로그인 대신 취소 안내, 같은 이름·비밀번호로 다시 신청하면 새 신청으로", async () => {
  const old = await newApp("다시신청", Date.now() - 3600 * 1000);
  await updateApplication(old.id, { status: "cancelled", cancel_reason: "timeout", cancelled_at: new Date().toISOString() });
  const c = (await getApplication(old.id))!;
  assert.equal(isActive(c), false); // 중복 검사(isActive)에서 빠져요
  const r1 = loginApps([c], (a) => checkPin("1234", a.pin_hash));
  assert.equal(r1.cancelledId, c.id);
  const fresh = await newApp("다시신청", Date.now());
  const r2 = loginApps([c, fresh], (a) => checkPin("1234", a.pin_hash));
  assert.deepEqual(r2.apps?.map((a) => a.id), [fresh.id]);
});

test("취소 신청은 스티커판·선물 집계에서 빠져요", async () => {
  const a = await newApp("집계제외", Date.now());
  await updateApplication(a.id, { status: "cancelled", cancel_reason: "admin", cancelled_at: new Date().toISOString() });
  assert.equal((await boardsFor([(await getApplication(a.id))!])).length, 0);
});

test("관리자 취소 되살리기: 입금 대기로, 30분 타이머는 되살린 시각부터 새로", async () => {
  await setSetting("deposit_timeout_from", new Date(T0).toISOString());
  const a = await newApp("되살림", T0 + MIN);
  await updateApplication(a.id, { status: "cancelled", cancel_reason: "admin", cancelled_at: new Date(T0 + 5 * MIN).toISOString() });
  const revivedAt = T0 + 3 * 3600 * 1000;
  await updateApplication(a.id, { status: "pending", cancel_reason: null, cancelled_at: null, pending_from: new Date(revivedAt).toISOString() });
  await expireUnpaid(revivedAt + 10 * MIN);
  assert.equal((await getApplication(a.id))?.status, "pending"); // 되살린 지 10분
  await expireUnpaid(revivedAt + 31 * MIN);
  assert.equal((await getApplication(a.id))?.status, "cancelled");
});

// ── 보완: 다시 신청한 학생의 입금 · 확인 필요 후보는 자동 취소하지 않기 ──
test("자동 취소 → 다시 신청 → 입금하면 새 신청이 납부 확인 (옛 신청은 그대로 취소)", async () => {
  await setSetting("deposit_timeout_from", "2000-01-01T00:00:00Z");
  const old = await newApp("재신청생", Date.now() - 2 * 3600 * 1000, "재신청생", 30000);
  await updateApplication(old.id, { status: "cancelled", cancel_reason: "timeout", cancelled_at: new Date(Date.now() - 3600 * 1000).toISOString() });
  const fresh = await newApp("재신청생", Date.now(), "재신청생", 30000);
  assert.equal((await handleBankSms("[신한은행] 입금 30,000원 재신청생")).result, "matched");
  assert.equal((await getApplication(fresh.id))?.status, "paid");
  assert.equal((await getApplication(old.id))?.status, "cancelled");
});

test("'확인 필요' 입금의 후보 신청은 30분이 지나도 자동 취소되지 않아요", async () => {
  await setSetting("deposit_timeout_from", "2000-01-01T00:00:00Z");
  const a = await newApp("확인필요1", Date.now(), "같은입금", 40000);
  const b = await newApp("확인필요2", Date.now(), "같은입금", 40000);
  assert.equal((await handleBankSms("[신한은행] 입금 40,000원 같은입금")).result, "review");
  await expireUnpaid(Date.now() + 2 * 3600 * 1000);
  assert.equal((await getApplication(a.id))?.status, "pending");
  assert.equal((await getApplication(b.id))?.status, "pending");
});
