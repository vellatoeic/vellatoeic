"use client";

import { keep } from "@/lib/keep";
import { useActionState } from "react";
import Link from "next/link";
import { studentLogin, type FormState } from "@/app/actions";

export default function StudentLogin() {
  const [state, action, pending] = useActionState<FormState, FormData>(studentLogin, {});
  return (
    <div className="pt-12">
      <form onSubmit={keep(action)} className="card mx-auto max-w-sm space-y-4 text-center">
        <h1 className="font-jua text-3xl text-sky-ink">강의실 입장</h1>
        <p className="text-sm text-slate-500">교재비 신청할 때 정한 비밀번호로 들어와요.</p>
        <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-deep">강의 영상은 개강일 이후부터 열람할 수 있어요.</p>
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
        <p className="text-xs text-slate-400">
          아직 신청 전이라면{" "}
          <Link href="/guide" className="text-sky-deep underline">
            필독 사항 확인
          </Link>
          부터 해주세요.
        </p>
      </form>
    </div>
  );
}
