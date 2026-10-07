"use client";

import { useActionState, useState, startTransition } from "react";
import { submitTestResult, type FormState } from "@/app/actions";

type Props = {
  appId: string;
  day: string;
  kind: "word" | "rc";
  label: string; // 예: RC TEST 22
  questions: number;
  existing?: { score: number; wrong: number[]; late: boolean } | null;
  late?: boolean; // 밀린 테스트 (한 번만 제출)
};

// 테스트 결과 입력: 맞은 개수(필수) + RC 틀린 번호(선택). 맞은 개수와 틀린 번호 수가 안 맞으면 바로 알려줘요.
export default function TestForm({ appId, day, kind, label, questions, existing, late }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitTestResult, {});
  const [score, setScore] = useState(existing ? String(existing.score) : "");
  const [wrong, setWrong] = useState<number[]>(existing?.wrong ?? []);
  const locked = !!existing && !!late; // 지난 테스트는 한 번만 제출
  const n = score === "" ? NaN : Number(score);
  const mismatch = kind === "rc" && wrong.length > 0 && Number.isFinite(n) && n + wrong.length !== questions;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("app_id", appId);
    fd.set("day", day);
    fd.set("kind", kind);
    fd.set("score", score);
    fd.set("wrong", wrong.join(","));
    startTransition(() => action(fd));
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-4 shadow-[0_2px_0_#d5ecf9]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-jua text-lg text-sky-ink">{label} <span className="text-sm text-slate-500">({questions}문항)</span></p>
        {existing && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">제출함</span>}
      </div>
      <label className="mt-2 flex items-center gap-2">
        <span className="text-sm text-slate-600">맞은 개수</span>
        <input type="number" inputMode="numeric" min={0} max={questions} value={score} disabled={locked} onChange={(e) => setScore(e.target.value)} className="input !w-24 !py-2 text-center text-lg" />
        <span className="text-sm text-slate-500">/ {questions}</span>
      </label>
      {kind === "rc" && (
        <div className="mt-3">
          <p className="text-sm text-slate-600">틀린 번호 <span className="text-slate-400">(선택 · 누르면 표시돼요)</span></p>
          <div className="mt-1.5 grid grid-cols-8 gap-1 sm:grid-cols-10">
            {Array.from({ length: questions }, (_, i) => i + 1).map((q) => {
              const on = wrong.includes(q);
              return (
                <button
                  key={q}
                  type="button"
                  disabled={locked}
                  aria-pressed={on}
                  onClick={() => setWrong((w) => (on ? w.filter((x) => x !== q) : [...w, q].sort((a, b) => a - b)))}
                  className={`h-9 rounded-lg text-sm font-bold ${on ? "bg-red-500 text-white" : "bg-sky-soft text-sky-ink"}`}
                >
                  {q}
                </button>
              );
            })}
          </div>
          {wrong.length > 0 && <p className="mt-1 text-xs text-slate-500">틀린 번호 {wrong.length}개</p>}
        </div>
      )}
      {mismatch && <p className="mt-2 text-sm font-bold text-amber-600">맞은 개수({n}) + 틀린 번호({wrong.length}개)가 {questions}문항과 맞지 않아요.</p>}
      {state.error && <p className="mt-2 text-sm font-bold text-red-600">{state.error}</p>}
      {state.ok && <p className="mt-2 text-sm font-bold text-emerald-600">{state.ok}</p>}
      {!locked && (
        <button className="btn mt-3 w-full !py-2.5 !text-base" disabled={pending || score === "" || mismatch}>
          {pending ? "저장 중…" : existing ? "고쳐서 저장" : "제출하기"}
        </button>
      )}
    </form>
  );
}
