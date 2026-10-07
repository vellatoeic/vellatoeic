import "server-only";
import { DEPOSIT_MINUTES, SPECIAL_DEPOSIT } from "./config";
import { parseBankSms, sameName, type ParsedDeposit } from "./bankSms";
import { createDepositEvent, listWaitingDeposits, updateOnsiteRegistrations, type DepositEvent } from "./db";

// ── 입금 문자 자동 확인 ─────────────────────────
// 아이폰 단축어가 은행 입금 문자를 /api/bank-sms 로 보내면 여기서 처리해요.
// 입금 대상(target)별로 처리기를 두어, 나중에 교재비(book)도 같은 방식으로 붙일 수 있어요.
// 지금은 특강 보증금(special)만 켜져 있어요.

type Outcome = { result: DepositEvent["result"]; registrationId?: string };
type DepositHandler = { target: DepositEvent["target"]; handles: (d: ParsedDeposit) => boolean; match: (d: ParsedDeposit) => Promise<Outcome> };

// 웹훅이 바꿀 수 있는 건 '입금 대기 → 확정' 하나뿐이에요. 같은 이름이 여러 건이거나 맞는 신청이 없으면
// 신청은 건드리지 않고, 수신 기록만 '확인 필요'로 남겨 관리자가 직접 처리해요.
const specialDepositHandler: DepositHandler = {
  target: "special",
  handles: (d) => d.amount === SPECIAL_DEPOSIT, // 특강 보증금 10,000원만 인정해요.
  async match(d) {
    const cutoff = new Date(Date.now() - DEPOSIT_MINUTES * 60 * 1000).toISOString();
    const waiting = (await listWaitingDeposits()).filter((r) => r.deposit === "pending" && r.created_at >= cutoff && sameName(r.name, d.name));
    if (waiting.length === 1) {
      await updateOnsiteRegistrations([waiting[0].id], { deposit: "paid", deposit_paid_at: new Date().toISOString() });
      return { result: "matched", registrationId: waiting[0].id };
    }
    return { result: waiting.length > 1 ? "review" : "unmatched" };
  },
};

// 교재비(book) 처리기는 나중에 여기에 추가해요. (금액·입금자명으로 입금 대기 신청을 찾아 납부 확인)
const HANDLERS: DepositHandler[] = [specialDepositHandler];

// 문자에서 이름·금액만 뽑고 원문은 바로 버려요. 처리할 금액이 아니면 기록도 남기지 않아요.
export async function handleBankSms(text: string): Promise<{ result: DepositEvent["result"] | "ignored" }> {
  const parsed = parseBankSms(text);
  if (!parsed) {
    await createDepositEvent({ target: "special", name: "", amount: 0, result: "unmatched", registration_id: null });
    return { result: "unmatched" };
  }
  const handler = HANDLERS.find((h) => h.handles(parsed));
  if (!handler) return { result: "ignored" };
  const outcome = await handler.match(parsed);
  await createDepositEvent({ target: handler.target, name: parsed.name, amount: parsed.amount, result: outcome.result, registration_id: outcome.registrationId ?? null });
  return { result: outcome.result };
}
