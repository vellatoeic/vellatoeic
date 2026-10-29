"use client";

import { useEffect, useState } from "react";

// 입금 마감 안내: '○시 ○분까지 입금해 주세요' + 남은 시간. 시간이 지나면 화면을 새로 불러와 취소 안내로 바뀌어요.
export default function DepositCountdown({ deadline }: { deadline: string }) {
  const end = Date.parse(deadline);
  const [left, setLeft] = useState(() => end - Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const v = end - Date.now();
      setLeft(v);
      if (v <= 0) { clearInterval(t); setTimeout(() => window.location.reload(), 1500); }
    }, 1000);
    return () => clearInterval(t);
  }, [end]);
  const at = new Date(end).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" });
  const m = Math.max(0, Math.floor(left / 60000));
  const s = Math.max(0, Math.floor((left % 60000) / 1000));
  return (
    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-center">
      <p className="font-jua text-lg text-red-600">{at}까지 입금해 주세요</p>
      <p className="font-jua text-2xl text-red-600">{left > 0 ? `남은 시간 ${m}분 ${String(s).padStart(2, "0")}초` : "시간이 지났어요"}</p>
      <p className="text-xs text-slate-600">30분 안에 확인되지 않으면 신청이 자동 취소돼요</p>
    </div>
  );
}
