"use client";

import { keep } from "@/lib/keep";
import { useActionState } from "react";
import Link from "next/link";
import { studentLogin, type FormState } from "@/app/actions";
import SocialButtons from "@/components/SocialButtons";
import Icon from "@/components/Icon";
import type { Provider } from "@/lib/socialLogin";

const ERRORS: Record<string, string> = {
  fail: "로그인하지 못했어요. 잠시 후 다시 눌러 주세요. 계속 안 되면 다른 방법으로 로그인해 보세요.",
};

// providers: 켜진 카카오·구글·네이버 버튼, pin: 이름 + 비밀번호 칸 (로그인 방식은 관리 [기본 설정])
// next가 없으면 로그인한 뒤 알맞은 화면(신청 전 → 수강 신청 안내 / 신청 후 → 강의실)으로 가요 (/go)
export default function StudentLoginForm({ next, note, providers, pin, title = "로그인", error }: { next?: string; note?: string; providers: Provider[]; pin: boolean; title?: string; error?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(studentLogin, {});
  const social = providers.length > 0;
  return (
    <div className="pt-10">
      <div className="card mx-auto max-w-sm space-y-4 text-center">
        <Icon name="lock" size={56} className="mx-auto block" />
        <h1 className="font-jua text-3xl text-sky-ink">{title}</h1>
        <p className="text-sm text-slate-500">{note ?? (pin ? "교재비 신청할 때 정한 이름과 비밀번호로 들어와요." : "카카오 또는 구글 계정으로 한 번에 들어와요.")}</p>
        {error && ERRORS[error] && <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600">{ERRORS[error]}</p>}
        {social && <SocialButtons providers={providers} next={next ?? "/go"} />}
        {social && pin && <p className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />또는 이름 + 비밀번호<span className="h-px flex-1 bg-slate-200" /></p>}
        {pin && (
          <form onSubmit={keep(action)} className="space-y-3">
            {next && <input type="hidden" name="next" value={next} />}
            <input name="name" className="input text-center" placeholder="이름" autoComplete="name" />
            <input name="pin" className="input text-center tracking-[0.5em]" placeholder="비밀번호 4자리" inputMode="numeric" maxLength={4} type="password" />
            {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
            <button className={social ? "btn-ghost w-full" : "btn w-full"} disabled={pending}>{pending ? "확인 중…" : "들어가기"}</button>
          </form>
        )}
        {social && !pin && <p className="text-xs text-slate-500">처음 한 번만 교재비 신청 때 정한 이름·비밀번호로 내 신청을 찾아 연결해요.</p>}
        <p className="text-xs text-slate-400">
          아직 신청 전이라면{" "}
          <Link href="/guide" className="text-sky-deep underline">필독 사항 확인</Link>
          부터 해주세요.
        </p>
      </div>
    </div>
  );
}
