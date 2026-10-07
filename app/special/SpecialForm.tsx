"use client";

import { keep } from "@/lib/keep";
import { useActionState } from "react";
import { registerSpecialLecture, type FormState } from "@/app/actions";

type Option = { id: string; title: string; when: string };

export default function SpecialForm({ events }: { events: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerSpecialLecture, {});

  if (state.ok) {
    return (
      <div className="card space-y-3 text-center">
        <p className="font-jua text-2xl text-sky-ink">신청 완료 ☁️</p>
        <p className="text-slate-700">{state.ok.split(". ").map((line, i, all) => <span key={i} className="block">{line}{i < all.length - 1 ? "." : ""}</span>)}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-ghost !py-2 text-sm">다른 특강도 신청하기</button>
      </div>
    );
  }

  return (
    <form onSubmit={keep(action)} className="card space-y-5">
      <div>
        <p className="label">1. 특강 선택</p>
        <div className="space-y-2">
          {events.map((event) => (
            <label key={event.id} className="flex items-start gap-3 rounded-xl bg-sky-soft p-3">
              <input type="radio" name="event_id" value={event.id} required className="mt-1 accent-sky-deep" />
              <span><b className="block text-sky-ink">{event.title}</b><span className="text-sm text-slate-600">{event.when}</span></span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="label">2. 참여 방법</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-xl bg-sky-soft p-3">
            <input type="radio" name="mode" value="onsite" required className="mt-1 accent-sky-deep" />
            <span><b className="block text-sky-ink">현장</b><span className="text-sm text-slate-600">703호에서 들어요.<br />보증금 1만원 · 특강 당일 현장에서 100% 환급</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-xl bg-sky-soft p-3">
            <input type="radio" name="mode" value="online" required className="mt-1 accent-sky-deep" />
            <span><b className="block text-sky-ink">불라방</b><span className="text-sm text-slate-600">유튜브 라이브로 들어요.</span></span>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <p className="label">3. 강의실 로그인 정보</p>
        <input name="name" className="input" placeholder="이름" autoComplete="name" />
        <input name="pin" className="input tracking-[0.3em]" placeholder="강의실 비밀번호 4자리" inputMode="numeric" maxLength={4} type="password" />
        <p className="text-xs text-slate-500">교재비 신청할 때 정한 이름과 강의실 비밀번호를 입력해 주세요.</p>
      </div>

      {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "신청 중…" : "특강 신청하기"}</button>
    </form>
  );
}
