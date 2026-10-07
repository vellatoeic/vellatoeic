"use client";

import { keep } from "@/lib/keep";
import { useActionState } from "react";
import { testBankSms, type FormState } from "@/app/actions";

// 은행 입금 문자 예시를 붙여 넣어 이름·금액이 잘 읽히는지 확인해요. (저장하지 않아요)
export default function SmsTest() {
  const [state, action, pending] = useActionState<FormState, FormData>(testBankSms, {});
  return (
    <form onSubmit={keep(action)} className="space-y-2">
      <textarea name="sms" rows={3} placeholder="은행 입금 문자 예시를 그대로 붙여 넣어 보세요" className="input text-sm" />
      <button className="btn-ghost !py-2 text-sm" disabled={pending}>{pending ? "확인 중…" : "읽어 보기"}</button>
      {state.ok && <p className="text-sm font-bold text-emerald-700">✓ {state.ok}</p>}
      {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
    </form>
  );
}
