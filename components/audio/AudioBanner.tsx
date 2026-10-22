"use client";

import { useEffect, useState } from "react";
import { AUDIO_EVENT, readDone, readGot, scrollToAudio, writeDone } from "./store";

// 라이브 버튼 아래 배너: 🎧 LC 음원 D-n · m/d까지 · 전체 n개 중 m개 받음
export default function AudioBanner({ cohort, ids, end, left, today }: { cohort: string; ids: string[]; end: string; left: number; today: string }) {
  const [got, setGot] = useState<number | null>(null);
  const [doneDay, setDoneDay] = useState("");
  useEffect(() => {
    const sync = () => {
      const n = readGot(cohort).filter((id) => ids.includes(id)).length;
      if (ids.length > 0 && n >= ids.length) writeDone(cohort, today);
      setGot(n);
      setDoneDay(readDone(cohort));
    };
    sync();
    window.addEventListener(AUDIO_EVENT, sync);
    return () => window.removeEventListener(AUDIO_EVENT, sync);
  }, [cohort, ids, today]);
  if (got === null || ids.length === 0) return null;
  const all = got >= ids.length;
  if (all && doneDay && doneDay < today) return null; // 다 받은 다음 날부터 숨김
  const [, m, d] = end.split("-").map(Number);
  const tone = all ? "border-emerald-300 bg-emerald-50 text-emerald-700" : left <= 3 ? "border-red-300 bg-red-50 text-red-600" : "border-amber-300 bg-amber-50 text-amber-800";
  return (
    <button type="button" onClick={scrollToAudio} className={`block w-full rounded-2xl border-2 px-4 py-3 text-left font-jua text-lg ${tone}`}>
      {all ? "✅ LC 음원 다 받았어요" : `🎧 LC 음원 ${left === 0 ? "D-DAY" : `D-${left}`} · ${m}/${d}까지 · ${ids.length}개 중 ${got}개 받음`}
      {!all && <span className="float-right text-sm">받으러 가기 ↓</span>}
    </button>
  );
}
