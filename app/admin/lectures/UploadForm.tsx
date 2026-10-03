"use client";

import { keep } from "@/lib/keep";
import { useActionState, useRef, useEffect, useState } from "react";
import { uploadLecture, type FormState } from "@/app/actions";
import { COURSES, PARTS, LECTURE_COURSES, type CourseId, type Part } from "@/lib/config";

export default function UploadForm({ defaultCohort }: { defaultCohort: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadLecture, {});
  const [course, setCourse] = useState<CourseId>("start");
  const [part, setPart] = useState<Part>("rc");
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
      <input type="hidden" name="course" value={course} />
      <input type="hidden" name="part" value={part} />
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" name="cohort" defaultValue={defaultCohort} className="input !w-44 !py-2" />
        {LECTURE_COURSES.map((c) => (
          <button type="button" key={c} onClick={() => setCourse(c)} className={pill(course === c)}>
            {COURSES[c].label}
          </button>
        ))}
        <span className="mx-1 text-slate-300">|</span>
        {(Object.keys(PARTS) as Part[]).map((p) => (
          <button type="button" key={p} onClick={() => setPart(p)} className={pill(part === p)}>
            {PARTS[p]}
          </button>
        ))}
      </div>
      <input name="title" className="input" placeholder="강의 제목 (예: 1강 품사 자리 찾기)" />
      <input name="url" className="input" placeholder="유튜브 링크 붙여넣기 (https://youtu.be/...)" />
      {state.error && <p className="font-bold text-red-600">{state.error}</p>}
      {state.ok && <p className="font-bold text-sky-deep">{state.ok}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "올리는 중…" : "강의 올리기"}
      </button>
    </form>
  );
}
