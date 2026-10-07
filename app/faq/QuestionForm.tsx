"use client";

import { keep } from "@/lib/keep";
import { useActionState, useEffect, useRef } from "react";
import { submitQuestion, type FormState } from "@/app/actions";

export default function QuestionForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitQuestion, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && ref.current) (ref.current.elements.namedItem("content") as HTMLTextAreaElement).value = "";
  }, [state]);
  return (
    <form ref={ref} onSubmit={keep(action)} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {([["question", "❓ 질문"], ["suggestion", "💡 제안"]] as const).map(([v, label], i) => (
          <label key={v} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-sky-main/60 bg-white py-2.5 font-jua has-[:checked]:border-sky-deep has-[:checked]:bg-sky-soft">
            <input type="radio" name="kind" value={v} defaultChecked={i === 0} className="accent-sky-deep" /> {label}
          </label>
        ))}
      </div>
      <textarea name="content" rows={4} maxLength={1000} placeholder="궁금한 점이나 바라는 점을 적어 주세요" className="input" />
      <p className="text-xs text-slate-500">{name}님 이름으로 남겨져요. 답은 따로 알림으로 가지 않아요.</p>
      {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm font-bold text-emerald-600">{state.ok}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "보내는 중…" : "남기기"}</button>
    </form>
  );
}
