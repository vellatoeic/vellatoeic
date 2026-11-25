import { listFaq } from "@/lib/db";
import { pageMeta } from "@/lib/seo";
import FaqList from "@/components/FaqList";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("자주 묻는 질문 | 부산 서면 토익 벨라토익", "부산 서면 토익 벨라토익 자주 묻는 질문. 교재비 납부, 교재 수령, 강의실·라이브, 출석·숙제, 특강 안내를 모았어요.", "/faq");

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
  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <p className="text-xs font-bold tracking-[0.12em] text-sky-deep">FAQ</p>
        <h1 className="font-jua mt-1 text-4xl text-sky-ink">자주 묻는 질문</h1>
      </div>
      <FaqList items={items} />
    </div>
  );
}
