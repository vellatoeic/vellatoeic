import Link from "next/link";
import { listFaq } from "@/lib/db";
import { activeStudentApps } from "@/lib/student";
import StudentLogin from "@/app/class/StudentLogin";
import QuestionForm from "./QuestionForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "자주 묻는 질문 · vella_toeic" };

export default async function FaqPage({ searchParams }: { searchParams: Promise<{ login?: string }> }) {
  const { login } = await searchParams;
  if (login) return <StudentLogin next="/faq" note="로그인하면 질문을 남길 수 있어요." />;

  const [items, { apps }] = await Promise.all([listFaq(), activeStudentApps()]);
  const published = items.filter((f) => f.published);
  // 카테고리는 맨 앞 항목 순서대로 보여줘요.
  const categories = [...new Set(published.map((f) => f.category))];

  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <h1 className="font-jua text-4xl text-sky-ink">자주 묻는 질문</h1>
        <p className="mt-2 text-slate-600">질문을 누르면 답이 펼쳐져요.</p>
      </div>

      {categories.length === 0 && <p className="card text-center text-slate-500">아직 등록된 질문이 없어요.</p>}

      {categories.map((c) => (
        <section key={c} className="space-y-2">
          <h2 className="font-jua px-1 text-xl text-sky-ink">{c}</h2>
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
        </section>
      ))}

      <section className="card space-y-3">
        <p className="font-jua text-xl text-sky-ink">✍️ 여기 없는 질문 남기기</p>
        {apps.length > 0 ? <QuestionForm name={apps[0].name} /> : (
          <>
            <p className="text-sm text-slate-600">강의실에 로그인한 수강생만 남길 수 있어요.</p>
            <Link href="/faq?login=1" className="btn-ghost w-full">로그인하고 남기기</Link>
          </>
        )}
      </section>
    </div>
  );
}
