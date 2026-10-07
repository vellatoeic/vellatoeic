// 은행 입금 문자 형식 테스트. Vella쌤 은행 문자 예시를 받으면 여기에 추가해서 맞춰요.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBankSms } from "@/lib/bankSms";

const samples: [string, string, { name: string; amount: number } | null][] = [
  ["KB국민 (줄바꿈)", "[KB]10/07 14:23\n123456**789\n홍길동\n입금\n10,000\n잔액123,000", { name: "홍길동", amount: 10000 }],
  ["신한", "[신한은행] 10/07 14:23 입금 10,000원 잔액 50,000원 홍길동", { name: "홍길동", amount: 10000 }],
  ["카카오뱅크", "[카카오뱅크] 홍길동님이 10,000원을 입금했습니다.", { name: "홍길동", amount: 10000 }],
  ["토스뱅크", "토스뱅크 입금 10,000원 김민지 → 내 통장", { name: "김민지", amount: 10000 }],
  ["농협", "농협 입금10,000원 10/07 14:23 352-****-1234-56 박서준 잔액100,000원", { name: "박서준", amount: 10000 }],
  ["우리", "[우리은행] 입금 10,000원 10/07 14:23 1002***123456 이하늘 잔액 1,234원", { name: "이하늘", amount: 10000 }],
  ["출금 문자는 무시", "[신한은행] 출금 10,000원 홍길동", null],
  ["인증번호 문자는 무시", "[Web발신] [신한은행] 인증번호 [482913] 타인에게 알려주지 마세요", null],
];

for (const [label, sms, expected] of samples) {
  test(`입금 문자 형식: ${label}`, () => {
    assert.deepEqual(parseBankSms(sms), expected);
  });
}

test("뽑은 이름에는 숫자(계좌번호·잔액·인증번호)가 들어가지 않고, 결과는 이름·금액 두 가지뿐이에요", () => {
  for (const [, sms, expected] of samples) {
    const parsed = parseBankSms(sms);
    if (!expected || !parsed) continue;
    assert.deepEqual(Object.keys(parsed).sort(), ["amount", "name"]);
    assert.match(parsed.name, /^[가-힣]{2,5}$/);
  }
});
