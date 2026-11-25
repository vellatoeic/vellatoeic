"use client";

import { keep } from "@/lib/keep";
import { useActionState } from "react";
import { linkWithPin, type FormState } from "@/app/actions";

// 처음 한 번: 교재비 신청 때 정한 이름 + 비밀번호로 내 신청 찾기
export default function LinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(linkWithPin, {});
  return (
    <form onSubmit={keep(action)} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <input name="name" className="input text-center" placeholder="이름" autoComplete="name" />
      <input name="pin" className="input text-center tracking-[0.5em]" placeholder="비밀번호 4자리" inputMode="numeric" maxLength={4} type="password" />
      {state.error && <p className="text-center text-sm font-bold text-red-600">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "찾는 중…" : "내 신청 찾아서 연결하기"}</button>
    </form>
  );
}
