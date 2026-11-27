import Link from "next/link";
import Icon from "@/components/Icon";
import { activeStudentApps } from "@/lib/student";
import { examResultsByNos, type ExamResultRow } from "@/lib/db";
import { isViewOnly } from "@/lib/auth";
import { ensureStudentNo } from "@/lib/studentNumbers";
import { isStudentNo, numberForGroup } from "@/lib/mockScores";
import { specialDay } from "@/lib/special";
import { safe } from "@/lib/safe";
import LoginCard from "../LoginCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 모의고사 성적 · vella_toeic", robots: { index: false } };

// 학생 '내 모의고사 성적' (첫토익 채점 결과, 설계서 8장): 개인번호 + 회차별 총점·LC·RC·파트·틀린 문항·코멘트
// 개인번호가 아직 없는 학생은 이 화면을 열 때 받아요(강사 '학생 화면 보기' 중에는 만들지 않아요).
export default async function ScoresPage() {
  const { loggedIn, apps } = await activeStudentApps();
  if (!loggedIn) return <LoginCard next="/class/scores" />;
  if (apps.length === 0) return <div className="pt-12"><p className="card text-center text-slate-500">수강 정보가 없어요. Vella쌤에게 문의해 주세요.</p></div>;
  const viewOnly = await isViewOnly();
  const no = viewOnly ? numberForGroup(apps) : await safe("scores.studentNo", () => ensureStudentNo(apps), numberForGroup(apps));
  const nos = [...new Set([no, ...apps.map((a) => a.student_no)].filter(isStudentNo))];
  const results = await safe("scores.list", () => examResultsByNos(nos), [] as ExamResultRow[]);

  return (
    <div className="stagger wide space-y-5 pt-8">
      <Link href="/class" className="text-sm text-sky-deep underline">← 강의실로</Link>
      <h1 className="flex items-center gap-2 font-jua text-3xl text-sky-ink"><Icon name="trophy" size={36} />내 모의고사 성적</h1>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-br from-[#4fb3e8] via-sky-deep to-[#1f78ad] p-5 text-white shadow-[0_10px_26px_rgba(43,143,199,0.3)]">
        <div>
          <p className="text-sm opacity-85">내 개인번호</p>
          <p className="font-jua text-5xl tracking-[0.25em] tabular-nums">{no ?? "준비 중"}</p>
        </div>
        <p className="max-w-sm text-sm leading-relaxed opacity-95">모의고사 답안지 앞면 <b>&apos;수험번호&apos; 칸</b>에 이 번호 6자리를 적어요. 다음 달에도 같은 번호예요.</p>
      </section>

      {results.length === 0 ? (
        <p className="card text-center text-slate-500">아직 받은 모의고사 성적이 없어요. 모의고사를 보면 채점이 끝난 뒤 여기에 올라와요.</p>
      ) : (
        <div className="space-y-4">
          {results.map((r, i) => <ResultCard key={r.result_id} r={r} open={i === 0} />)}
        </div>
      )}
    </div>
  );
}

function ResultCard({ r, open }: { r: ExamResultRow; open: boolean }) {
  const parts = [...r.parts].sort((a, b) => a.part - b.part);
  const comments = r.part_comments.filter((c) => c.comment.trim());
  return (
    <details open={open} className="group card !p-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4">
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-500">{specialDay(r.exam_date)}</span>
          <b className="block font-jua text-xl text-sky-ink">{r.exam_title}</b>
        </span>
        {r.blank_sheet ? <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-500">채점 못 함</span> : <span className="font-jua text-3xl text-sky-deep tabular-nums">{r.total}<small className="ml-0.5 text-base text-slate-400">점</small></span>}
        <Icon name="chevronRight" size={16} className="text-slate-400 transition group-open:rotate-90" />
      </summary>

      <div className="space-y-5 border-t border-sky-soft px-5 py-5">
        {r.blank_sheet ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-center text-slate-600">답안지가 비어 있어 채점하지 못했어요.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-sky-deep p-3 text-white"><p className="text-xs opacity-80">총점</p><p className="font-jua text-3xl tabular-nums">{r.total}</p></div>
                <div className="rounded-2xl bg-sky-soft p-3"><p className="text-xs text-slate-500">LC · {r.lc_correct}개</p><p className="font-jua text-2xl text-sky-ink tabular-nums">{r.lc_score}</p></div>
                <div className="rounded-2xl bg-sky-soft p-3"><p className="text-xs text-slate-500">RC · {r.rc_correct}개</p><p className="font-jua text-2xl text-sky-ink tabular-nums">{r.rc_score}</p></div>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-sky-ink">파트별 정답률</p>
                {parts.map((p) => {
                  const pct = p.total > 0 ? Math.round((p.correct / p.total) * 100) : 0;
                  return (
                    <div key={p.part} className="flex items-center gap-3 text-sm">
                      <span className="w-14 shrink-0 font-bold text-slate-600">Part {p.part}</span>
                      <span className="h-3 flex-1 overflow-hidden rounded-full bg-sky-soft"><i className={`block h-full rounded-full ${pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-sky-deep" : "bg-amber-400"}`} style={{ width: `${pct}%` }} /></span>
                      <span className="w-20 shrink-0 text-right tabular-nums text-slate-600">{p.correct}/{p.total} · {pct}%</span>
                    </div>
                  );
                })}
              </div>
              {r.report_pdf_url && <a href={r.report_pdf_url} target="_blank" rel="noreferrer" className="btn flex w-full items-center justify-center gap-2"><Icon name="doc" size={22} />분석지 받기 ↗</a>}
            </div>

            <div className="space-y-4">
              <div>
                <p className="font-bold text-sky-ink">틀린 문항 <span className="font-normal text-slate-500">{r.wrong.length}개</span></p>
                {r.wrong.length === 0 ? (
                  <p className="mt-2 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">틀린 문항이 없어요!</p>
                ) : (
                  <div className="mt-2 grid max-h-80 grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5 overflow-y-auto rounded-2xl bg-sky-soft/60 p-2">
                    {r.wrong.map((w) => (
                      <span key={w.q} className="rounded-xl bg-white px-2 py-1.5 text-center text-xs shadow-[0_1px_0_#d5ecf9]">
                        <b className="block text-sm text-sky-ink tabular-nums">{w.q}번</b>
                        <span className="text-slate-500">정답 <b className="text-emerald-600">{w.answer}</b> · 내 답 {w.chosen ? <b className="text-red-500">{w.chosen}</b> : <b className="text-slate-400">무응답</b>}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {r.comment && (
                <div className="rounded-2xl bg-[#fffbea] p-4">
                  <p className="font-bold text-[#7d6728]">총평</p>
                  <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{r.comment}</p>
                </div>
              )}
              {comments.length > 0 && (
                <div className="space-y-2">
                  <p className="font-bold text-sky-ink">파트별 코멘트</p>
                  {comments.map((c) => (
                    <p key={c.part} className="rounded-2xl bg-white p-3 text-sm leading-relaxed text-slate-700 ring-1 ring-sky-main/40"><b className="mr-1 text-sky-deep">Part {c.part}</b>{c.comment}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
