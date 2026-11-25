"use client";

import { useState } from "react";
import type { CourseCard, CourseGroup } from "@/lib/homeCourses";

// 첫 화면 강좌 시간표: [전체 · 종합반 · LC 단과 · RC 단과 · 격일반] 칩으로 골라 봐요.
const KINDS: [CourseGroup | "every", string][] = [
  ["every", "전체"],
  ["all", "종합반"],
  ["lc", "LC 단과"],
  ["rc", "RC 단과"],
  ["alt", "격일반 (2개월)"],
];

export default function Courses({ cards, starts }: { cards: CourseCard[]; starts: Record<string, string> }) {
  const [kind, setKind] = useState<CourseGroup | "every">("all");
  const list = cards.filter((c) => kind === "every" || c.group === kind);
  return (
    <>
      <div className="chips" role="tablist" aria-label="강좌 종류">
        {KINDS.map(([k, t]) => (
          <button key={k} type="button" role="tab" className="chip" aria-selected={kind === k} onClick={() => setKind(k)}>{t}</button>
        ))}
      </div>
      <div className="courses">
        {list.map((c) => (
          <article key={`${c.kind}-${c.level}-${c.days}`} className="h-card course">
            <div className="c-top">
              <span className="c-kind">{c.kind}</span>
              <span className="c-lv">{c.level}</span>
            </div>
            <h3>{c.goal}</h3>
            <p className="c-days">{c.days} <small>({c.count} · {c.months === 2 ? "2개월 과정" : "1개월 과정"})</small></p>
            <div className="c-times">
              <span><small>오전</small> {c.times[0]}</span>
              <span><small>저녁</small> {c.times[1]}</span>
            </div>
            <p className="c-start">
              <img className="ic3d xs" src="/img/icons/calendar.png" alt="" loading="lazy" />
              {starts[c.klass] ? `${starts[c.klass]} 개강` : "개강일은 곧 안내해요"} · 현장 / 불라방
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
