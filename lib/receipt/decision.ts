/**
 * 1차 판정 — **바로 거절할지, 다음 달 반이 열릴 때까지 받아 둘지, 계속(반 대조 → 자동 승인 검사)할지**만 정한다.
 * 자동 승인은 여기서 정하지 않는다 (`approve-rules.ts`).
 *
 * ## 근거가 있을 때만 거절한다
 * OCR 이 글자를 못 읽었거나 날짜를 하나도 못 찾았으면 거절하지 않는다 — 멀쩡한 수강증이 튕기고 학생은 이유를 모른다.
 * 거절은 셋뿐이다: 서면센터 수강증이 아님(G1) · 벨라토익이 아님(G2) · 지난 과정.
 * 긴급 스위치가 꺼져 있으면 거절도 하지 않는다 — 그건 부르는 쪽(`pipeline.ts`)이 본다.
 */
import { RECEIPT, RULES } from "./config";
import { receiptCourseMonth, type ParsedReceipt } from "./receipt";

export type VerifyRejectCode = "academy" | "brand" | "month";

export type VerifyDecision =
  | { kind: "reject"; code: VerifyRejectCode; reason: string }
  | { kind: "review"; note?: string }
  /** 다음 달 수강증인데 그 달 반이 아직 없다 — 받아 두고, 그 달 반이 열리면 같은 조건으로 다시 맞춘다 */
  | { kind: "upcoming"; month: number; note: string };

export type VerifyTerm = { year: number; month: number };

/** "2026-12" → { year: 2026, month: 12 } */
export const termOf = (term: string): VerifyTerm => ({ year: Number(term.slice(0, 4)), month: Number(term.slice(5, 7)) });
export const termsLabel = (terms: readonly VerifyTerm[]) => terms.map((t) => `${t.year}년 ${t.month}월`).join(" · ");

/** 오늘(YYYY-MM-DD)부터 몇 달 뒤인가 (0~11). 배지에는 연도가 없어 달만 본다 */
export function monthsAhead(month: number, today: string): number {
  return (((month - Number(today.slice(5, 7))) % 12) + 12) % 12;
}

function upcoming(month: number): VerifyDecision {
  return {
    kind: "upcoming",
    month,
    note: `${month}월 수강증으로 받아 뒀어요. 선생님이 ${month}월 반을 열면 수강증에 맞는 반으로 배정해 드려요 — 개강 전이면 ${month}월 예비등록생으로 표시되고, 개강일에 수강생으로 자동 전환돼요. 다시 올리지 않으셔도 돼요.`,
  };
}

/** 캡처가 너무 오래됐나 — 위조 판별이 아니라 지난 수강증을 다시 쓰는 일을 자동 승인에서 뺀다. 날짜를 못 읽었으면 판단하지 않는다(true) */
export function isCaptureFresh(capturedOn: string | null | undefined, today: string, maxDays: number = RULES.maxCaptureAgeDays): boolean {
  if (!capturedOn) return true;
  const a = Date.parse(`${capturedOn}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return true;
  const days = Math.round((b - a) / 86_400_000);
  return days <= maxDays && days >= -7; // 기기 시각이 틀린 미래 캡처도 며칠은 봐준다
}

/**
 * @param parsed OCR 원문을 판독한 결과. OCR 을 못 했으면 null — 늘 검토 대기
 * @param openTerms 지금 등업을 받는 기수 (열린 반이 속한 달). 비어 있으면 "지난 과정" 으로 거절하지 않는다
 * @param today 오늘 (한국 시각 YYYY-MM-DD)
 */
export function decideVerification(parsed: ParsedReceipt | null, openTerms: readonly VerifyTerm[], today: string): VerifyDecision {
  if (!parsed) return { kind: "review", note: "수강증을 자동으로 읽지 못했어요" };
  if (parsed.compact.length < RULES.minReceiptText) return { kind: "review", note: "수강증에서 글자를 거의 읽지 못했어요" };

  if (!parsed.gates.academy) {
    return {
      kind: "reject",
      code: "academy",
      reason: "YBM 부산 서면센터 수강증 화면이 아닌 것 같아요. 카카오톡 대화나 다른 앱 화면 말고, 수강생 · 수강센터 · 수강시간이 보이는 파란 수강증 카드를 캡처해 올려 주세요.",
    };
  }
  if (!parsed.gates.brand) {
    return { kind: "reject", code: "brand", reason: `${RECEIPT.brand} 강좌 수강증이 아닌 것 같아요. 강좌명(${RECEIPT.brand})이 보이도록 다시 캡처해 올려 주세요.` };
  }

  // 수강월 — 배지 `12월 과정` → 개강일 `[4주-12/01]`. 격일반 2개월 과정은 배지 달과 그다음 달 둘 다 이 수강증의 달이다
  const month = receiptCourseMonth(parsed);
  if (month != null) {
    const covered = parsed.twoMonth ? [month, (month % 12) + 1] : [month];
    if (openTerms.some((t) => covered.includes(t.month))) return { kind: "review" };
    const ahead = covered.find((m) => monthsAhead(m, today) <= RULES.holdMonthsAhead);
    if (ahead != null) return upcoming(ahead);
    if (openTerms.length === 0) return { kind: "review" };
    return {
      kind: "reject",
      code: "month",
      reason: `이 수강증은 ${month}월 과정이에요 — 지난 과정이라 받을 수 없어요. 지금은 ${termsLabel(openTerms)} 수강증을 받고 있어요. 이번 달 수강증을 올려 주세요.`,
    };
  }

  // 배지도 개강일도 못 읽었으면 연도가 붙은 날짜로 본다 (캡처 시각은 빠져 있다). 하나라도 열린 달이면 통과
  if (parsed.months.length > 0) {
    const key = (t: VerifyTerm) => `${t.year}-${t.month}`;
    const open = new Set(openTerms.map(key));
    if (parsed.months.some((m) => open.has(key(m)))) return { kind: "review" };
    const now = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7));
    const ahead = parsed.months.find((m) => {
      const d = m.year * 12 + m.month - now;
      return d >= 0 && d <= RULES.holdMonthsAhead;
    });
    if (ahead) return upcoming(ahead.month);
    if (openTerms.length > 0) {
      return {
        kind: "reject",
        code: "month",
        reason: `수강증에서 읽은 날짜(${termsLabel(parsed.months)})가 지금 받는 달(${termsLabel(openTerms)})과 달라요. 이번 달 수강증이 맞는지 확인해 주세요.`,
      };
    }
  }
  return { kind: "review" };
}
