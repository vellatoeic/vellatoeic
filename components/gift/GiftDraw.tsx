"use client";

import { useState } from "react";
import { drawMyGift } from "@/app/actions";
import type { GiftDraw as Draw } from "@/lib/db";

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

// 🎁 스티커판 완성 선물 뽑기: 버튼 → 2초 뽑기 → 결과 카드(캡처용). 다시 들어와도 같은 카드만 보여요.
export default function GiftDraw({ initial, month, channelUrl }: { initial: Draw | null; month: number; channelUrl: string }) {
  const [draw, setDraw] = useState<Draw | null>(initial);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState(false);

  async function go() {
    setError("");
    setRolling(true);
    const [r] = await Promise.all([drawMyGift(), new Promise((ok) => setTimeout(ok, 2000))]);
    setRolling(false);
    if (r.draw) { setDraw(r.draw); setFresh(true); } else setError(r.error ?? "다시 눌러 주세요.");
  }

  if (!draw) {
    return (
      <div className="rounded-3xl border-2 border-[#ffd23f] bg-gradient-to-br from-[#fff3c4] via-[#ffe1ea] to-[#d6f1ff] p-5 text-center">
        <p className="font-jua text-2xl text-[#7d6728]">🎉 {month}월 스티커판 완성!</p>
        <p className="mt-1 text-sm text-[#a7741a]">선물을 뽑을 수 있어요 (한 번만)</p>
        <button onClick={go} disabled={rolling} className="mt-3 w-full rounded-2xl bg-[#e5707e] py-4 font-jua text-2xl text-white shadow-[0_4px_0_#b94f5b] disabled:opacity-90">
          {rolling ? <span className="inline-block animate-bounce">🎁 두근두근…</span> : "🎁 선물 뽑기"}
        </button>
        {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative">
      {fresh && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="absolute animate-[gift-fall_1.8s_ease-in_forwards] text-xl" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.12}s`, top: "-10%" }}>
              {["🎉", "✨", "⭐", "🎊", "💛", "☁️"][i % 6]}
            </span>
          ))}
        </div>
      )}
      {/* 캡처용 결과 카드: 한 화면에 다 보이게 */}
      <div className="rounded-3xl border-4 border-[#ffd23f] bg-gradient-to-br from-[#fff9e0] via-white to-[#eaf6fd] p-5 text-center shadow-[0_4px_0_#e0b400]">
        <p className="font-jua text-xl text-sky-ink">🎉 {draw.name}님 · {month}월 스티커판 완성!</p>
        <p className="mt-3 rounded-2xl bg-white px-3 py-4 font-jua text-3xl text-[#e5707e] shadow-[0_2px_0_#ffd6e0]">🎁 {draw.gift_name}</p>
        <p className="mt-3 text-sm text-slate-600">{draw.klass} · {draw.kind} · {when(draw.drawn_at)}</p>
        <p className="mt-2 font-jua text-lg text-sky-ink">확인 코드: <span className="rounded-lg bg-sky-deep px-2 py-0.5 tracking-[0.25em] text-white">{draw.code}</span></p>
        {draw.sent_at && <p className="mt-3 rounded-xl bg-emerald-50 py-2 font-jua text-lg text-emerald-700">✅ 선물 보냈어요</p>}
      </div>
      {!draw.sent_at && (
        <div className="mt-2 space-y-2 rounded-2xl bg-white p-3 text-center text-sm text-slate-700">
          <p>📸 이 화면을 캡처해서 이름과 함께 벨라토익 카톡 채널로 보내 주세요. 확인 후 모바일 선물로 보내드려요!</p>
          {channelUrl && <a href={channelUrl} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-[#fee500] px-4 py-2 font-bold text-[#3c1e1e]">카톡 채널 열기 ↗</a>}
        </div>
      )}
    </div>
  );
}
