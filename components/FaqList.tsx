import type { FaqItem } from "@/lib/db";
import IconText from "./IconText";

// 자주 묻는 질문 목록 (/faq와 첫 화면이 같이 써요). 관리 [FAQ]에서 공개한 질문만 보여요.
// 큰 제목(카테고리)마다 접어 두고, 누르면 그 안의 질문이, 질문을 누르면 답이 펼쳐져요.
export default function FaqList({ items }: { items: FaqItem[] }) {
  const published = items.filter((f) => f.published);
  const categories = [...new Set(published.map((f) => f.category))]; // 맨 앞 항목 순서대로
  if (categories.length === 0) return <p className="card text-center text-slate-500">아직 등록된 질문이 없어요.</p>;
  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
      {categories.map((c) => (
        <details key={c} className="group/cat rounded-[20px] border border-sky-deep/15 bg-white/70 p-2">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5">
            <span className="font-jua text-lg text-sky-ink"><IconText text={c} /></span>
            <span className="text-xl text-sky-deep transition group-open/cat:rotate-90">›</span>
          </summary>
          <div className="mt-1 space-y-2">
            {published.filter((f) => f.category === c).map((f) => (
              <details key={f.id} className="group rounded-2xl border border-sky-deep/10 bg-white shadow-[0_4px_14px_rgba(18,64,92,0.06)]">
                <summary className="flex cursor-pointer list-none items-start gap-2 px-4 py-3.5">
                  <span className="font-jua text-sky-deep">Q.</span>
                  <span className="flex-1 text-[15px] font-bold text-slate-800"><IconText text={f.question} /></span>
                  <span className="text-sky-main transition group-open:rotate-90">›</span>
                </summary>
                <p className="whitespace-pre-line border-t border-sky-soft px-4 py-3 text-[15px] leading-relaxed text-slate-700"><IconText text={f.answer} /></p>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
