"use client";

import { useEffect, useRef, useState } from "react";
import type { Review } from "@/lib/homeContent";

// 수강생 후기: 옆으로 넘겨 보고, [전체 읽기]를 누르면 아래에서 올라오는 창으로 전체 글을 봐요.
export default function Reviews({ reviews }: { reviews: Review[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const r = open === null ? null : reviews[open];
  return (
    <>
      <div className="reviews" tabIndex={0} aria-label="수강생 후기">
        {reviews.map((rv, i) => (
          <article key={rv.title} className="h-card review rv">
            <span className="qmark" aria-hidden="true">&ldquo;</span>
            <h3>{rv.title}</h3>
            <p className="clip">{rv.body}</p>
            <footer>
              <span>{rv.who}</span>
              <button type="button" className="h-btn text sm" onClick={() => setOpen(i)}>전체 읽기 ›</button>
            </footer>
          </article>
        ))}
      </div>
      <dialog ref={ref} className="h-sheet" onClose={() => setOpen(null)} onClick={(e) => e.target === ref.current && setOpen(null)}>
        {r && (
          <div className="h-sheet-in">
            <button type="button" className="h-sheet-x" aria-label="닫기" onClick={() => setOpen(null)}>✕</button>
            <p className="eyebrow">토익의 시작 &lsquo;Vella Toeic&rsquo;을 만나고</p>
            <h3>{r.title}</h3>
            <p className="h-sheet-body">{r.body}</p>
            <p className="who">{r.who}</p>
            <p className="fine">벨라토익 소개 자료에 실린 후기 원문이에요.</p>
          </div>
        )}
      </dialog>
    </>
  );
}
