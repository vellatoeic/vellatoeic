import { listFaq } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "자주 묻는 질문 · vella_toeic" };

export default async function FaqPage() {
  let items: Awaited<ReturnType<typeof listFaq>>;
  try {
    items = await listFaq();
  } catch (e) {
    // 원인을 바로 알 수 있게 오류 내용을 작게 보여줘요.
    const detail = e instanceof Error ? e.message : typeof e === "object" && e ? JSON.stringify(e) : String(e);
    console.error("FAQ 불러오기 실패", detail);
    return (
      <div className="pt-12">
        <div className="card mx-auto max-w-sm space-y-2 text-center">
          <p className="font-jua text-2xl text-sky-ink">자주 묻는 질문을 불러오지 못했어요</p>
          <p className="text-slate-600">잠시 후 다시 열어 주세요.</p>
          <p className="break-all rounded-xl bg-slate-50 p-2 text-left text-xs text-slate-400">{detail}</p>
        </div>
      </div>
    );
  }
  const published = items.filter((f) => f.published);
  // 카테고리는 맨 앞 항목 순서대로 보여줘요.
  const categories = [...new Set(published.map((f) => f.category))];

  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <h1 className="font-jua text-4xl text-sky-ink">자주 묻는 질문</h1>
      </div>

      {categories.length === 0 && <p className="card text-center text-slate-500">아직 등록된 질문이 없어요.</p>}

      {/* 큰 제목(카테고리)마다 접어 두고, 누르면 그 안의 질문이 보여요. */}
      {categories.map((c) => (
        <details key={c} className="group/cat rounded-3xl bg-sky-main/30 p-2">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5">
            <span className="font-jua text-xl text-sky-ink">{c}</span>
            <span className="text-sky-deep transition group-open/cat:rotate-90">›</span>
          </summary>
          <div className="mt-1 space-y-2">
          {published.filter((f) => f.category === c).map((f) => (
            <details key={f.id} className="group rounded-2xl bg-white shadow-[0_2px_0_#d5ecf9]">
              <summary className="flex cursor-pointer list-none items-start gap-2 px-4 py-3.5">
                <span className="font-jua text-sky-deep">Q.</span>
                <span className="flex-1 text-[15px] font-bold text-slate-800">{f.question}</span>
                <span className="text-sky-main transition group-open:rotate-90">›</span>
              </summary>
              <p className="whitespace-pre-line border-t border-sky-soft px-4 py-3 text-[15px] leading-relaxed text-slate-700">{f.answer}</p>
            </details>
          ))}
          </div>
        </details>
      ))}

    </div>
  );
}
