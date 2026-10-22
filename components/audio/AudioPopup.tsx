"use client";

import { useEffect, useState } from "react";
import { popupKey, readFlag, scrollToAudio, writeFlag } from "./store";

// 다운로드 기간에 강의실에 처음 들어오면 한 번 띄워요 (기수별로 한 번)
export default function AudioPopup({ cohort, end }: { cohort: string; end: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (!readFlag(popupKey(cohort))) setShow(true); }, [cohort]);
  if (!show) return null;
  const [, m, d] = end.split("-").map(Number);
  const close = (go: boolean) => {
    writeFlag(popupKey(cohort));
    setShow(false);
    if (go) setTimeout(scrollToAudio, 50);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-3 rounded-3xl bg-white p-6 text-center shadow-xl">
        <p className="font-jua text-2xl text-sky-ink">🎧 LC 음원은 {m}/{d}까지만 받을 수 있어요</p>
        <p className="text-slate-700">기간이 지나면 다시 받을 수 없어요.<br />지금 전체 다운로드해 주세요!</p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={() => close(false)} className="btn-ghost">확인했어요</button>
          <button type="button" onClick={() => close(true)} className="btn">지금 받으러 가기</button>
        </div>
      </div>
    </div>
  );
}
