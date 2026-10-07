import "server-only";
import { DEPOSIT_MINUTES, SPECIAL_DEPOSIT } from "./config";
import { parseBankSms, sameName, type ParsedDeposit } from "./bankSms";
import { createDepositEvent, listApplications, listWaitingDeposits, updateApplications, updateOnsiteRegistrations, type DepositEvent } from "./db";

// ── 입금 문자 자동 확인 ─────────────────────────
// 아이폰 단축어가 은행 입금 문자를 /api/bank-sms 로 보내면 여기서 처리해요.
// 입금 종류(target)마다 처리기가 '이 입금에 맞는 대기 건'을 찾아요.
//   - 특강 보증금(special): 입금 대기(신청 후 30분 안) 현장 신청 · 이름 일치 · 10,000원
//   - 교재비(book): 입금 대기 수강 신청 · 입금자명 일치 · 교재비 금액 일치
// 모든 처리기를 통틀어 딱 한 건만 맞으면 자동 확정, 두 건 이상이면 '확인 필요', 없으면 '확인 필요'(관련 있어 보일 때만 기록).
// 웹훅이 바꿀 수 있는 건 '입금 대기 → 확정(납부 확인)' 하나뿐이에요.

type Candidate = { target: DepositEvent["target"]; id: string; confirm: () => Promise<void> };
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
  related: async (d) => d.amount === SPECIAL_DEPOSIT,
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

const HANDLERS: DepositHandler[] = [specialDepositHandler, bookDepositHandler];

// 문자에서 이름·금액만 뽑고 원문은 바로 버려요. 우리 학생 입금으로 보이지 않으면 기록도 남기지 않아요.
export async function handleBankSms(text: string): Promise<{ result: DepositEvent["result"] | "ignored" }> {
  const parsed = parseBankSms(text);
  if (!parsed) {
    await createDepositEvent({ target: "special", name: "", amount: 0, result: "unmatched", registration_id: null, application_id: null });
    return { result: "unmatched" };
  }
  const candidates = (await Promise.all(HANDLERS.map((h) => h.candidates(parsed)))).flat();
  const record = (result: DepositEvent["result"], target: DepositEvent["target"], c?: Candidate) =>
    createDepositEvent({
      target, name: parsed.name, amount: parsed.amount, result,
      registration_id: c?.target === "special" ? c.id : null,
      application_id: c?.target === "book" ? c.id : null,
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
  return { result: "ignored" };
}
