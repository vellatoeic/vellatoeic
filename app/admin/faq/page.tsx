import { isAdmin } from "@/lib/auth";
import { isPreview, listFaq, listQuestions, type FaqItem } from "@/lib/db";
import { addFaq, moveFaq, promoteQuestion, removeFaq, renameFaqCategory, saveFaq, toggleFaq, toggleQuestionChecked } from "@/app/actions";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import CloseOnSubmitForm from "../CloseOnSubmitForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "FAQ·질문함 · vella_toeic", robots: { index: false } };

function Fields({ item, categories }: { item?: FaqItem; categories: string[] }) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <label><span className="text-xs text-slate-500">카테고리</span>
          <select name="category" defaultValue={item?.category ?? categories[0] ?? ""} className="input !py-2">
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="">+ 새 카테고리 (오른쪽에 입력)</option>
          </select>
        </label>
        <label><span className="text-xs text-slate-500">새 카테고리 이름 (새로 만들 때만)</span><input name="new_category" placeholder="예: 🧾 기타" className="input !py-2" /></label>
      </div>
      <label><span className="text-xs text-slate-500">질문</span><input name="question" defaultValue={item?.question} required className="input !py-2" /></label>
      <label><span className="text-xs text-slate-500">답</span><textarea name="answer" defaultValue={item?.answer} rows={3} className="input !py-2" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={item ? item.published : true} className="h-4 w-4 accent-sky-deep" /> 학생에게 공개</label>
    </>
  );
}

export default async function FaqAdmin() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const [items, questions] = await Promise.all([listFaq(), listQuestions()]);
  const categories = [...new Set(items.map((f) => f.category))];
  const unchecked = questions.filter((q) => !q.checked).length;

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="faq" />

      <section className="card space-y-3">
        <h2 className="font-jua text-2xl text-sky-ink">📮 질문함 <span className="text-base text-slate-400">· 확인 전 {unchecked}개</span></h2>
        {questions.length === 0 ? <p className="text-sm text-slate-500">아직 남겨진 질문이 없어요.</p> : (
          <ul className="space-y-2">
            {questions.map((q) => (
              <li key={q.id} className={`rounded-2xl p-3 ${q.checked ? "bg-slate-50 opacity-60" : "bg-sky-soft"}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${q.kind === "question" ? "bg-white text-sky-deep" : "bg-amber-100 text-amber-700"}`}>{q.kind === "question" ? "❓ 질문" : "💡 제안"}</span>
                  <b className="text-sky-ink">{q.name}</b>
                  <span className="text-xs text-slate-400">{new Date(q.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-[15px] text-slate-800">{q.content}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={toggleQuestionChecked}>
                    <input type="hidden" name="id" value={q.id} />
                    <button className="btn-ghost !py-1.5 text-sm">{q.checked ? "확인 취소" : "확인함 ✓"}</button>
                  </form>
                  {q.kind === "question" && (
                    <form action={promoteQuestion}>
                      <input type="hidden" name="id" value={q.id} />
                      <button className="btn-ghost !py-1.5 text-sm">FAQ로 올리기 (숨김으로 추가)</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="card">
        <summary className="font-jua cursor-pointer text-lg text-sky-ink">+ FAQ 항목 추가하기</summary>
        <CloseOnSubmitForm action={addFaq} className="mt-3 grid gap-2">
          <Fields categories={categories} />
          <button className="btn justify-self-start !py-2 !text-sm">추가</button>
        </CloseOnSubmitForm>
      </details>

      {categories.map((c) => {
        const list = items.filter((f) => f.category === c);
        return (
          <section key={c} className="card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-jua text-xl text-sky-ink">{c} <span className="text-sm text-slate-400">· {list.length}개 (숨김 {list.filter((f) => !f.published).length})</span></h3>
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-500">카테고리 이름 바꾸기</summary>
                <CloseOnSubmitForm action={renameFaqCategory} className="mt-2 flex gap-2">
                  <input type="hidden" name="from" value={c} />
                  <input name="to" defaultValue={c} required className="input !w-56 !py-1.5" />
                  <button className="btn !py-1.5 !text-sm">저장</button>
                </CloseOnSubmitForm>
              </details>
            </div>
            <ul className="divide-y divide-sky-soft">
              {list.map((f, i) => (
                <li key={f.id} className="py-2">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${f.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{f.published ? "공개" : "숨김"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800">{f.question}</p>
                      <p className={`text-sm ${f.answer ? "text-slate-500" : "text-amber-600"}`}>{f.answer || "답을 채워 주세요"}</p>
                    </div>
                    <form action={moveFaq} className="flex shrink-0 gap-1">
                      <input type="hidden" name="id" value={f.id} />
                      <button name="dir" value="up" disabled={i === 0} className="rounded-lg bg-sky-soft px-2 py-1 text-sm disabled:opacity-30" aria-label="위로">▲</button>
                      <button name="dir" value="down" disabled={i === list.length - 1} className="rounded-lg bg-sky-soft px-2 py-1 text-sm disabled:opacity-30" aria-label="아래로">▼</button>
                    </form>
                  </div>
                  <div className="mt-1 flex flex-wrap items-start gap-3 pl-12 text-sm">
                    <form action={toggleFaq}>
                      <input type="hidden" name="id" value={f.id} />
                      <button className="text-sky-deep underline">{f.published ? "숨기기" : "공개하기"}</button>
                    </form>
                    <details className="min-w-0 flex-1">
                      <summary className="cursor-pointer text-slate-500">수정</summary>
                      <CloseOnSubmitForm action={saveFaq} className="mt-2 grid gap-2 rounded-xl bg-sky-soft p-3">
                        <input type="hidden" name="id" value={f.id} />
                        <Fields item={f} categories={categories} />
                        <button className="btn justify-self-start !py-2 !text-sm">수정 저장</button>
                      </CloseOnSubmitForm>
                      <CloseOnSubmitForm action={removeFaq} className="mt-2">
                        <input type="hidden" name="id" value={f.id} />
                        <button className="text-red-400 underline">이 항목 삭제</button>
                      </CloseOnSubmitForm>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
