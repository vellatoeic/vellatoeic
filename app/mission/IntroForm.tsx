"use client";

import { keep } from "@/lib/keep";
import { useActionState } from "react";
import { saveMissionIntro, type FormState } from "@/app/actions";

type Intro = { prev_score: string; target_score: string; exam_month: string; affiliation: string; instagram: string; message: string };

const field = "mt-1 block w-full rounded-xl border-2 border-[#d9edf9] bg-[#f9fdff] px-2.5 py-2 text-sm text-sky-ink outline-none focus:border-sky-deep";

export default function IntroForm({ intro }: { intro: Intro }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveMissionIntro, {});
  return (
    <form onSubmit={keep(action)} className="mt-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-[#5b88a6]">이전 토익 점수<input name="prev_score" defaultValue={intro.prev_score} placeholder="예: 처음이에요 / 550" className={field} /></label>
        <label className="text-xs text-[#5b88a6]">목표 점수<input name="target_score" defaultValue={intro.target_score} placeholder="예: 750" className={field} /></label>
        <label className="text-xs text-[#5b88a6]">시험 예정<input name="exam_month" defaultValue={intro.exam_month} placeholder="예: 12월" className={field} /></label>
        <label className="text-xs text-[#5b88a6]">학교 / 직장 <span className="opacity-60">(선택)</span><input name="affiliation" defaultValue={intro.affiliation} placeholder="예: 부산대 4학년" className={field} /></label>
        <label className="col-span-2 text-xs text-[#5b88a6]">인스타 아이디 <span className="opacity-60">(선택)</span><input name="instagram" defaultValue={intro.instagram} placeholder="@아이디" className={field} /></label>
        <label className="col-span-2 text-xs text-[#5b88a6]">Vella쌤에게 한마디 <span className="opacity-60">(선택)</span><input name="message" defaultValue={intro.message} placeholder="예: LC가 너무 약해요 ㅠㅠ" className={field} /></label>
      </div>
      {state.error && <p className="mt-2 text-sm font-bold text-red-600">{state.error}</p>}
      {state.ok && <p className="mt-2 text-sm font-bold text-emerald-600">{state.ok}</p>}
      <button disabled={pending} className="mt-2.5 block w-full rounded-[14px] bg-sky-deep py-2.5 font-jua text-base text-white shadow-[0_3px_0_#1f6f9d] disabled:opacity-50">
        {pending ? "저장 중…" : "저장하기"}
      </button>
    </form>
  );
}
