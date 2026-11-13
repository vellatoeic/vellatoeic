"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const KEY = "vella-tests-auto-refresh";

// 새 제출 결과 불러오기: 기본은 꺼짐 → [새로고침] 버튼으로. 켜면 화면이 보이는 동안 30초마다.
// (켜기/끄기는 이 기기에만 기억해요. 전송량을 아끼려고 5초 → 30초로 늘렸어요)
export default function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [pending, start] = useTransition();
  const [at, setAt] = useState("");
  useEffect(() => {
    try { setOn(localStorage.getItem(KEY) === "1"); } catch {}
  }, []);
  const refresh = () => start(() => {
    router.refresh();
    setAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  });
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [on, seconds]);
  const toggle = () => {
    const next = !on;
    setOn(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch {}
  };
  return (
    <div className="print:hidden flex flex-wrap items-center gap-2 text-sm">
      <button type="button" onClick={refresh} disabled={pending} className="btn !py-2 !text-sm">{pending ? "불러오는 중…" : "🔄 새로고침"}</button>
      <button type="button" onClick={toggle} className={`rounded-full px-3 py-1.5 font-bold ${on ? "bg-sky-deep text-white" : "bg-white text-sky-ink ring-1 ring-sky-main"}`}>
        자동 새로고침 {on ? `켜짐 (${seconds}초마다)` : "꺼짐"}
      </button>
      {at && <span className="text-xs text-slate-400">{at} 기준</span>}
    </div>
  );
}
