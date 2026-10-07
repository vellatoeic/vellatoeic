// ── 문풀반 데일리 테스트 번호 계산 (DB 없이 날짜만으로 계산해요. 테스트: tests/daily-tests.test.ts) ──
// - DAY = 문풀반 종합 수업일 중 몇 번째인지 (공휴일·휴강은 수업일 설정에서 빠져 있어요)
// - DAY 1은 테스트 없음, DAY 2부터 하루에 하나씩 번호가 올라가요.
// - 단어 TEST: 매달 1부터, 20문항.
// - RC TEST: 홀수달 1~20, 짝수달 21~40 (한 달 20개까지). 30문항, 단 1번·21번은 25문항.
// - 격일반·속성반은 같은 날짜 문풀반 종합의 번호를 그대로 따라가요(본인 반 수업일에만 보여요).
// - 관리자가 특정 날짜의 번호·문항 수를 직접 고치면(override) 그 값이 우선이에요.

export type TestKind = "word" | "rc";
export type TestSpec = { kind: TestKind; no: number; questions: number };
export type TestOverride = { day: string; kind: TestKind; test_no: number | null; questions: number | null };

export const TEST_LABEL: Record<TestKind, string> = { word: "단어 TEST", rc: "RC TEST" };
export const WORD_QUESTIONS = 20;
export const RC_PER_MONTH = 20;

const isOddMonth = (cohort: string) => Number(cohort.slice(5, 7)) % 2 === 1;
export const rcQuestions = (no: number) => (no === 1 || no === 21 ? 25 : 30);

// 문풀반 종합 수업일 → 날짜별 테스트 (관리자 수정 반영)
export function testPlan(cohort: string, solveAllDays: string[], overrides: TestOverride[] = []) {
  const plan = new Map<string, TestSpec[]>();
  const days = [...new Set(solveAllDays)].sort();
  days.forEach((day, i) => {
    const n = i; // DAY(i+1) - 1 : DAY 2 → 1번
    const tests: TestSpec[] = [];
    if (n >= 1) {
      tests.push({ kind: "word", no: n, questions: WORD_QUESTIONS });
      if (n <= RC_PER_MONTH) {
        const no = isOddMonth(cohort) ? n : 20 + n;
        tests.push({ kind: "rc", no, questions: rcQuestions(no) });
      }
    }
    plan.set(day, tests);
  });
  for (const o of overrides) {
    const rest = (plan.get(o.day) ?? []).filter((t) => t.kind !== o.kind);
    if (o.test_no !== null && o.test_no > 0) {
      const base = plan.get(o.day)?.find((t) => t.kind === o.kind);
      const questions = o.questions ?? base?.questions ?? (o.kind === "word" ? WORD_QUESTIONS : rcQuestions(o.test_no));
      rest.push({ kind: o.kind, no: o.test_no, questions });
    }
    plan.set(o.day, rest.sort((a, b) => (a.kind === "word" ? -1 : 1) - (b.kind === "word" ? -1 : 1)));
  }
  return plan;
}

// 문풀반 종합 기준 DAY 번호 (1부터). 문풀 종합 수업일이 아니면 null
export function dayNumber(solveAllDays: string[], day: string) {
  const i = [...new Set(solveAllDays)].sort().indexOf(day);
  return i === -1 ? null : i + 1;
}

// 이 학생 반 수업일에만 테스트가 보여요. (격일반은 본인 수업이 없는 날 테스트를 안 봐요)
export function testsForClassDay(plan: Map<string, TestSpec[]>, classDays: string[], day: string): TestSpec[] {
  return classDays.includes(day) ? plan.get(day) ?? [] : [];
}

// 맞은 개수와 틀린 번호가 함께 맞는지 확인해요. (틀린 번호는 선택 사항)
export function checkTestAnswer(questions: number, score: number, wrong: number[]): string | null {
  if (!Number.isInteger(score) || score < 0 || score > questions) return `맞은 개수는 0~${questions} 사이로 적어 주세요.`;
  if (wrong.some((w) => !Number.isInteger(w) || w < 1 || w > questions)) return "틀린 번호를 다시 골라 주세요.";
  if (new Set(wrong).size !== wrong.length) return "같은 번호가 두 번 골라졌어요.";
  if (wrong.length > 0 && score + wrong.length !== questions) {
    return `맞은 개수(${score}) + 틀린 번호(${wrong.length}개)가 ${questions}문항과 맞지 않아요.`;
  }
  return null;
}
