import "server-only";
import { DEPOSIT_HOURS, SPECIAL_DEPOSIT } from "./config";
import { parseBankSms, sameName, type ParsedDeposit } from "./bankSms";
import { createDepositEvent, expireSpecialDeposits, listWaitingDeposits, updateOnsiteRegistrations, type DepositEvent } from "./db";

// ── 입금 문자 자동 확인 ─────────────────────────
// 아이폰 단축어가 은행 입금 문자를 /api/bank-sms 로 보내면 여기서 처리해요.
// 입금 대상(target)별로 처리기를 두어, 나중에 교재비(book)도 같은 방식으로 붙일 수 있어요.
// 지금은 특강 보증금(special)만 켜져 있어요.

type Outcome = { result: DepositEvent["result"]; registrationId?: string; message: string };
type DepositHandler = { target: DepositEvent["target"]; handles: (d: ParsedDeposit) => boolean; match: (d: ParsedDeposit) => Promise<Outcome> };

const specialDepositHandler: DepositHandler = {
  target: "special",
  handles: (d) => d.amount === SPECIAL_DEPOSIT,
  async match(d) {
    await expireSpecialDeposits(DEPOSIT_HOURS);
    const waiting = (await listWaitingDeposits()).filter((r) => sameName(r.name, d.name));
    if (waiting.length === 1) {
      await updateOnsiteRegistrations([waiting[0].id], { deposit: "paid", deposit_paid_at: new Date().toISOString() });
      return { result: "matched", registrationId: waiting[0].id, message: "특강 보증금 확정" };
    }
    if (waiting.length > 1) {
      // 같은 이름 대기 신청이 여러 건이면 자동 확정하지 않고 관리자가 확인해요.
      await updateOnsiteRegistrations(waiting.map((r) => r.id), { deposit: "review" });
      return { result: "review", message: "같은 이름 대기 신청이 여러 건 · 확인 필요" };
    }
    return { result: "unmatched", message: "일치하는 대기 신청 없음 · 확인 필요" };
  },
};

// 교재비(book) 처리기는 나중에 여기에 추가해요. (금액·입금자명으로 입금 대기 신청을 찾아 납부 확인)
const HANDLERS: DepositHandler[] = [specialDepositHandler];

export async function handleBankSms(text: string): Promise<{ ok: boolean; result: DepositEvent["result"]; message: string }> {
  const parsed = parseBankSms(text);
  if (!parsed) {
    await createDepositEvent({ target: "special", name: "", amount: 0, result: "unmatched", registration_id: null });
    return { ok: true, result: "unmatched", message: "입금자명·금액을 읽지 못했어요 · 확인 필요" };
  }
  const handler = HANDLERS.find((h) => h.handles(parsed));
  if (!handler) {
    await createDepositEvent({ target: "special", name: parsed.name, amount: parsed.amount, result: "unmatched", registration_id: null });
    return { ok: true, result: "unmatched", message: "처리할 입금 종류가 아니에요 (금액이 다름)" };
  }
  const outcome = await handler.match(parsed);
  await createDepositEvent({ target: handler.target, name: parsed.name, amount: parsed.amount, result: outcome.result, registration_id: outcome.registrationId ?? null });
  return { ok: true, result: outcome.result, message: outcome.message };
}
