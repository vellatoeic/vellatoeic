"use client";

import { keep } from "@/lib/keep";
import { useActionState } from "react";
import { login, type FormState } from "@/app/actions";

export default function LoginForm({ preview }: { preview: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  return (
    <form onSubmit={keep(action)} className="card mx-auto mt-16 max-w-sm space-y-4 text-center">
      <h1 className="font-jua text-3xl text-sky-ink">관리 페이지</h1>
      <input name="password" type="password" className="input text-center" placeholder="비밀번호" autoFocus />
      {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>들어가기</button>
      {preview && <p className="text-xs text-slate-400">미리보기 모드 비밀번호: vella</p>}
    </form>
  );
}
