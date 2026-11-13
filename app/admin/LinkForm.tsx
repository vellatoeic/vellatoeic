"use client";

import { keep } from "@/lib/keep";
import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/actions";

// LC 음원·특강 자료 등록: 제목 + 구글 드라이브 공유 링크 (파일은 드라이브에 올려요)
export default function LinkForm({ action: run, hidden, titlePlaceholder }: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  titlePlaceholder: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(run, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]); // 등록되면 입력 칸을 비워요 (오류면 그대로)
  return (
    <form ref={form} onSubmit={keep(action)} className="space-y-2 rounded-2xl bg-sky-soft p-3">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="flex flex-wrap gap-2">
        <input name="title" required maxLength={200} placeholder={titlePlaceholder} className="input !w-auto min-w-0 flex-1 !py-2 text-sm sm:max-w-[14rem]" />
        <input name="link" type="url" required placeholder="https://drive.google.com/…" className="input min-w-0 flex-[2] !py-2 text-sm" />
        <button className="btn !py-2 !text-sm" disabled={pending}>{pending ? "등록 중…" : "링크 등록"}</button>
      </div>
      <p className="text-xs text-slate-500">구글 드라이브에 파일을 올리고 [공유] → 일반 액세스 <b>‘링크가 있는 모든 사용자’</b>로 바꾼 뒤 [링크 복사]해서 붙여 넣어 주세요. 학생에게는 기간·조건이 맞을 때만 링크가 열려요.</p>
      {state.ok && <p className="text-sm font-bold text-emerald-700">✓ {state.ok}</p>}
      {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
    </form>
  );
}
