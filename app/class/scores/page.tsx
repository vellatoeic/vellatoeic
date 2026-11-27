import Link from "next/link";
import Icon from "@/components/Icon";
import { activeStudentApps } from "@/lib/student";
import { examResultsByNos, publishedExamIds, type ExamResultRow } from "@/lib/db";
import { isViewOnly } from "@/lib/auth";
import { ensureStudentNo } from "@/lib/studentNumbers";
import { PART_NAMES, byExamDesc, isStudentNo, numberForGroup, pct, scoreDeltas, wrongByPart } from "@/lib/mockScores";
import { specialDay } from "@/lib/special";
import { safe } from "@/lib/safe";
import LoginCard from "../LoginCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 모의고사 성적 · vella_toeic", robots: { index: false } };

// 학생 '내 모의고사 성적' (첫토익 채점 결과, 결과화면 가이드 2장 · 휴대폰 360px 먼저)
// 목록: 회차 카드(시험일 · 회차 · 총점 크게 · LC/RC · 지난 회차 대비) + 회차 2개 이상이면 총점 추이
// 상세: ① 점수 ② 파트별 정답률(이름 · 맞힌 수/문항 수 · %) ③ 틀린 문항(파트별 개수 → 눌러서 펼침) ④ 총평 · 파트별 코멘트 ⑤ 분석지(있을 때만)
// 관리자가 [공개]하기 전 회차는 점수 대신 '채점 결과를 정리하고 있어요'. 본인에게 연결된 결과만 보여요.
export default async function ScoresPage() {
  const { loggedIn, apps } = await activeStudentApps();
  if (!loggedIn) return <LoginCard next="/class/scores" />;
  if (apps.length === 0) return <div className="pt-12"><p className="card text-center text-slate-500">수강 정보가 없어요. Vella쌤에게 문의해 주세요.</p></div>;
  const viewOnly = await isViewOnly();
  const no = viewOnly ? numberForGroup(apps) : await safe("scores.studentNo", () => ensureStudentNo(apps), numberForGroup(apps));
  const nos = [...new Set([no, ...apps.map((a) => a.student_no)].filter(isStudentNo))];
  const results = (await safe("scores.list", () => examResultsByNos(nos), [] as ExamResultRow[])).sort(byExamDesc);
  const published = await safe("scores.published", () => publishedExamIds(results.map((r) => r.exam_id)), new Set<string>());
  const open = results.filter((r) => published.has(r.exam_id));
  const deltas = scoreDeltas(open);
  const trend = open.filter((r) => !r.blank_sheet).slice().reverse();

  return (
    <div className="stagger wide space-y-5 pt-8">
      <Link href="/class" className="text-sm text-sky-deep underline">← 강의실로</Link>
      <h1 className="flex items-center gap-2 font-jua text-3xl text-sky-ink"><Icon name="trophy" size={36} />내 모의고사 성적</h1>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-br from-[#4fb3e8] via-sky-deep to-[#1f78ad] p-5 text-white shadow-[0_10px_26px_rgba(43,143,199,0.3)]">
        <div>
          <p className="text-sm opacity-85">내 개인번호</p>
          <p className="font-jua text-4xl tracking-[0.2em] tabular-nums sm:text-5xl">{no ?? "준비 중"}</p>
        </div>
        <p className="max-w-sm text-sm leading-relaxed opacity-95">모의고사 답안지 앞면 <b>&apos;수험번호&apos; 칸</b>에 이 번호 6자리를 적어요. 다음 달에도 같은 번호예요.</p>
      </section>

      {results.length === 0 ? (
        <p className="card text-center text-slate-500">아직 받은 모의고사 결과가 없어요.<br /><span className="text-sm">답안지에 개인번호 <b className="text-sky-ink">{no ?? ""}</b>를 적었는지 확인해 주세요.</span></p>
      ) : (
        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6 lg:space-y-0">
          <div className="space-y-3">
            {results.map((r, i) =>
              published.has(r.exam_id) ? <ResultCard key={r.result_id} r={r} open={i === 0} delta={deltas.get(r.result_id)} /> : <Pending key={r.result_id} r={r} />,
            )}
          </div>
          {trend.length >= 2 && <Trend points={trend.map((r) => ({ label: specialDay(r.exam_date), total: r.total }))} />}
        </div>
      )}
    </div>
  );
}

function Pending({ r }: { r: ExamResultRow }) {
  return (
    <div className="card flex flex-wrap items-center gap-3 !py-4">
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-500">{specialDay(r.exam_date)}</span>
        <b className="block font-jua text-lg text-sky-ink">{r.exam_title}</b>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-soft px-3 py-1 text-sm font-bold text-sky-ink"><Icon name="hourglass" size={16} />채점 결과를 정리하고 있어요</span>
    </div>
  );
}

function Delta({ d }: { d?: number }) {
  if (d === undefined) return null;
  const up = d > 0, same = d === 0;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${same ? "bg-slate-100 text-slate-500" : up ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-600"}`}>{same ? "지난번과 같음" : `${up ? "+" : "−"}${Math.abs(d)}`}</span>;
}

function ResultCard({ r, open, delta }: { r: ExamResultRow; open: boolean; delta?: number }) {
  const parts = [...r.parts].sort((a, b) => a.part - b.part);
  const groups = wrongByPart(r.wrong);
  const comments = r.part_comments.filter((c) => c.comment.trim()).sort((a, b) => a.part - b.part);
  return (
    <details open={open} className="group card !p-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-500">{specialDay(r.exam_date)}</span>
          <b className="block truncate font-jua text-lg text-sky-ink">{r.exam_title}</b>
          {!r.blank_sheet && <span className="mt-0.5 block text-xs text-slate-500 tabular-nums">LC {r.lc_score} · RC {r.rc_score}</span>}
        </span>
        <span className="shrink-0 text-right">
          {r.blank_sheet ? <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-500">채점 못 함</span> : (
            <>
              <span className="block font-jua text-3xl text-sky-deep tabular-nums">{r.total}</span>
              <Delta d={delta} />
            </>
          )}
        </span>
        <Icon name="chevronRight" size={16} className="shrink-0 text-slate-400 transition group-open:rotate-90" />
      </summary>

      <div className="space-y-5 border-t border-sky-soft px-4 py-5 sm:px-5">
        {r.blank_sheet ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-center text-slate-600">답안지가 비어 있어 채점하지 못했어요.</p>
        ) : (
          <>
            {/* ① 점수 */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-sky-deep p-3 text-white"><p className="text-xs opacity-80">총점</p><p className="font-jua text-3xl tabular-nums">{r.total}</p></div>
              <div className="rounded-2xl bg-sky-soft p-3"><p className="text-xs text-slate-500">LC</p><p className="font-jua text-2xl text-sky-ink tabular-nums">{r.lc_score}</p><p className="text-[11px] text-slate-500 tabular-nums">{r.lc_correct}/100</p></div>
              <div className="rounded-2xl bg-sky-soft p-3"><p className="text-xs text-slate-500">RC</p><p className="font-jua text-2xl text-sky-ink tabular-nums">{r.rc_score}</p><p className="text-[11px] text-slate-500 tabular-nums">{r.rc_correct}/100</p></div>
            </div>

            {/* ② 파트별 정답률 (숫자를 함께, 색만으로 구분하지 않아요) */}
            <div className="space-y-2.5">
              <p className="font-bold text-sky-ink">파트별 정답률</p>
              {parts.map((p) => {
                const v = pct(p.correct, p.total);
                return (
                  <div key={p.part}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate"><b className="text-sky-ink">Part {p.part}</b> <span className="text-slate-500">{PART_NAMES[p.part]}</span></span>
                      <span className="shrink-0 tabular-nums text-slate-600">{p.correct}/{p.total} · <b>{v}%</b></span>
                    </div>
                    <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-sky-soft"><i className="block h-full rounded-full bg-sky-deep" style={{ width: `${v}%` }} /></span>
                  </div>
                );
              })}
            </div>

            {/* ③ 틀린 문항: 파트별 개수 → 눌러서 펼침 */}
            <div className="space-y-2">
              <p className="font-bold text-sky-ink">틀린 문항 <span className="font-normal text-slate-500">{r.wrong.length}개</span></p>
              {groups.length === 0 ? (
                <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">틀린 문항이 없어요!</p>
              ) : groups.map((g) => (
                <details key={g.part} className="group/w rounded-2xl bg-sky-soft/60">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm">
                    <span><b className="text-sky-ink">Part {g.part}</b> <span className="text-slate-500">{PART_NAMES[g.part]}</span> — <b className="text-sky-deep">{g.items.length}개</b></span>
                    <Icon name="chevronRight" size={14} className="text-slate-400 transition group-open/w:rotate-90" />
                  </summary>
                  <ul className="grid grid-cols-1 gap-1 px-3 pb-3 min-[380px]:grid-cols-2">
                    {g.items.map((w) => (
                      <li key={w.q} className="flex items-center justify-between rounded-xl bg-white px-3 py-1.5 text-sm tabular-nums">
                        <b className="text-sky-ink">{w.q}번</b>
                        <span className="text-slate-600">정답 <b className="text-emerald-600">{w.answer}</b> · 내 답 {w.chosen ? <b className="text-red-500">{w.chosen}</b> : <b className="text-slate-400">무응답</b>}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>

            {/* ④ 총평 · 파트별 코멘트 (없으면 숨김) */}
            {r.comment && (
              <div className="rounded-2xl bg-[#fffbea] p-4">
                <p className="font-bold text-[#7d6728]">총평</p>
                <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{r.comment}</p>
              </div>
            )}
            {comments.length > 0 && (
              <details className="group/c rounded-2xl ring-1 ring-sky-main/50">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-bold text-sky-ink">파트별 코멘트 {comments.length}개<Icon name="chevronRight" size={14} className="text-slate-400 transition group-open/c:rotate-90" /></summary>
                <div className="space-y-2 px-4 pb-4">
                  {comments.map((c) => <p key={c.part} className="text-sm leading-relaxed text-slate-700"><b className="mr-1 text-sky-deep">Part {c.part} {PART_NAMES[c.part]}</b>{c.comment}</p>)}
                </div>
              </details>
            )}

            {/* ⑤ 분석지 (링크가 올 때만, 7일짜리) */}
            {r.report_pdf_url && (
              <div>
                <a href={r.report_pdf_url} target="_blank" rel="noreferrer" className="btn flex w-full items-center justify-center gap-2"><Icon name="doc" size={22} />분석지 받기 ↗</a>
                <p className="mt-1 text-center text-xs text-slate-500">분석지 링크는 받은 날부터 7일 동안 열려요. 열리지 않으면 Vella쌤에게 알려 주세요.</p>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}

// 총점 추이 (오래된 회차 → 최근, 0~990)
function Trend({ points }: { points: { label: string; total: number }[] }) {
  const W = 320, H = 150, L = 30, R = 12, T = 16, B = 26, PAD = 22; // PAD: 처음·마지막 점이 축 글자·가장자리에 붙지 않게
  const iw = W - L - R - PAD * 2, ih = H - T - B;
  const lo = Math.max(0, Math.floor((Math.min(...points.map((p) => p.total)) - 50) / 100) * 100);
  const hi = Math.min(990, Math.ceil((Math.max(...points.map((p) => p.total)) + 50) / 100) * 100);
  const x = (i: number) => L + PAD + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => T + ih - ((v - lo) / Math.max(1, hi - lo)) * ih;
  const anchor = (i: number) => (points.length > 1 && i === 0 ? "start" : points.length > 1 && i === points.length - 1 ? "end" : "middle");
  const ax = (i: number) => (anchor(i) === "start" ? x(i) - 10 : anchor(i) === "end" ? x(i) + 10 : x(i));
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ");
  return (
    <figure className="card !p-4">
      <figcaption className="font-bold text-sky-ink">총점 추이</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="모의고사 총점 추이">
        {[lo, Math.round((lo + hi) / 2), hi].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#e2eef6" strokeWidth={1} />
            <text x={L - 5} y={y(g) + 4} textAnchor="end" fontSize={10} fill="#7aa3bd">{g}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#2b8fc7" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.total)} r={4.5} fill="#2b8fc7" stroke="#fff" strokeWidth={2} />
            <text x={x(i)} y={y(p.total) - 9} textAnchor="middle" fontSize={10} fontWeight={700} fill="#12405c">{p.total}</text>
            <text x={ax(i)} y={H - 8} textAnchor={anchor(i)} fontSize={9} fill="#7aa3bd">{p.label}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
