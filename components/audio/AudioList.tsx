"use client";

import { useEffect, useState } from "react";
import { AUDIO_EVENT, markGot, readGot } from "./store";

// 음원 파일 목록: 누르면 '받음 ✓' (이 기기에 기록)
export default function AudioList({ cohort, items }: { cohort: string; items: { id: string; title: string }[] }) {
  const [got, setGot] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setGot(readGot(cohort));
    sync();
    window.addEventListener(AUDIO_EVENT, sync);
    return () => window.removeEventListener(AUDIO_EVENT, sync);
  }, [cohort]);
  return (
    <ol className="mt-2 space-y-1.5">
      {items.map((x) => {
        const done = got.includes(x.id);
        return (
          <li key={x.id}>
            <a href={`/class/audio/${x.id}`} onClick={() => markGot(cohort, x.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] ${done ? "bg-emerald-50 text-slate-600" : "bg-white text-slate-800"}`}>
              <span className="flex-1">{x.title}</span>
              {done ? <span className="text-sm font-bold text-emerald-600">받음 ✓</span> : <span className="text-sm text-sky-deep">zip 받기 ↓</span>}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
