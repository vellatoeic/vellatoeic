"use client";

import { keep } from "@/lib/keep";
import { useActionState } from "react";
import Link from "next/link";
import { studentLogin, type FormState } from "@/app/actions";
import SocialButtons from "@/components/SocialButtons";
import type { Provider } from "@/lib/socialLogin";

// providers: 켜진 구글·카카오 버튼, pin: 이름 + 비밀번호 칸 (로그인 방식은 관리 [기본 설정])
export default function StudentLoginForm({ next, note, providers, pin }: { next?: string; note?: string; providers: Provider[]; pin: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(studentLogin, {});
  const social = providers.length > 0;
  return (
    <div className="pt-12">
      <div className="card mx-auto max-w-sm space-y-4 text-center">
        <h1 className="font-jua text-3xl text-sky-ink">강의실 입장</h1>
        <p className="text-sm text-slate-500">{note ?? (pin ? "교재비 신청할 때 정한 비밀번호로 들어와요." : "구글 또는 카카오 계정으로 들어와요.")}</p>
        {!note && <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-deep">강의 영상은 개강일 이후부터 열람할 수 있어요.</p>}
        {social && <SocialButtons providers={providers} next={next ?? "/class"} />}
        {social && pin && <p className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />또는 이름 + 비밀번호<span className="h-px flex-1 bg-slate-200" /></p>}
        {pin && (
          <form onSubmit={keep(action)} className="space-y-4">
            {next && <input type="hidden" name="next" value={next} />}
            <input name="name" className="input text-center" placeholder="이름" autoComplete="name" />
            <input
              name="pin"
              className="input text-center tracking-[0.5em]"
              placeholder="비밀번호 4자리"
              inputMode="numeric"
              maxLength={4}
              type="password"
            />
            {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
            <button className="btn w-full" disabled={pending}>
              {pending ? "확인 중…" : "들어가기"}
            </button>
          </form>
        )}
        {social && !pin && <p className="text-xs text-slate-500">처음 한 번만 교재비 신청 때 정한 이름·비밀번호로 내 신청을 찾아 연결해요.</p>}
        <p className="text-xs text-slate-400">
          아직 신청 전이라면{" "}
          <Link href="/guide" className="text-sky-deep underline">
            필독 사항 확인
          </Link>
          부터 해주세요.
        </p>
      </div>
    </div>
  );
}
