// ── 출석 가능한 날 (DB 없이 계산해요. 테스트: tests/attendance-days.test.ts) ──
// 그 학생 반의 수업일(관리자 수업일 설정)이면서 공휴일이 아닌 날만 QR 출석이 돼요.

export function isClassDay(classDays: string[], holidays: Record<string, string>, day: string) {
  return classDays.includes(day) && !holidays[day];
}

// 오늘 이후 가장 가까운 수업일 (없으면 null)
export function nextClassDay(classDays: string[], holidays: Record<string, string>, today: string) {
  return [...new Set(classDays)].sort().find((d) => d > today && !holidays[d]) ?? null;
}
