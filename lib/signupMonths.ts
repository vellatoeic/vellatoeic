// ── 신청서 수강 월 ──
// '이번 달': 오늘이 이번 달 기수 2주차 마지막 수업일 이하일 때만 (중간 등록 마감)
// '다음 달': 매달 15일부터 (이번 달 선택지가 닫혔으면 날짜와 상관없이 다음 달만)
// 기준 수업일은 시작반 종합반(주 4일) 수업일이에요.

export type SignupMonth = { cohort: string; label: string; range: string; start: string; end: string };

export const shiftMonth = (cohort: string, n: number) => {
  const [y, m] = cohort.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 월요일 시작 주 번호 (날짜 비교용)
const weekKey = (d: string) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // 월=0
  return new Date(t - dow * 86400000).toISOString().slice(0, 10);
};

// 수업일 중 2주차의 마지막 수업일
export function secondWeekLastDay(days: string[]): string | null {
  const weeks = [...new Set([...days].sort().map(weekKey))];
  if (weeks.length < 2) return [...days].sort().at(-1) ?? null;
  return [...days].sort().filter((d) => weekKey(d) === weeks[1]).at(-1) ?? null;
}

export function signupMonthsFor(today: string, thisDays: string[], nextDays: string[]): SignupMonth[] {
  const thisCohort = today.slice(0, 7);
  const nextCohort = shiftMonth(thisCohort, 1);
  const cut = secondWeekLastDay(thisDays);
  const showThis = !!cut && today <= cut;
  const showNext = Number(today.slice(8, 10)) >= 15 || !showThis;
  const item = (cohort: string, days: string[]): SignupMonth => {
    const s = [...days].sort();
    return { cohort, label: `${Number(cohort.slice(5, 7))}월 수업`, range: s.length ? `${md(s[0])}~${md(s.at(-1)!)}` : "", start: s[0] ?? "", end: s.at(-1) ?? "" };
  };
  return [...(showThis ? [item(thisCohort, thisDays)] : []), ...(showNext ? [item(nextCohort, nextDays)] : [])];
}
