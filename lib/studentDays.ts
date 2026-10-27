// ── 중간 등록생의 수업일 ──
// 학생의 첫 수업일 = max(반 첫 수업일, 신청일 이후 첫 수업일) = 신청일(한국 날짜) 이후 첫 수업일.
// 그 전 수업일은 스티커판(빈칸)·밀린 테스트·출석/결석·관리 필요·테스트 미제출·통합 화면 요약에서 모두 빼요.

export const kstDate = (iso: string) => new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 10);

// 신청일 기준 학생 첫 수업일 (신청이 마지막 수업일보다 늦으면 null)
export function studentStartDay(classDays: string[], createdAt: string): string | null {
  const signup = kstDate(createdAt);
  return [...classDays].sort().find((d) => d >= signup) ?? null;
}

// 학생에게 해당하는 수업일만 (첫 수업일부터)
export function studentDays(classDays: string[], createdAt: string): string[] {
  const start = studentStartDay(classDays, createdAt);
  return start ? [...classDays].sort().filter((d) => d >= start) : [];
}
