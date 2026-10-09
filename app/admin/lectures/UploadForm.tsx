"use client";

import { keep } from "@/lib/keep";
import { useActionState, useRef, useEffect, useState } from "react";
import { uploadLecture, type FormState } from "@/app/actions";
import { COURSES, PARTS, LECTURE_COURSES, TIME_SLOTS, type CourseId, type Part, type TimeSlot } from "@/lib/config";

export default function UploadForm({ defaultCohort }: { defaultCohort: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadLecture, {});
  // 반·RC/LC·시간대 모두 여러 개 고를 수 있어요 (고른 조합마다 하나씩 등록)
  const [courses, setCourses] = useState<CourseId[]>(["start"]);
  const [parts, setParts] = useState<Part[]>(["rc"]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const combos = courses.length * parts.length * slots.length;
  const ref = useRef<HTMLFormElement>(null);

  // 올리고 나면 제목·링크 칸만 비우기 (반·파트는 유지해서 연속 업로드 편하게)
  useEffect(() => {
    if (state.ok && ref.current) {
      (ref.current.elements.namedItem("title") as HTMLInputElement).value = "";
      (ref.current.elements.namedItem("url") as HTMLInputElement).value = "";
    }
  }, [state]);

  const pill = (on: boolean) =>
    `rounded-full border-2 px-4 py-2 font-bold transition ${on ? "border-sky-deep bg-sky-deep text-white" : "border-sky-main bg-white text-sky-ink"}`;

  return (
    <form ref={ref} onSubmit={keep(action)} className="card space-y-4">
      <p className="font-jua text-2xl text-sky-ink">강의 올리기</p>
      {courses.map((c) => <input key={c} type="hidden" name="course" value={c} />)}
      {parts.map((p) => <input key={p} type="hidden" name="part" value={p} />)}
      {slots.map((s) => <input key={s} type="hidden" name="slot" value={s} />)}
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" name="cohort" defaultValue={defaultCohort} className="input !w-44 !py-2" />
        {LECTURE_COURSES.map((c) => (
          <button type="button" key={c} aria-pressed={courses.includes(c)} onClick={() => setCourses((l) => toggle(l, c))} className={pill(courses.includes(c))}>
            {courses.includes(c) ? "✓ " : ""}{COURSES[c].label}
          </button>
        ))}
        <span className="mx-1 text-slate-300">|</span>
        {(Object.keys(PARTS) as Part[]).map((p) => (
          <button type="button" key={p} aria-pressed={parts.includes(p)} onClick={() => setParts((l) => toggle(l, p))} className={pill(parts.includes(p))}>
            {parts.includes(p) ? "✓ " : ""}{PARTS[p]}
          </button>
        ))}
        <span className="mx-1 text-slate-300">|</span>
        {(Object.keys(TIME_SLOTS) as TimeSlot[]).map((s) => (
          <button type="button" key={s} aria-pressed={slots.includes(s)} onClick={() => setSlots((l) => toggle(l, s))} className={pill(slots.includes(s))}>
            {slots.includes(s) ? "✓ " : ""}{TIME_SLOTS[s]}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-500">여러 개를 함께 고를 수 있어요. {combos > 0 ? <b className="text-sky-ink">고른 조합 {combos}곳에 한 번에 올라가요.</b> : "반·RC/LC·시간대를 하나 이상씩 골라 주세요."}</p>
      <input name="title" className="input" placeholder="강의 제목 (예: 1강 품사 자리 찾기)" />
      <input name="url" className="input" placeholder="유튜브 링크 붙여넣기 (https://youtu.be/...)" />
      {state.error && <p className="font-bold text-red-600">{state.error}</p>}
      {state.ok && <p className="font-bold text-sky-deep">{state.ok}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "올리는 중…" : combos > 1 ? `강의 올리기 (${combos}곳)` : "강의 올리기"}
      </button>
    </form>
  );
}
