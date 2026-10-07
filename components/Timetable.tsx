"use client";

import { useState } from "react";
import { KLASS_TIME, type Klass, type TimeSlot } from "@/lib/config";

const ROWS: { klass: Klass; name: string }[] = [
  { klass: "start-daily", name: "시작반" },
  { klass: "solve-daily", name: "문풀반" },
  { klass: "intensive-daily", name: "속성반" },
];

// 공개 화면용 수업 시간표. [☀️ 오전반 | 🌙 저녁반] 탭으로 바꿔 봐요.
export default function Timetable({ initial = "am" }: { initial?: TimeSlot }) {
  const [slot, setSlot] = useState<TimeSlot>(initial);
  const i = slot === "am" ? 0 : 1;
  return (
    <section className="card space-y-3">
      <p className="font-jua text-2xl text-sky-ink">🗓️ 수업 시간표</p>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-sky-soft p-1">
        {(["am", "pm"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSlot(s)} className={`rounded-xl py-2.5 font-jua text-lg ${slot === s ? "bg-sky-deep text-white" : "text-sky-ink"}`}>
            {s === "am" ? "☀️ 오전반" : "🌙 저녁반"}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {ROWS.map((r) => {
          const t = KLASS_TIME[r.klass][i];
          return (
            <li key={r.klass} className="rounded-2xl bg-sky-soft px-4 py-3">
              <p className="font-jua text-lg text-sky-ink">{r.name} <span className="text-sky-deep">{t.from}~{t.to}</span></p>
              <p className="text-sm text-slate-600">{t.detail}</p>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-500">주 4일(종합반)은 월~목, 격일반은 월·수 또는 화·목이에요. LC는 시작반·문풀반 공통 수업이에요.</p>
    </section>
  );
}
