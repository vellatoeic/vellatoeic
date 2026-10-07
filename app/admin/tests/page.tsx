import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { isPreview, type TestResult } from "@/lib/db";
import { TIME_SLOTS, cohortLabel, todayKST } from "@/lib/config";
import { SCHEDULE_CLASSES, type ScheduleClass } from "@/lib/schedule";
import { cohortTestStats, planFor, type StudentTestStat } from "@/lib/dailyTests";
import { dayNumber, testPlan, TEST_LABEL, type TestSpec } from "@/lib/tests";
import { specialDay } from "@/lib/special";
import { saveTestOverrideAction } from "@/app/actions";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import CloseOnSubmitForm from "../CloseOnSubmitForm";
import AutoRefresh from "./AutoRefresh";
import Bars from "./Bars";

export const dynamic = "force-dynamic";
export const metadata = { title: "오늘의 테스트 · vella_toeic", robots: { index: false } };

const GROUPS: [string, string][] = [["all", "전체"], ["solve-all", "문풀 종합"], ["solve-mw", "문풀 격일 월수"], ["solve-tt", "문풀 격일 화목"], ["intensive-all", "속성반"]];
const SLOTS: [string, string][] = [["all", "전체"], ["am", "☀️ 오전반"], ["pm", "🌙 저녁반"]];

// 점수 분포: 문항 수를 5칸으로 나눠요 (예: 30문항 → 0~5, 6~11, …)
function distribution(results: TestResult[], questions: number) {
  const size = Math.ceil((questions + 1) / 5);
  return Array.from({ length: 5 }, (_, i) => {
    const lo = i * size, hi = Math.min(questions, lo + size - 1);
    return { label: lo === hi ? `${lo}` : `${lo}~${hi}`, value: results.filter((r) => r.score >= lo && r.score <= hi).length };
  }).reverse();
}

function wrongRank(results: TestResult[], top = 10) {
  const count = new Map<number, number>();
  for (const r of results) for (const w of r.wrong) count.set(w, (count.get(w) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, top).map(([n, c]) => ({ label: `${n}번`, value: c }));
}

export default async function TestsAdmin({ searchParams }: { searchParams: Promise<{ d?: string; g?: string; t?: string; tv?: string; view?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const today = todayKST();
  const sp = await searchParams;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : today;
  const g = GROUPS.some(([k]) => k === sp.g) ? sp.g! : "all";
  const t = SLOTS.some(([k]) => k === sp.t) ? sp.t! : "all";
  const tv = sp.tv === "1";
  const cohort = d.slice(0, 7);
  const link = (patch: Record<string, string>) => `/admin/tests?${new URLSearchParams({ d, g, t, ...(tv ? { tv: "1" } : {}), ...patch })}`;

  const [{ stats, plan, classDays }, { solveAllDays, overrides }] = await Promise.all([cohortTestStats(cohort, today), planFor(cohort)]);
  const autoPlan = testPlan(cohort, solveAllDays);
  const inGroup = (s: StudentTestStat) => (g === "all" || s.klass === g) && (t === "all" || s.app.slot === t);
  const group = stats.filter(inGroup);

  // ── 학생별 기록 보기 ──
  if (sp.view === "students") {
    return (
      <div className="space-y-5 pt-8">
        <AdminTabs active="tests" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-jua text-2xl text-sky-ink">{cohortLabel(cohort)} 학생별 테스트 기록</h2>
          <div className="flex gap-2">
            <Link href={link({ view: "" })} className="btn-ghost !py-2 text-sm">← 오늘의 테스트</Link>
            <a href={`/admin/tests/csv?c=${cohort}`} className="btn !py-2 !text-sm">CSV 받기</a>
          </div>
        </div>
        <Filters link={link} g={g} t={t} />
        <div className="card overflow-x-auto !p-4">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b border-sky-main text-slate-500"><th className="py-2">이름</th><th>반</th><th>시간</th><th>단어 평균</th><th>RC 평균</th><th>미제출</th><th>최근 3회</th></tr></thead>
            <tbody>
              {[...group].sort((a, b) => Number(b.declining) - Number(a.declining) || b.missing - a.missing || a.app.name.localeCompare(b.app.name, "ko")).map((s) => (
                <tr key={s.app.id} className="border-b border-sky-soft">
                  <td className="py-2 font-bold text-sky-ink">{s.app.name}</td>
                  <td>{SCHEDULE_CLASSES[s.klass]}</td>
                  <td>{s.app.slot ? TIME_SLOTS[s.app.slot] : "-"}</td>
                  <td>{s.avg.word ?? "-"}{s.avg.word !== null && "%"}</td>
                  <td>{s.avg.rc ?? "-"}{s.avg.rc !== null && "%"}</td>
                  <td className={s.missing > 0 ? "font-bold text-amber-600" : ""}>{s.missing}회</td>
                  <td>{s.declining ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">📉 연속 하락</span> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {group.length === 0 && <p className="py-4 text-center text-slate-500">해당 학생이 없어요.</p>}
        </div>
      </div>
    );
  }

  // ── 그날 테스트 ──
  const specs: TestSpec[] = plan.get(d) ?? [];
  const sections = specs.map((spec) => {
    // 그날 이 테스트를 보는 학생 = 본인 반 수업일에 그 날짜가 있는 학생
    const expected = group.filter((s) => (classDays.get(s.klass) ?? []).includes(d));
    const results = expected.map((s) => ({ s, r: s.results.find((r) => r.day === d && r.kind === spec.kind) })).filter((x): x is { s: StudentTestStat; r: TestResult } => !!x.r);
    const missing = expected.filter((s) => !results.some((x) => x.s.app.id === s.app.id));
    const avg = results.length ? results.reduce((sum, x) => sum + x.r.score, 0) / results.length : 0;
    return { spec, expected, results, missing, avg };
  });

  const dayNo = dayNumber(solveAllDays, d);

  if (tv) {
    return (
      <div className="space-y-8 pt-6">
        <AutoRefresh />
        <div className="flex items-center justify-between">
          <p className="font-jua text-4xl text-sky-ink">📝 {specialDay(d)} 오늘의 테스트</p>
          <Link href={link({ tv: "" })} className="text-sm text-slate-400 underline">관리 화면으로</Link>
        </div>
        {sections.length === 0 && <p className="font-jua text-3xl text-slate-400">오늘은 테스트가 없어요</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          {sections.map(({ spec, expected, results, avg }) => (
            <section key={spec.kind} className="card space-y-5 !p-8">
              <p className="font-jua text-4xl text-sky-ink">{TEST_LABEL[spec.kind]} {spec.no}</p>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div><p className="text-xl text-slate-500">제출</p><p className="font-jua text-6xl text-sky-deep">{results.length}<span className="text-3xl text-slate-400">/{expected.length}</span></p></div>
                <div><p className="text-xl text-slate-500">평균</p><p className="font-jua text-6xl text-sky-deep">{results.length ? avg.toFixed(1) : "-"}<span className="text-3xl text-slate-400">/{spec.questions}</span></p></div>
              </div>
              {spec.kind === "rc" && (
                <div>
                  <p className="mb-3 font-jua text-2xl text-sky-ink">많이 틀린 번호</p>
                  {wrongRank(results.map((x) => x.r), 5).length ? <Bars rows={wrongRank(results.map((x) => x.r), 5)} big /> : <p className="text-xl text-slate-400">아직 없어요</p>}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-8">
      <AutoRefresh />
      <AdminTabs active="tests" />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500">5초마다 자동으로 새로고침돼요{dayNo ? ` · 문풀 종합 DAY ${dayNo}` : ""}</p>
          <h2 className="font-jua text-2xl text-sky-ink">📝 {specialDay(d)} 오늘의 테스트</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <form className="flex gap-1"><input type="date" name="d" defaultValue={d} className="input !w-auto !py-2" /><input type="hidden" name="g" value={g} /><input type="hidden" name="t" value={t} /><button className="btn-ghost !py-2 text-sm">날짜 보기</button></form>
          <Link href={link({ tv: "1" })} className="btn !py-2 !text-sm">📺 수업용 보기</Link>
          <Link href={link({ view: "students" })} className="btn-ghost !py-2 text-sm">학생별 기록</Link>
        </div>
      </div>
      <Filters link={link} g={g} t={t} />

      {sections.length === 0 && <p className="card text-center text-slate-500">이 날짜에는 테스트가 없어요. (DAY 1이거나 문풀반 종합 수업일이 아니에요)</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {sections.map(({ spec, expected, results, missing, avg }) => (
          <section key={spec.kind} className="card space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="font-jua text-2xl text-sky-ink">{TEST_LABEL[spec.kind]} {spec.no} <span className="text-base text-slate-400">· {spec.questions}문항</span></p>
              <p className="text-sm text-slate-500">제출 <b className="text-sky-ink">{results.length}</b>/{expected.length}명 · 평균 <b className="text-sky-ink">{results.length ? avg.toFixed(1) : "-"}</b>점</p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-bold text-slate-500">점수 분포</p>
              <Bars rows={distribution(results.map((x) => x.r), spec.questions)} />
            </div>
            {spec.kind === "rc" && (
              <div>
                <p className="mb-1.5 text-sm font-bold text-slate-500">많이 틀린 번호</p>
                {wrongRank(results.map((x) => x.r)).length ? <Bars rows={wrongRank(results.map((x) => x.r))} /> : <p className="text-sm text-slate-400">틀린 번호를 고른 학생이 아직 없어요.</p>}
              </div>
            )}
            <div>
              <p className="mb-1.5 text-sm font-bold text-slate-500">학생별 점수</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                {[...results].sort((a, b) => b.r.score - a.r.score).map(({ s, r }) => (
                  <li key={s.app.id} className="flex justify-between gap-2"><span>{s.app.name}</span><b className="text-sky-ink">{r.score}</b></li>
                ))}
              </ul>
              {missing.length > 0 && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-700">미제출 {missing.length}명: {missing.map((s) => s.app.name).join(", ")}</p>}
            </div>
          </section>
        ))}
      </div>

      <details className="card">
        <summary className="font-jua cursor-pointer text-lg text-sky-ink">✏️ 이 날짜 테스트 번호·문항 수 직접 고치기 (예외용)</summary>
        <div className="mt-3 space-y-3 text-sm">
          {(["word", "rc"] as const).map((kind) => {
            const auto = autoPlan.get(d)?.find((x) => x.kind === kind);
            const now = plan.get(d)?.find((x) => x.kind === kind);
            const changed = overrides.some((o) => o.day === d && o.kind === kind);
            return (
              <CloseOnSubmitForm key={kind} action={saveTestOverrideAction} className="flex flex-wrap items-end gap-2 rounded-2xl bg-sky-soft p-3">
                <input type="hidden" name="day" value={d} />
                <input type="hidden" name="kind" value={kind} />
                <p className="w-full"><b>{TEST_LABEL[kind]}</b> · 자동 계산: {auto ? `${auto.no}번 (${auto.questions}문항)` : "없음"} · 지금: {now ? `${now.no}번 (${now.questions}문항)` : "없음"} {changed && <span className="font-bold text-amber-600">· 직접 고친 값</span>}</p>
                <label>번호<input name="test_no" type="number" min={1} max={99} defaultValue={now?.no ?? auto?.no ?? ""} className="input !w-20 !py-1.5" /></label>
                <label>문항 수<input name="questions" type="number" min={1} max={100} defaultValue={now?.questions ?? auto?.questions ?? ""} className="input !w-20 !py-1.5" /></label>
                <button className="btn !py-2 !text-sm">저장</button>
                <button name="none" value="1" className="btn-ghost !py-2 text-sm">이날 이 테스트 없음</button>
                {changed && <button name="reset" value="1" className="btn-ghost !py-2 text-sm">자동 계산으로 되돌리기</button>}
              </CloseOnSubmitForm>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function Filters({ link, g, t }: { link: (p: Record<string, string>) => string; g: string; t: string }) {
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm font-bold ${on ? "bg-sky-deep text-white" : "bg-white text-sky-ink"}`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">{GROUPS.map(([k, l]) => <Link key={k} href={link({ g: k })} className={chip(g === k)}>{l}</Link>)}</div>
      <div className="flex flex-wrap gap-2">{SLOTS.map(([k, l]) => <Link key={k} href={link({ t: k })} className={chip(t === k)}>{l}</Link>)}</div>
    </div>
  );
}
