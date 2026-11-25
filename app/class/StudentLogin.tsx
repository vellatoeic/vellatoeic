"use client";

import { keep } from "@/lib/keep";
import { useActionState } from "react";
import Link from "next/link";
import { studentLogin, type FormState } from "@/app/actions";
import Icon from "@/components/Icon";
import GoogleButton from "@/components/GoogleButton";

// 학생 로그인 (강의실·테스트·미션·QR 출석·/login 공통)
// 구글 로그인이 켜져 있으면 맨 위에 [Google로 로그인], 이름 + 비밀번호는 아래 접은 칸 (지금 학생들도 그대로 들어와요)
const ERRORS: Record<string, string> = {
  setup: "구글 로그인 설정이 아직이에요. 이름 + 비밀번호로 들어와 주세요.",
  cancel: "구글 로그인을 취소했어요.",
  state: "로그인 시간이 지났어요. 다시 눌러 주세요.",
  google: "구글 로그인에 실패했어요. 잠시 후 다시 해 주세요.",
};

export default function StudentLogin({ next, note, google = false, error, title = "로그인" }: { next?: string; note?: string; google?: boolean; error?: string; title?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(studentLogin, {});
  const form = (
    <form onSubmit={keep(action)} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      <input name="name" className="input text-center" placeholder="이름" autoComplete="name" />
      <input name="pin" className="input text-center tracking-[0.5em]" placeholder="비밀번호 4자리" inputMode="numeric" maxLength={4} type="password" />
      {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
      <button className={google ? "btn-ghost w-full" : "btn w-full"} disabled={pending}>{pending ? "확인 중…" : "들어가기"}</button>
    </form>
  );
  return (
    <div className="pt-10">
      <div className="card mx-auto max-w-sm space-y-4 text-center">
        <Icon name="lock" size={56} className="mx-auto block" />
        <h1 className="font-jua text-3xl text-sky-ink">{title}</h1>
        <p className="text-sm text-slate-500">{note ?? (google ? "구글 계정으로 한 번에 들어와요." : "교재비 신청할 때 정한 비밀번호로 들어와요.")}</p>
        {error && ERRORS[error] && <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600">{ERRORS[error]}</p>}
        {google ? (
          <>
            <GoogleButton next={next ?? "/"} />
            <p className="text-xs text-slate-400">처음 한 번만 신청서의 이름 · 비밀번호로 내 수강 신청을 연결해요.</p>
            <details className="group rounded-2xl bg-[#f6fafd] px-4 py-3 text-left" open={!!state.error}>
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-slate-600">
                이름 + 비밀번호로 들어가기
                <Icon name="chevronRight" size={14} className="text-slate-400 transition group-open:rotate-90" />
              </summary>
              <div className="mt-3">{form}</div>
            </details>
          </>
        ) : (
          <>
            {!note && <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-deep">강의 영상은 개강일 이후부터 열람할 수 있어요.</p>}
            {form}
          </>
        )}
        <p className="text-xs text-slate-400">
          아직 신청 전이라면{" "}
          <Link href="/guide" className="text-sky-deep underline">필독 사항 확인</Link>
          부터 해주세요.
        </p>
      </div>
    </div>
  );
}
