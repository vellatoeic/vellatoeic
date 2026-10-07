import "server-only";
import { getSetting, listApplications, listTestOverrides, listTestResults, type Application, type TestResult } from "./db";
import { canWatch } from "./access";
import { scheduleClassFor, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";
import { testPlan, testsForClassDay, type TestSpec } from "./tests";

// 문풀반·속성반(속성반도 문풀반 수업을 들어요) 납부 완료 학생만 테스트를 봐요. 시작반은 X
export const takesTests = (a: Application) => canWatch(a) && (a.course === "solve" || a.course === "intensive");

export async function classDaysOf(a: Application) {
  const klass = scheduleClassFor(a.course, a.track);
  return schoolDaysFor(await getSetting(scheduleKey(a.cohort, klass)), a.cohort, klass);
}

// 그 달 문풀반 종합 수업일 + 관리자 수정 → 날짜별 테스트
export async function planFor(cohort: string) {
  const [raw, overrides] = await Promise.all([getSetting(scheduleKey(cohort, "solve-all")), listTestOverrides(cohort)]);
  const solveAllDays = schoolDaysFor(raw, cohort, "solve-all");
  return { plan: testPlan(cohort, solveAllDays, overrides), solveAllDays, overrides };
}

export type TestSlotView = { day: string; spec: TestSpec; result: TestResult | null };

// 학생 한 명의 오늘 테스트와 밀린 테스트(같은 달, 오늘 이전, 미제출)
export async function studentTests(a: Application, today: string) {
  const [{ plan }, classDays, results] = await Promise.all([planFor(a.cohort), classDaysOf(a), listTestResults({ appIds: [a.id] })]);
  const find = (day: string, kind: string) => results.find((r) => r.day === day && r.kind === kind) ?? null;
  const all: TestSlotView[] = classDays
    .filter((d) => d <= today)
    .flatMap((d) => testsForClassDay(plan, classDays, d).map((spec) => ({ day: d, spec, result: find(d, spec.kind) })));
  const sameMonth = today.slice(0, 7) === a.cohort;
  return {
    today: all.filter((t) => t.day === today),
    missed: sameMonth ? all.filter((t) => t.day < today && !t.result) : [],
    results,
  };
}

// ── 관리자용 통계 ──

export type StudentTestStat = {
  app: Application;
  klass: ScheduleClass;
  expected: { day: string; spec: TestSpec }[]; // 오늘까지 봐야 했던 테스트
  results: TestResult[];
  avg: Record<"word" | "rc", number | null>; // 정답률 평균(%)
  missing: number; // 오늘까지 미제출 수 (오늘 것은 23:59 전이라 빼요)
  declining: boolean; // 최근 3회 정답률이 계속 떨어짐 (단어 또는 RC)
};

const pct = (r: TestResult) => Math.round((r.score / r.questions) * 100);

// 한 달(기수)의 테스트 대상 학생과 기록
export async function cohortTestStats(cohort: string, today: string): Promise<{ stats: StudentTestStat[]; plan: Map<string, TestSpec[]>; classDays: Map<ScheduleClass, string[]> }> {
  const [{ plan }, apps, results] = await Promise.all([planFor(cohort), listApplications(), listTestResults({ cohort })]);
  const targets = apps.filter((a) => a.cohort === cohort && takesTests(a));
  const classDays = new Map<ScheduleClass, string[]>();
  for (const a of targets) {
    const k = scheduleClassFor(a.course, a.track);
    if (!classDays.has(k)) classDays.set(k, await classDaysOf(a));
  }
  const stats = targets.map((app) => {
    const klass = scheduleClassFor(app.course, app.track);
    const days = classDays.get(klass) ?? [];
    const expected = days.filter((d) => d <= today).flatMap((d) => testsForClassDay(plan, days, d).map((spec) => ({ day: d, spec })));
    const mine = results.filter((r) => r.app_id === app.id);
    const avgOf = (kind: "word" | "rc") => {
      const rs = mine.filter((r) => r.kind === kind);
      return rs.length ? Math.round(rs.reduce((s, r) => s + pct(r), 0) / rs.length) : null;
    };
    const falling = (kind: "word" | "rc") => {
      const rs = mine.filter((r) => r.kind === kind).sort((a, b) => a.day.localeCompare(b.day)).slice(-3).map(pct);
      return rs.length === 3 && rs[0] > rs[1] && rs[1] > rs[2];
    };
    const missing = expected.filter((e) => e.day < today && !mine.some((r) => r.day === e.day && r.kind === e.spec.kind)).length;
    return { app, klass, expected, results: mine, avg: { word: avgOf("word"), rc: avgOf("rc") }, missing, declining: falling("word") || falling("rc") };
  });
  return { stats, plan, classDays };
}
