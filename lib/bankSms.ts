// 은행 입금 문자에서 입금자명과 금액을 뽑아요. 문자 원문은 어디에도 저장하지 않아요.
// 은행마다 형식이 달라서 여러 형식을 시도해요. 새 형식은 tests/bank-sms.test.ts에 예시를 추가해 맞춰요.

// 이름 후보에서 뺄 낱말 (은행 이름, 알림 문구 등)
const STOP = new Set([
  "입금", "출금", "잔액", "이체", "입금액", "출금액", "알림", "계좌", "보통예금", "저축예금", "체크", "카드", "원", "님",
  "국민", "국민은행", "신한", "신한은행", "우리", "우리은행", "하나", "하나은행", "농협", "농협은행", "기업", "기업은행", "카카오뱅크", "카카오",
  "토스", "토스뱅크", "케이뱅크", "새마을", "새마을금고", "우체국", "수협", "부산", "부산은행", "경남", "경남은행", "대구", "대구은행", "광주", "광주은행",
  "전북", "전북은행", "제주", "제주은행", "씨티", "아이엠뱅크", "내", "통장", "입금했습니다", "입금했어요", "입금되었습니다", "받았어요",
]);

export type ParsedDeposit = { name: string; amount: number };

const num = (s: string) => Number(s.replace(/,/g, ""));

export function parseBankSms(raw: string): ParsedDeposit | null {
  const text = raw.replace(/\r/g, "").trim();
  if (!/입금/.test(text)) return null;

  // 금액: "입금 10,000원" · "입금10,000" · "10,000원을 입금" · "입금액 10,000"
  const amountMatch =
    text.match(/입금(?:액)?\s*[:：]?\s*([0-9][0-9,]*)\s*원?/) ??
    text.match(/([0-9][0-9,]*)\s*원(?:을|이)?\s*입금/);
  const amount = amountMatch ? num(amountMatch[1]) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // 이름: "홍길동님이 …" 형식이 있으면 그걸 써요.
  const honorific = text.match(/([가-힣]{2,5})님/);
  if (honorific && !STOP.has(honorific[1])) return { name: honorific[1], amount };

  // 그 밖에는 한글 2~5글자 낱말 중 '입금'에 가장 가까운 것을 이름으로 봐요.
  const tokens = text.split(/[\s\[\]()<>·|/:,→>-]+/).filter(Boolean);
  const anchor = tokens.findIndex((t) => t.includes("입금"));
  const candidates = tokens
    .map((t, i) => ({ t: t.replace(/님$/, ""), i }))
    .filter(({ t }) => /^[가-힣]{2,5}$/.test(t) && !STOP.has(t));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => Math.abs(a.i - anchor) - Math.abs(b.i - anchor) || a.i - b.i);
  return { name: candidates[0].t, amount };
}

// 이름 비교: 띄어쓰기는 무시해요.
export const sameName = (a: string, b: string) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
