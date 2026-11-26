"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/db";
import { searchFaq } from "@/lib/faqSearch";
import Icon from "./Icon";
import IconText from "./IconText";

const EXAMPLES = ["교재", "입금", "택배", "라이브", "출석", "특강"];

// 자주 묻는 질문 검색칸: 글자를 넣으면 맞는 질문만 답이 펼쳐진 채로, 비우면 원래 카테고리 목록(children)
export default function FaqSearch({ items, children }: { items: FaqItem[]; children: React.ReactNode }) {
  const [q, setQ] = useState("");
  const published = items.filter((f) => f.published);
  const found = searchFaq(published, q);
  const searching = q.trim().length > 0;
  return (
    <div className="space-y-3">
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sky-deep" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input !pl-11"
          placeholder="궁금한 것을 검색해 보세요 (예: 교재 수령)"
          aria-label="자주 묻는 질문 검색"
          enterKeyHint="search"
        />
      </div>
      {!searching && published.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((w) => (
            <button key={w} type="button" onClick={() => setQ(w)} className="rounded-full border border-sky-deep/20 bg-white px-3 py-1 text-sm text-sky-ink">{w}</button>
          ))}
        </div>
      )}
      {searching ? (
        found.length > 0 ? (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm text-slate-500">&lsquo;{q.trim()}&rsquo; 검색 결과 {found.length}개</p>
            {found.map((f) => (
              <details key={f.id} open={found.length <= 3} className="group rounded-2xl border border-sky-deep/10 bg-white shadow-[0_4px_14px_rgba(18,64,92,0.06)]">
                <summary className="flex cursor-pointer list-none items-start gap-2 px-4 py-3.5">
                  <span className="font-jua text-sky-deep">Q.</span>
                  <span className="flex-1">
                    <span className="block text-xs text-slate-400"><IconText text={f.category} /></span>
                    <span className="text-[15px] font-bold text-slate-800"><IconText text={f.question} /></span>
                  </span>
                  <span className="text-sky-main transition group-open:rotate-90">›</span>
                </summary>
                <p className="whitespace-pre-line border-t border-sky-soft px-4 py-3 text-[15px] leading-relaxed text-slate-700"><IconText text={f.answer} /></p>
              </details>
            ))}
          </div>
        ) : (
          <p className="card text-center text-slate-500" aria-live="polite">
            &lsquo;{q.trim()}&rsquo;에 맞는 질문이 없어요. 다른 낱말로 찾아보거나, 카톡 채널로 물어봐 주세요.
          </p>
        )
      ) : (
        children
      )}
    </div>
  );
}
