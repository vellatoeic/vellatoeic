"use client";
import type { TimeSlot } from "@/lib/config";

// slot을 주면 그 시간대 칸만 인쇄해요 (data-slot-part가 다른 칸은 인쇄에서 숨김, globals.css)
export default function PrintButton({ slot, label = "인쇄하기" }: { slot?: TimeSlot; label?: string }) {
  return (
    <button
      onClick={() => {
        const html = document.documentElement;
        if (slot) html.dataset.printing = slot;
        const clear = () => { delete html.dataset.printing; window.removeEventListener("afterprint", clear); };
        window.addEventListener("afterprint", clear);
        window.print();
      }}
      className="btn-ghost !py-2 text-sm print:hidden"
    >
      {label}
    </button>
  );
}
