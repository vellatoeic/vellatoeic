import { COURSES, KINDS, TRACKS, TIME_SLOTS, cohortLabel } from "@/lib/config";
import { currentCohort, isPreview, listApplications, listExamResults, listExams, type Application, type ExamInfoRow, type ExamResultRow } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { isActive } from "@/lib/access";
import { PART_NAMES, REVIEW_REASONS, examStats, reviewReason, sameName, type ReviewReason } from "@/lib/mockScores";
import { fillStudentNumbers } from "@/lib/studentNumbers";
import { specialDay } from "@/lib/special";
import { safe } from "@/lib/safe";
import { linkExamResults, rejudgeExamReview, removeExamResults, setExamPublish, unlinkExamResult } from "@/app/actions";
import Icon from "@/components/Icon";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "모의고사 · vella_toeic", robots: { index: false } };

type Student = { no: string; name: string; app: Application };
const label = (a: Application) => `${cohortLabel(a.cohort)} ${COURSES[a.course].label} ${TRACKS[a.track]}${a.slot ? ` · ${TIME_SLOTS[a.slot]}` : ""} · ${KINDS[a.kind].short}`;
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

// 관리 [모의고사] (첫토익 성적 연동 · 결과화면 가이드 3장)
// ① 회차별 현황(받음 · 연결 · 확인 필요 · 마지막 받은 시각 · 공개 스위치) ② 고른 회차 통계 ③ 확인 필요(사유 칩 · 이름 검색 · 다시 판정 · 학생 골라 연결) ④ 받은 성적 전체
// 이름만으로는 자동 연결하지 않아요. 이름이 한 명과 딱 맞으면 미리 골라 두지만 [선택한 연결 저장]을 눌러야 연결돼요.
export default async function ScoresAdmin({ searchParams }: { searchParams: Promise<{ e?: string; r?: string; q?: string; rejudged?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { e, r: reasonParam, q = "", rejudged } = await searchParams;
  const filled = await safe("fillStudentNumbers", async () => fillStudentNumbers(await currentCohort()), 0);
  const [results, apps, examRows] = await Promise.all([
    safe("scores.list", () => listExamResults(), [] as ExamResultRow[]),
    listApplications(),
    safe("scores.exams", () => listExams(), [] as ExamInfoRow[]),
  ]);

  // 개인번호별 학생 (가장 최근 신청으로 표시)
  const byNo = new Map<string, Student>();
  for (const a of apps.filter((x) => x.student_no && isActive(x)).sort((x, y) => x.created_at.localeCompare(y.created_at))) byNo.set(a.student_no!, { no: a.student_no!, name: a.name, app: a });
  const students = [...byNo.values()];
  const candidatesOf = (name: string) => students.filter((s) => sameName(s.name, name));

  // 회차 (받은 성적 기준, 공개 여부는 회차 표)
  const info = new Map(examRows.map((x) => [x.exam_id, x]));
  const exams = [...new Map(results.map((x) => [x.exam_id, x])).values()].map((x) => {
    const rs = results.filter((r) => r.exam_id === x.exam_id);
    const last = rs.map((r) => r.updated_at ?? r.received_at ?? "").sort().at(-1);
    return { id: x.exam_id, title: x.exam_title, date: x.exam_date, session: x.session, total: rs.length, linked: rs.filter((r) => r.match_status !== "review").length, review: rs.filter((r) => r.match_status === "review").length, last, published: info.get(x.exam_id)?.published ?? false };
  });
  const focus = exams.find((x) => x.id === e) ?? exams[0] ?? null;
  const stats = focus ? examStats(results.filter((r) => r.exam_id === focus.id)) : null;

  const scope = e ? results.filter((r) => r.exam_id === e) : results;
  const reviewAll = scope.filter((r) => r.match_status === "review");
  const reasonOk = (x: string | undefined): x is ReviewReason => REVIEW_REASONS.some((rr) => rr.id === x);
  const reason = reasonOk(reasonParam) ? reasonParam : null;
  const term = q.replace(/\s+/g, "");
  const review = reviewAll.filter((x) => (!reason || reviewReason(x.match_note) === reason) && (!term || x.name.replace(/\s+/g, "").includes(term)));
  const link = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ e: e ?? null, r: reason, q: q || null, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/scores${s ? `?${s}` : ""}`;
  };
  const maxBucket = stats ? Math.max(1, ...stats.buckets.map(([, n]) => n)) : 1;

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="scores" />

      <div>
        <h2 className="flex items-center gap-2 font-jua text-3xl text-sky-ink"><Icon name="trophy" size={34} />모의고사 성적 (첫토익)</h2>
        <p className="mt-1 text-sm text-slate-600">첫토익 채점 시스템이 보낸 성적이에요. 답안지의 &apos;수험번호&apos;(개인번호)와 이름이 맞으면 자동 연결되고, 아니면 &apos;확인 필요&apos;에서 연결해요. 회차마다 <b>[공개]</b>를 눌러야 학생에게 점수가 보여요.</p>
        <p className="mt-1 text-xs text-slate-500">개인번호가 있는 학생 {students.length}명{filled > 0 && ` · 방금 ${filled}명에게 새로 줬어요`} · 학생은 메뉴 &apos;모의고사 결과&apos;에서 봐요.</p>
      </div>
      {rejudged !== undefined && <p className="card !bg-emerald-50 text-center font-bold text-emerald-700">다시 판정했어요 · 새로 자동 연결 {rejudged}명</p>}

      {exams.length === 0 ? (
        <p className="card text-center text-slate-500">아직 받은 성적이 없어요. 첫토익에서 &apos;벨라 홈페이지로 보내기&apos;를 누르면 여기에 들어와요.</p>
      ) : (
        <section className="card !p-4">
          <p className="mb-2 font-jua text-lg text-sky-ink">회차별 현황</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="text-left text-slate-500"><th className="py-1.5 font-bold">회차</th><th className="font-bold">받음</th><th className="font-bold">연결</th><th className="font-bold">확인 필요</th><th className="font-bold">마지막 받음</th><th className="font-bold">학생 공개</th></tr></thead>
              <tbody>
                {exams.map((x) => (
                  <tr key={x.id} className={`border-t border-sky-soft ${e === x.id ? "bg-sky-soft/60" : ""}`}>
                    <td className="py-2 pr-2"><a href={e === x.id ? "/admin/scores" : `/admin/scores?e=${x.id}`} className="font-bold text-sky-ink underline decoration-sky-main underline-offset-2">{x.title}</a> <span className="text-slate-500">· {specialDay(x.date)}</span></td>
                    <td className="tabular-nums">{x.total}</td>
                    <td className="tabular-nums text-emerald-700">{x.linked}</td>
                    <td className={`tabular-nums font-bold ${x.review > 0 ? "text-amber-600" : "text-slate-400"}`}>{x.review}</td>
                    <td className="whitespace-nowrap text-slate-500">{when(x.last)}</td>
                    <td>
                      <form action={setExamPublish} className="flex items-center gap-2">
                        <input type="hidden" name="exam_id" value={x.id} />
                        <input type="hidden" name="on" value={x.published ? "0" : "1"} />
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${x.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{x.published ? "공개 중" : "비공개"}</span>
                        <button className={x.published ? "text-xs text-slate-400 underline" : "btn !px-3 !py-1 !text-xs"}>{x.published ? "비공개로" : "공개"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {e && <a href="/admin/scores" className="mt-2 inline-block text-sm text-sky-deep underline">모든 회차 보기</a>}
        </section>
      )}

      {focus && stats && stats.count > 0 && (
        <section className="card space-y-4 !p-4">
          <p className="font-jua text-lg text-sky-ink">{focus.title} 통계 <span className="font-body text-sm font-normal text-slate-500">· 채점 {stats.count}명{stats.blank > 0 ? ` · 백지 ${stats.blank}명` : ""}</span></p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([["평균 총점", stats.total], ["평균 LC", stats.lc], ["평균 RC", stats.rc]] as const).map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-sky-soft p-3"><p className="text-xs text-slate-500">{k}</p><p className="font-jua text-2xl text-sky-ink tabular-nums">{v}</p></div>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-sm font-bold text-slate-600">점수 분포</p>
              {stats.buckets.map(([b, n]) => (
                <div key={b} className="flex items-center gap-2 text-sm">
                  <span className="w-20 shrink-0 tabular-nums text-slate-500">{b === 900 ? "900~990" : `${b}~${b + 95}`}</span>
                  <span className="h-3 flex-1 rounded-full bg-sky-soft"><i className="block h-full rounded-full bg-sky-deep" style={{ width: `${Math.round((n / maxBucket) * 100)}%` }} /></span>
                  <span className="w-10 shrink-0 text-right tabular-nums">{n}명</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1.5 text-sm font-bold text-slate-600">파트별 평균 정답률</p>
              {stats.partAvg.map((p) => (
                <div key={p.part} className="flex items-center gap-2 text-sm">
                  <span className="w-32 shrink-0 truncate text-slate-600">Part {p.part} {PART_NAMES[p.part]}</span>
                  <span className="h-3 flex-1 rounded-full bg-sky-soft"><i className="block h-full rounded-full bg-sky-deep" style={{ width: `${p.pct}%` }} /></span>
                  <span className="w-10 shrink-0 text-right tabular-nums">{p.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {reviewAll.length > 0 && (
        <section className="card space-y-3 !border-2 !border-amber-200 !p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-jua text-xl text-amber-700"><Icon name="alert" size={24} />확인 필요 {reviewAll.length}명{e ? " (이 회차)" : ""}</p>
            <form action={rejudgeExamReview}>
              {e && <input type="hidden" name="exam_id" value={e} />}
              <button className="btn-ghost !py-1.5 !text-sm" title="학생이 나중에 개인번호를 받았을 때">다시 판정</button>
            </form>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <a href={link({ r: null })} className={`rounded-full px-3 py-1 text-sm font-bold ${!reason ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700"}`}>전체 {reviewAll.length}</a>
            {REVIEW_REASONS.map((rr) => {
              const n = reviewAll.filter((x) => reviewReason(x.match_note) === rr.id).length;
              if (n === 0) return null;
              return <a key={rr.id} href={link({ r: rr.id })} title={rr.hint} className={`rounded-full px-3 py-1 text-sm font-bold ${reason === rr.id ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700"}`}>{rr.label} {n}</a>;
            })}
            <form className="ml-auto flex items-center gap-1.5">
              {e && <input type="hidden" name="e" value={e} />}
              {reason && <input type="hidden" name="r" value={reason} />}
              <input name="q" defaultValue={q} placeholder="이름으로 찾기" className="input !w-36 !py-1.5 text-sm" />
              <button className="btn-ghost !py-1.5 !text-sm">찾기</button>
            </form>
          </div>
          <p className="text-xs text-slate-500">이름이 한 명과 딱 맞으면 미리 골라 뒀어요(초록). &apos;번호·이름 다름&apos;은 번호 쪽 학생과 이름 쪽 학생을 나란히 보여줘요 — 이름 쪽 학생인지 확인해 주세요. 동명이인은 개인번호·반으로 골라요.</p>

          {review.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-center text-sm text-slate-500">조건에 맞는 학생이 없어요.</p> : (
            <form action={linkExamResults} className="space-y-3">
              <ul className="divide-y divide-amber-100">
                {review.map((x) => {
                  const cands = candidatesOf(x.name);
                  const numberSide = x.student_no ? byNo.get(x.student_no) : undefined;
                  const mismatch = reviewReason(x.match_note) === "mismatch";
                  return (
                    <li key={x.result_id} className="grid gap-2 py-3 lg:grid-cols-[14rem_1fr_auto] lg:items-center">
                      <div>
                        <b className="text-lg text-sky-ink">{x.name}</b> <span className="text-sm text-slate-500">{x.blank_sheet ? "백지" : `${x.total}점`}</span>
                        <p className="text-xs text-slate-500">{x.exam_title} · 답안지 번호 {x.student_no ?? "없음"}{x.birth ? ` · 생년월일 ${x.birth}` : ""}</p>
                        <p className="text-xs font-bold text-amber-700">{x.match_note}</p>
                      </div>
                      <div className="space-y-1.5">
                        {mismatch && numberSide && (
                          <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-amber-300 px-3 py-1.5 text-sm has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50">
                            <input type="radio" name={`pick:${x.result_id}`} value={numberSide.no} className="accent-emerald-600" />
                            <span><span className="text-xs font-bold text-amber-700">번호 쪽 </span><b>{numberSide.name}</b> <span className="tabular-nums text-slate-500">{numberSide.no}</span><span className="block text-xs text-slate-500">{label(numberSide.app)}</span></span>
                          </label>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {cands.map((c) => (
                            <label key={c.no} className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50 ${cands.length > 1 ? "border-amber-200" : "border-sky-main/50"}`}>
                              <input type="radio" name={`pick:${x.result_id}`} value={c.no} defaultChecked={cands.length === 1} className="accent-emerald-600" />
                              <span>{mismatch && <span className="text-xs font-bold text-sky-deep">이름 쪽 </span>}<b>{c.name}</b> <span className="tabular-nums text-slate-500">{c.no}</span><span className="block text-xs text-slate-500">{label(c.app)}</span></span>
                            </label>
                          ))}
                          {cands.length > 1 && <span className="text-xs font-bold text-amber-700">동명이인 {cands.length}명 · 직접 골라 주세요</span>}
                          {cands.length === 0 && <span className="text-xs text-slate-500">같은 이름 학생이 없어요{x.match_note === "일치하는 학생 없음" ? " (가입 안내 또는 이름 확인)" : ""}</span>}
                          <input name={`typed:${x.result_id}`} inputMode="numeric" maxLength={6} placeholder="개인번호 직접" className="input !w-36 !py-1.5 text-sm" />
                        </div>
                      </div>
                      <button formAction={removeExamResults} name="del" value={x.result_id} className="justify-self-start text-xs text-slate-400 underline hover:text-red-500">삭제</button>
                    </li>
                  );
                })}
              </ul>
              <button className="btn w-full !py-2.5">선택한 연결 저장</button>
            </form>
          )}
        </section>
      )}

      {scope.length > 0 && (
        <details className="card !p-4">
          <summary className="cursor-pointer font-jua text-lg text-sky-ink">받은 성적 {scope.length}개 {e ? "(이 회차)" : "(전체)"}</summary>
          <form action={unlinkExamResult} className="mt-3">
            <ul className="divide-y divide-sky-soft text-sm">
              {scope.map((x) => {
                const s = x.linked_no ? byNo.get(x.linked_no) : null;
                return (
                  <li key={x.result_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <b className="w-20 text-sky-ink">{x.name}</b>
                    <span className="w-16 tabular-nums text-slate-600">{x.blank_sheet ? "백지" : `${x.total}점`}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500">{x.exam_title} · {specialDay(x.exam_date)}</span>
                    {x.match_status === "review" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">확인 필요</span>
                    ) : (
                      <>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${x.match_status === "manual" ? "bg-sky-soft text-sky-ink" : "bg-emerald-100 text-emerald-700"}`}>{x.match_status === "manual" ? "선생님 연결" : "자동 연결"} · {x.linked_no}{s && s.name !== x.name ? ` (${s.name})` : ""}</span>
                        <button name="unlink" value={x.result_id} className="text-xs text-slate-400 underline hover:text-amber-600">연결 풀기</button>
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
        <p>한 번 보낼 때마다 그 회차의 지금 명단 전체를 받아요. 첫토익에서 지우거나 다시 스캔한 결과는 여기서도 사라져요(선생님 연결은 이름이 한 명이면 새 결과로 이어받아요).</p>
      </section>
    </div>
  );
}
