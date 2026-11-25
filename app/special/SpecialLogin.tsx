"use client";

import { keep } from "@/lib/keep";
import { useActionState } from "react";
import { specialLogin, type FormState } from "@/app/actions";
import SocialButtons from "@/components/SocialButtons";
import type { Provider } from "@/lib/socialLogin";

// providers: 켜진 구글·카카오 버튼, pin: 이름 + 비밀번호 칸 (로그인 방식은 관리 [기본 설정])
export default function SpecialLogin({ providers, pin }: { providers: Provider[]; pin: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(specialLogin, {});
  return (
    <div className="card space-y-3">
      <h2 className="font-jua text-xl text-sky-ink">불라방 신청 확인</h2>
      <p className="text-sm text-slate-500">{pin ? "강의실과 같은 이름·비밀번호로 확인해요." : "강의실과 같은 구글·카카오 계정으로 확인해요."}</p>
      <SocialButtons providers={providers} next="/special" />
      {pin && (
        <form onSubmit={keep(action)} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input name="name" className="input" placeholder="이름" autoComplete="name" />
          <input name="pin" className="input tracking-[0.3em]" placeholder="비밀번호 4자리" inputMode="numeric" maxLength={4} type="password" />
          <button className="btn-ghost !py-2" disabled={pending}>{pending ? "확인 중…" : "확인하기"}</button>
        </form>
      )}
      {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
    </div>
  );
}
