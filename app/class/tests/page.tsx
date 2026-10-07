import Link from "next/link";
import { todayKST, cohortLabel } from "@/lib/config";
import { activeStudentApps } from "@/lib/student";
import { studentTests, takesTests } from "@/lib/dailyTests";
import { listTestResults } from "@/lib/db";
import { TEST_LABEL, type TestKind } from "@/lib/tests";
import TestForm from "@/components/tests/TestForm";
import LineChart from "@/components/tests/LineChart";
import StudentLogin from "../StudentLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "테스트 기록 · vella_toeic", robots: { index: false } };

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;

export default async function TestsPage() {
  const { loggedIn, apps } = await activeStudentApps();
  if (!loggedIn) return <StudentLogin next="/class" />;
  const today = todayKST();
  const testApps = apps.filter(takesTests).sort((a, b) => b.cohort.localeCompare(a.cohort));
  if (testApps.length === 0) {
    return <div className="pt-12"><p className="card text-center text-slate-500">문풀반·속성반 수강생만 데일리 테스트가 있어요.</p></div>;
  }
  const current = testApps[0];
  const { missed } = await studentTests(current, today);
  // 기록은 지난달 것까지 모두 보여줘요.
  const all = await listTestResults({ appIds: testApps.map((a) => a.id) });
  const series = (kind: TestKind) => all
    .filter((r) => r.kind === kind)
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => ({ label: String(r.test_no), pct: Math.round((r.score / r.questions) * 100), late: r.late, r }));

  return (
    <div className="space-y-5 pt-8">
      <Link href="/class" className="text-sm text-sky-deep underline">← 강의실로</Link>
      <h1 className="font-jua text-3xl text-sky-ink">데일리 테스트</h1>

      <section className="space-y-2">
        <h2 className="font-jua text-xl text-sky-ink">⏰ 밀린 테스트 <span className="text-sm text-slate-500">({cohortLabel(current.cohort)} · 늦은 제출로 표시돼요)</span></h2>
        {missed.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">밀린 테스트가 없어요 👍</p> : missed.map((t) => (
          <div key={`${t.day}-${t.spec.kind}`}>
            <p className="mb-1 px-1 text-xs text-slate-500">{md(t.day)} 수업</p>
            <TestForm appId={current.id} day={t.day} kind={t.spec.kind} label={`${TEST_LABEL[t.spec.kind]} ${t.spec.no}`} questions={t.spec.questions} late />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-jua text-xl text-sky-ink">📈 내 점수 기록</h2>
        {(["word", "rc"] as const).map((kind) => {
          const s = series(kind);
          return (
            <div key={kind} className="space-y-1">
              <LineChart title={`${TEST_LABEL[kind]} 정답률`} points={s} />
              {s.length > 0 && (
                <details className="rounded-2xl bg-white px-4 py-2 text-sm">
                  <summary className="cursor-pointer text-slate-500">표로 보기</summary>
                  <table className="mt-2 w-full text-left">
                    <thead><tr className="text-xs text-slate-400"><th className="py-1">날짜</th><th>번호</th><th>점수</th><th>정답률</th></tr></thead>
                    <tbody>
                      {s.map(({ r, pct }) => (
                        <tr key={r.id} className="border-t border-sky-soft">
                          <td className="py-1">{md(r.day)}</td>
                          <td>{r.test_no}</td>
                          <td>{r.score}/{r.questions}{r.late ? " · 늦은 제출" : ""}</td>
                          <td>{pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
