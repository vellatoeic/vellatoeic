"use client";

import { useState } from "react";

// 명단 복사 버튼 (엑셀·카톡에 붙여넣기용)
export default function CopyText({ text, label, className = "btn-ghost !py-1.5 text-sm" }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      className={className}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { setDone(false); }
      }}
    >
      {done ? "복사했어요 ✓" : label}
    </button>
  );
}
