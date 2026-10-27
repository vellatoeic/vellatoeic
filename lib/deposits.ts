import "server-only";
import { DEPOSIT_MINUTES, SPECIAL_DEPOSIT } from "./config";
import { parseBankSms, sameName, type ParsedDeposit } from "./bankSms";
import { BOOK_PRICE, SHIPPING_FEE } from "./config";
import { createDepositEvent, listApplications, listSpecialRegistrations, listWaitingDepositEvents, listWaitingDeposits, listYbmOrders, updateApplications, updateDepositEvent, updateOnsiteRegistrations, updateYbmOrders, type DepositEvent } from "./db";

// ── 입금 문자 자동 확인 ─────────────────────────
// 아이폰 단축어가 은행 입금 문자를 /api/bank-sms 로 보내면 여기서 처리해요.
// 입금 종류(target)마다 처리기가 '이 입금에 맞는 대기 건'을 찾아요.
//   - 특강 보증금(special): 입금 대기(신청 후 30분 안) 현장 신청 · 이름 일치 · 10,000원
//   - 교재비(book): 입금 대기 수강 신청 · 입금자명 일치 · 교재비 금액 일치
//   - YBM 인강 교재(book): 입금 대기 인강 주문 · 입금자명 일치 · 14,000원
// 모든 처리기를 통틀어 딱 한 건만 맞으면 자동 확정, 두 건 이상이면 '확인 필요', 없으면 '확인 필요'(관련 있어 보일 때만 기록).
// 웹훅이 바꿀 수 있는 건 '입금 대기 → 확정(납부 확인)' 하나뿐이에요.

type Candidate = { target: DepositEvent["target"]; id: string; ybm?: boolean; confirm: () => Promise<void> };
type DepositHandler = {
  target: DepositEvent["target"];
  candidates: (d: ParsedDeposit) => Promise<Candidate[]>;
  // 맞는 건은 없지만 우리 학생 입금으로 보이는지 (그럴 때만 기록을 남겨 관리자가 확인해요)
  related: (d: ParsedDeposit) => Promise<boolean>;
};

const specialDepositHandler: DepositHandler = {
  target: "special",
  async candidates(d) {
    if (d.amount !== SPECIAL_DEPOSIT) return [];
    const cutoff = new Date(Date.now() - DEPOSIT_MINUTES * 60 * 1000).toISOString();
    return (await listWaitingDeposits())
      .filter((r) => r.deposit === "pending" && r.created_at >= cutoff && sameName(r.name, d.name))
      .map((r) => ({ target: "special" as const, id: r.id, confirm: () => updateOnsiteRegistrations([r.id], { deposit: "paid", deposit_paid_at: new Date().toISOString() }) }));
  },
  // 1만 원이면서 최근 이틀 안에 같은 이름 현장 특강 신청이 있을 때만 특강 입금으로 봐요 (없으면 교재비일 수 있어요)
  related: async (d) => {
    if (d.amount !== SPECIAL_DEPOSIT) return false;
    const since = new Date(Date.now() - 2 * 86400000).toISOString();
    return (await listSpecialRegistrations()).some((r) => r.mode === "onsite" && r.created_at >= since && sameName(r.name, d.name));
  },
};

const bookDepositHandler: DepositHandler = {
  target: "book",
  async candidates(d) {
    return (await listApplications())
      .filter((a) => a.status === "pending" && a.amount === d.amount && sameName(a.depositor, d.name))
      .map((a) => ({ target: "book" as const, id: a.id, confirm: () => updateApplications([a.id], { status: "paid" }) }));
  },
  // 입금자명이 같은 입금 대기 신청이 있으면(금액이 달라도) 기록해서 관리자가 확인해요.
  related: async (d) => (await listApplications()).some((a) => a.status === "pending" && sameName(a.depositor, d.name)),
};

// YBM 인강 교재 주문: 입금 대기 주문 · 입금자명 일치 · 14,000원 (교재비 종류로 기록)
const ybmDepositHandler: DepositHandler = {
  target: "book",
  async candidates(d) {
    return (await listYbmOrders())
      .filter((o) => o.status === "pending" && o.amount === d.amount && sameName(o.depositor, d.name))
      .map((o) => ({ target: "book" as const, id: o.id, ybm: true, confirm: () => updateYbmOrders([o.id], { status: "paid", paid_at: new Date().toISOString() }) }));
  },
  related: async (d) => (await listYbmOrders()).some((o) => o.status === "pending" && sameName(o.depositor, d.name)),
};

const HANDLERS: DepositHandler[] = [specialDepositHandler, bookDepositHandler, ybmDepositHandler];

// 문자에서 이름·금액만 뽑고 원문은 바로 버려요. 우리 학생 입금으로 보이지 않으면 기록도 남기지 않아요.
export async function handleBankSms(text: string): Promise<{ result: DepositEvent["result"] | "ignored" }> {
  const parsed = parseBankSms(text);
  if (!parsed) {
    await createDepositEvent({ target: "special", name: "", amount: 0, result: "unmatched", registration_id: null, application_id: null, ybm_order_id: null });
    return { result: "unmatched" };
  }
  const candidates = (await Promise.all(HANDLERS.map((h) => h.candidates(parsed)))).flat();
  const record = (result: DepositEvent["result"], target: DepositEvent["target"], c?: Candidate) =>
    createDepositEvent({
      target, name: parsed.name, amount: parsed.amount, result,
      registration_id: c?.target === "special" ? c.id : null,
      application_id: c?.target === "book" && !c.ybm ? c.id : null,
      ybm_order_id: c?.ybm ? c.id : null,
    });

  if (candidates.length === 1) {
    await candidates[0].confirm();
    await record("matched", candidates[0].target, candidates[0]);
    return { result: "matched" };
  }
  if (candidates.length > 1) {
    await record("review", candidates.every((c) => c.target === "special") ? "special" : candidates.every((c) => c.target === "book") ? "book" : "special");
    return { result: "review" };
  }
  for (const h of HANDLERS) {
    if (await h.related(parsed)) {
      await record("unmatched", h.target);
      return { result: "unmatched" };
    }
  }
  // 신청서보다 입금이 먼저 왔을 수 있어요: 교재비로 가능한 금액이면 이름·금액만 '신청서 대기'로 남겨요.
  // (교재비로 불가능한 금액은 지금처럼 아무것도 남기지 않아요)
  if (isBookAmount(parsed.amount)) {
    await record("waiting", "book");
    return { result: "waiting" };
  }
  return { result: "ignored" };
}

// 교재비로 가능한 금액: 교재 1~4권(1만 원씩) + 택배비 4천 원(선택). YBM 인강 주문 1만 4천 원도 여기에 들어가요.
export function isBookAmount(amount: number) {
  for (let n = 1; n <= 4; n++) if (amount === n * BOOK_PRICE || amount === n * BOOK_PRICE + SHIPPING_FEE) return true;
  return false;
}

// 새 신청서·인강 주문이 들어오면 최근 14일 '신청서 대기' 입금 중 입금자명·금액이 같은 것과 연결해요.
// 딱 1건이면 납부 확인, 여러 건이면 관리자가 고르도록 '확인 필요'로 바꿔요.
export async function linkWaitingDeposit(target: { kind: "app" | "ybm"; id: string; depositor: string; amount: number }) {
  const hits = (await listWaitingDepositEvents(14)).filter((e) => e.amount === target.amount && sameName(e.name, target.depositor));
  if (hits.length === 0) return "none" as const;
  if (hits.length > 1) {
    for (const e of hits) await updateDepositEvent(e.id, { result: "review" });
    return "review" as const;
  }
  if (target.kind === "app") {
    await updateApplications([target.id], { status: "paid" });
    await updateDepositEvent(hits[0].id, { result: "resolved", application_id: target.id });
  } else {
    await updateYbmOrders([target.id], { status: "paid", paid_at: new Date().toISOString() });
    await updateDepositEvent(hits[0].id, { result: "resolved", ybm_order_id: target.id });
  }
  return "linked" as const;
}
