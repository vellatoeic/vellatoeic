import { COURSES, KINDS, TRACKS, TIME_SLOTS, cohortLabel } from "@/lib/config";
import { currentCohort, isPreview, listApplications, listExamResults, type Application, type ExamResultRow } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { isActive } from "@/lib/access";
import { sameName } from "@/lib/mockScores";
import { fillStudentNumbers } from "@/lib/studentNumbers";
import { specialDay } from "@/lib/special";
import { safe } from "@/lib/safe";
import { linkExamResults, removeExamResults, unlinkExamResult } from "@/app/actions";
import Icon from "@/components/Icon";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "모의고사 · vella_toeic", robots: { index: false } };

type Student = { no: string; name: string; app: Application };
const label = (a: Application) => `${cohortLabel(a.cohort)} ${COURSES[a.course].label} ${TRACKS[a.track]}${a.slot ? ` · ${TIME_SLOTS[a.slot]}` : ""} · ${KINDS[a.kind].short}`;

// 관리 [모의고사] (첫토익 성적 연동, 설계서 8장): 회차별 받은 수·연결·확인 필요 + 확인 필요 연결(체크해서 한 번에) + 받은 성적 전체
// 이름만으로는 자동 연결하지 않아요. 이름이 한 명과 딱 맞으면 미리 골라 두지만, [선택한 연결 저장]을 눌러야 연결돼요.
export default async function ScoresAdmin({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { e } = await searchParams;
  // 이번 모집 기수부터 개인번호가 비어 있는 학생에게 채워요 (예전에 신청한 12월 학생 포함)
  const filled = await safe("fillStudentNumbers", async () => fillStudentNumbers(await currentCohort()), 0);
  const [results, apps] = await Promise.all([safe("scores.list", () => listExamResults(), [] as ExamResultRow[]), listApplications()]);

  // 개인번호별 학생 (가장 최근 신청으로 표시)
  const byNo = new Map<string, Student>();
  for (const a of apps.filter((x) => x.student_no && isActive(x)).sort((x, y) => x.created_at.localeCompare(y.created_at))) byNo.set(a.student_no!, { no: a.student_no!, name: a.name, app: a });
  const students = [...byNo.values()];
  const candidatesOf = (name: string) => students.filter((s) => sameName(s.name, name));

  const exams = [...new Map(results.map((r) => [r.exam_id, r])).values()].map((x) => {
    const rs = results.filter((r) => r.exam_id === x.exam_id);
    return { id: x.exam_id, title: x.exam_title, date: x.exam_date, total: rs.length, linked: rs.filter((r) => r.match_status !== "review").length, review: rs.filter((r) => r.match_status === "review").length };
  });
  const reviewAll = results.filter((r) => r.match_status === "review");
  const review = e ? reviewAll.filter((r) => r.exam_id === e) : reviewAll;
  const shown = e ? results.filter((r) => r.exam_id === e) : results;

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="scores" />

      <div>
        <h2 className="flex items-center gap-2 font-jua text-3xl text-sky-ink"><Icon name="trophy" size={34} />모의고사 성적 (첫토익)</h2>
        <p className="mt-1 text-sm text-slate-600">첫토익 채점 시스템이 보낸 성적이에요. 학생 답안지의 &apos;수험번호&apos;(개인번호)와 이름이 맞으면 자동 연결되고, 아니면 아래 &apos;확인 필요&apos;에서 연결해요.</p>
        <p className="mt-1 text-xs text-slate-500">개인번호가 있는 학생 {students.length}명{filled > 0 && ` · 방금 ${filled}명에게 새로 줬어요`} · 학생은 강의실 &apos;모의고사 성적&apos;에서 자기 번호와 성적을 봐요.</p>
      </div>

      {exams.length === 0 ? (
        <p className="card text-center text-slate-500">아직 받은 성적이 없어요. 첫토익에서 &apos;벨라 홈페이지로 보내기&apos;를 누르면 여기에 들어와요.</p>
      ) : (
        <section className="card !p-4">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 text-sm">
            <span className="font-bold text-slate-500">회차</span><span className="font-bold text-slate-500">받음</span><span className="font-bold text-slate-500">연결</span><span className="font-bold text-slate-500">확인 필요</span>
            {exams.map((x) => (
              <a key={x.id} href={e === x.id ? "/admin/scores" : `/admin/scores?e=${x.id}`} className={`col-span-4 grid grid-cols-subgrid items-center rounded-xl px-2 py-2 ${e === x.id ? "bg-sky-soft" : "hover:bg-sky-soft/60"}`}>
                <span><b className="text-sky-ink">{x.title}</b> <span className="text-slate-500">· {specialDay(x.date)}</span></span>
                <span className="tabular-nums">{x.total}</span>
                <span className="tabular-nums text-emerald-700">{x.linked}</span>
                <span className={`tabular-nums font-bold ${x.review > 0 ? "text-amber-600" : "text-slate-400"}`}>{x.review}</span>
              </a>
            ))}
          </div>
          {e && <a href="/admin/scores" className="mt-2 inline-block text-sm text-sky-deep underline">모든 회차 보기</a>}
        </section>
      )}

      {review.length > 0 && (
        <form action={linkExamResults} className="card space-y-3 !border-2 !border-amber-200 !p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-jua text-xl text-amber-700"><Icon name="alert" size={24} />확인 필요 {review.length}명</p>
            <button className="btn !py-2 !text-sm">선택한 연결 저장</button>
          </div>
          <p className="text-xs text-slate-500">이름이 한 명과 딱 맞으면 미리 골라 뒀어요(초록). 동명이인은 직접 골라 주세요. 맞는 학생이 없으면 개인번호를 적거나, 잘못 들어온 성적은 삭제해요.</p>
          <ul className="divide-y divide-amber-100">
            {review.map((r) => {
              const cands = candidatesOf(r.name);
              return (
                <li key={r.result_id} className="grid gap-2 py-3 lg:grid-cols-[14rem_1fr_auto] lg:items-center">
                  <div>
                    <b className="text-lg text-sky-ink">{r.name}</b> <span className="text-sm text-slate-500">{r.blank_sheet ? "백지" : `${r.total}점`}</span>
                    <p className="text-xs text-slate-500">{r.exam_title} · 답안지 번호 {r.student_no ?? "없음"}{r.birth ? ` · 생년월일 ${r.birth}` : ""}</p>
                    <p className="text-xs font-bold text-amber-700">{r.match_note}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {cands.map((c) => (
                      <label key={c.no} className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50 ${cands.length > 1 ? "border-amber-200" : "border-sky-main/50"}`}>
                        <input type="radio" name={`pick:${r.result_id}`} value={c.no} defaultChecked={cands.length === 1} className="accent-emerald-600" />
                        <span><b>{c.name}</b> <span className="tabular-nums text-slate-500">{c.no}</span><span className="block text-xs text-slate-500">{label(c.app)}</span></span>
                      </label>
                    ))}
                    {cands.length > 1 && <span className="text-xs font-bold text-amber-700">동명이인 {cands.length}명 · 직접 골라 주세요</span>}
                    {cands.length === 0 && <span className="text-xs text-slate-500">같은 이름 학생이 없어요</span>}
                    <input name={`typed:${r.result_id}`} inputMode="numeric" maxLength={6} placeholder="개인번호 직접" className="input !w-36 !py-1.5 text-sm" />
                  </div>
                  <button formAction={removeExamResults} name="del" value={r.result_id} className="justify-self-start text-xs text-slate-400 underline hover:text-red-500">삭제</button>
                </li>
              );
            })}
          </ul>
          <button className="btn w-full !py-2.5">선택한 연결 저장</button>
        </form>
      )}

      {shown.length > 0 && (
        <details className="card !p-4">
          <summary className="cursor-pointer font-jua text-lg text-sky-ink">받은 성적 {shown.length}개 {e ? "(이 회차)" : "(전체)"}</summary>
          <form action={unlinkExamResult} className="mt-3">
            <ul className="divide-y divide-sky-soft text-sm">
              {shown.map((r) => {
                const s = r.linked_no ? byNo.get(r.linked_no) : null;
                return (
                  <li key={r.result_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <b className="w-20 text-sky-ink">{r.name}</b>
                    <span className="w-16 tabular-nums text-slate-600">{r.blank_sheet ? "백지" : `${r.total}점`}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500">{r.exam_title} · {specialDay(r.exam_date)}</span>
                    {r.match_status === "review" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">확인 필요</span>
                    ) : (
                      <>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.match_status === "manual" ? "bg-sky-soft text-sky-ink" : "bg-emerald-100 text-emerald-700"}`}>{r.match_status === "manual" ? "선생님 연결" : "자동 연결"} · {r.linked_no}{s && s.name !== r.name ? ` (${s.name})` : ""}</span>
                        <button name="unlink" value={r.result_id} className="text-xs text-slate-400 underline hover:text-amber-600">연결 풀기</button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </form>
        </details>
      )}

      <section className="card space-y-2 !p-4 text-sm text-slate-600">
        <p className="font-bold text-sky-ink">첫토익 쪽에 알려 줄 것</p>
        <p>받는 주소: <code className="rounded bg-sky-soft px-1.5 py-0.5">https://vellatoeic.vercel.app/api/firsttoeic</code> (POST · 헤더 x-firsttoeic-key)</p>
        <p>비밀 키는 Vercel 환경변수 <code className="rounded bg-sky-soft px-1.5 py-0.5">FIRSTTOEIC_SYNC_KEY</code>에 첫토익 쪽과 같은 값으로 넣어요(이 화면에는 보이지 않아요). 생년월일은 받지 않아서, 답안지에 개인번호가 없으면 여기서 연결해요.</p>
      </section>
    </div>
  );
}
