"use client";

import { useActionState } from "react";
import { keep } from "@/lib/keep";
import { linkMemberByPin, studentLogout, type FormState } from "@/app/actions";

// 구글 계정 ↔ 수강 신청 처음 연결 (신청서의 이름 + 강의실 비밀번호, 한 번만)
export default function LinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(linkMemberByPin, {});
  return (
    <>
      <form onSubmit={keep(action)} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <input name="name" className="input text-center" placeholder="신청서의 이름" autoComplete="name" />
        <input name="pin" className="input text-center tracking-[0.5em]" placeholder="강의실 비밀번호 4자리" inputMode="numeric" maxLength={4} type="password" />
        {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "확인 중…" : "내 수강 신청 연결하기"}</button>
      </form>
      <form action={studentLogout}>
        <button className="text-xs text-slate-400 underline">다른 구글 계정으로 로그인하기</button>
      </form>
    </>
  );
}
