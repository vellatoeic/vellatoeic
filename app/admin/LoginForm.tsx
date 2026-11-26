"use client";

import { keep } from "@/lib/keep";
import { useActionState, useEffect, useState } from "react";
import { login, type FormState } from "@/app/actions";
import SocialButtons from "@/components/SocialButtons";

// 관리 페이지 입장: 관리자로 등록한 카카오·구글 계정 버튼 + 관리자 비밀번호
export default function LoginForm({ preview }: { preview: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  const [unknown, setUnknown] = useState(false);
  useEffect(() => setUnknown(new URLSearchParams(location.search).get("al") === "unknown"), []);
  return (
    <div className="card mx-auto mt-16 max-w-sm space-y-4 text-center">
      <h1 className="font-jua text-3xl text-sky-ink">관리 페이지</h1>
      <SocialButtons providers={["kakao", "google"]} next="/admin" admin="login" />
      {unknown && <p className="text-sm font-bold text-red-600">관리자로 등록되지 않은 계정이에요. 비밀번호로 들어와서 관리 화면에서 계정을 추가해 주세요.</p>}
      <p className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />또는 관리자 비밀번호<span className="h-px flex-1 bg-slate-200" /></p>
      <form onSubmit={keep(action)} className="space-y-4">
        <input name="password" type="password" className="input text-center" placeholder="비밀번호" />
        {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>들어가기</button>
        {preview && <p className="text-xs text-slate-400">미리보기 모드 비밀번호: vella</p>}
      </form>
    </div>
  );
}
