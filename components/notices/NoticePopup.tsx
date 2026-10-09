"use client";

import { useEffect, useState, startTransition } from "react";
import { readNotice } from "@/app/actions";
import type { Notice } from "@/lib/notices";
import { NoticeBody, NoticeHeader } from "./NoticeContent";

const SEEN_KEY = (id: string) => `vella-notice-seen:${id}`;

// 아래에서 올라오는 공지 창. 여러 개면 최신순으로 넘겨 봐요(1/2). [확인했어요]를 누르면 다시 안 떠요.
// 로그인 안 한 방문자는 '전체' 공지만, 기기당 한 번 (브라우저에 기록).
export default function NoticePopup({ notices, loggedIn }: { notices: Notice[]; loggedIn: boolean }) {
  const [list, setList] = useState<Notice[]>(loggedIn ? notices : []);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (loggedIn) return;
    try {
      setList(notices.filter((n) => !localStorage.getItem(SEEN_KEY(n.id))));
    } catch {
      setList([]);
    }
  }, [notices, loggedIn]);

  if (list.length === 0) return null;
  const n = list[Math.min(i, list.length - 1)];

  function confirm() {
    if (loggedIn) {
      const fd = new FormData();
      fd.set("id", n.id);
      startTransition(() => readNotice(fd));
    } else {
      try { localStorage.setItem(SEEN_KEY(n.id), "1"); } catch { /* 저장이 안 돼도 창은 닫아요 */ }
    }
    setList((l) => l.filter((x) => x.id !== n.id));
    setI(0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(18,52,74,.45)] p-2.5 pb-3.5 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label="새 공지">
      <div className="flex max-h-[88dvh] w-full max-w-md animate-[notice-up_.45s_cubic-bezier(.2,1,.3,1)] flex-col overflow-hidden rounded-[28px] bg-white">
        <NoticeHeader notice={n} page={`${Math.min(i, list.length - 1) + 1} / ${list.length}`} />
        <div className="overflow-y-auto"><NoticeBody notice={n} /></div>
        <div className="flex gap-2 px-[18px] pb-4 pt-2.5">
          {n.link_url && n.link_label && (
            <a href={n.link_url} target="_blank" rel="noreferrer" className="grid place-items-center rounded-2xl bg-[#e2f7ee] px-3.5 py-3.5 font-jua text-[15px] text-[#2f9e6e]">{n.link_label}</a>
          )}
          <button onClick={confirm} className="flex-1 rounded-2xl bg-sky-deep py-3.5 font-jua text-lg text-white shadow-[0_4px_0_#1f6f9d]">확인했어요 ✓</button>
        </div>
        {list.length > 1 && (
          <div className="flex justify-between px-[18px] pb-3 text-sm text-slate-400">
            <button disabled={i === 0} onClick={() => setI((x) => x - 1)} className="disabled:opacity-30">‹ 이전 공지</button>
            <button disabled={i >= list.length - 1} onClick={() => setI((x) => x + 1)} className="disabled:opacity-30">다음 공지 ›</button>
          </div>
        )}
      </div>
    </div>
  );
}
