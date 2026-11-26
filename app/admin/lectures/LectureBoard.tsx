"use client";

import { keep } from "@/lib/keep";
import { useActionState, useEffect, useRef } from "react";
import { uploadBoardLectures, type FormState } from "@/app/actions";
import Icon from "@/components/Icon";

export type BoardRowView = {
  id: string;
  slot: "am" | "pm";
  time: string; // "10:00~11:00"
  label: string; // "시작반 RC"
  to: string; // "시작반" / "시작반 + 문풀반"
  title: string; // 기본 제목
  done: boolean;
  youtubeId: string | null;
  missing: string[]; // LC 공통인데 한 반에만 올라간 경우 빠진 반
  live: boolean; // 지금 수업 중(또는 10분 전)
};

// '오늘 수업 링크' 판: 칸마다 링크만 붙여 넣고 [채운 칸 올리기] 한 번 (반·RC/LC·시간대는 자동)
export default function LectureBoard({ cohort, date, dateText, rows }: { cohort: string; date: string; dateText: string; rows: BoardRowView[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadBoardLectures, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  const part = (slot: "am" | "pm") => (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 font-jua text-lg text-sky-ink">
        <Icon name={slot === "am" ? "sun" : "moon"} size={20} />
        {slot === "am" ? "오전반" : "저녁반"}
      </p>
      {rows.filter((r) => r.slot === slot).map((r) => (
        <div key={r.id} className={`rounded-2xl border-2 px-3 py-2.5 ${r.live ? "border-red-300 bg-red-50/60" : r.done ? "border-emerald-200 bg-emerald-50/50" : "border-sky-main/60 bg-white"}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-bold tabular-nums text-slate-500">{r.time}</span>
            <b className="text-sky-ink">{r.label}</b>
            <span className="text-xs text-slate-400">→ {r.to}</span>
            {r.live && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">지금</span>}
            <span className="ml-auto">
              {r.done ? (
                <a href={`https://youtu.be/${r.youtubeId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  <Icon name="check" size={12} />올림
                </a>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">아직</span>
              )}
            </span>
          </div>
          {r.missing.length > 0 && <p className="mt-1 text-xs font-bold text-amber-700">{r.missing.join(", ")}에는 아직 없어요. 같은 링크를 다시 넣으면 채워져요.</p>}
          <input name={`link_${r.id}`} className="input mt-2 !py-2 text-sm" placeholder={r.done ? "다시 올리려면 새 링크 붙여넣기" : "유튜브 링크 붙여넣기"} inputMode="url" autoComplete="off" />
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-slate-400">제목: {r.title}</summary>
            <input name={`title_${r.id}`} className="input mt-1 !py-1.5 text-sm" placeholder={r.title} />
          </details>
        </div>
      ))}
    </div>
  );

  return (
    <form ref={ref} onSubmit={keep(action)} className="card space-y-4">
      <input type="hidden" name="cohort" value={cohort} />
      <input type="hidden" name="date" value={date} />
      <div>
        <p className="font-jua text-2xl text-sky-ink">{dateText} 수업 링크</p>
        <p className="mt-1 text-sm text-slate-500">
          시간표 칸에 유튜브 링크만 붙여 넣으면 <b className="text-sky-ink">반·RC/LC·오전/저녁이 자동</b>으로 정해져요. LC 공통은 시작반·문풀반에 함께 올라가요.
          수업 전에 올리면 그 반 학생의 [라이브 입장]이 바로 이 링크로 열리고, 끝나면 지난 강의가 돼요.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {part("am")}
        {part("pm")}
      </div>
      {state.error && <p className="font-bold text-red-600">{state.error}</p>}
      {state.ok && <p className="font-bold text-sky-deep">{state.ok}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "올리는 중…" : "채운 칸 올리기"}</button>
    </form>
  );
}
