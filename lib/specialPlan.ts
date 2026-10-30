// ── 특강 자동 생성 (DB 없이 계산) ──
// 기수마다 특강 요일(금 5 / 토 6). 1차 = 개강 1주차의 그 요일, 2차 = 개강 3주차의 그 요일.
// 개강일 = 시작반 종합반 첫 수업일. 공휴일이어도 날짜는 그대로 두고 표시만 해요(관리자가 초안에서 고쳐요).

export type SpecialWeekday = 5 | 6;
export const WEEKDAY_LABEL: Record<SpecialWeekday, string> = { 5: "금요일", 6: "토요일" };
export const SPECIAL_SLOTS = [
  { round: 1, title: "PART 5 액기스 특강", starts_at: "10:00", ends_at: "12:00" as string | null },
  { round: 2, title: "적중 모의고사 + 풀이", starts_at: "10:00", ends_at: null as string | null },
] as const;

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function specialDatesFor(firstClassDay: string, weekday: SpecialWeekday): [string, string] {
  const dow = (new Date(`${firstClassDay}T00:00:00Z`).getUTCDay() + 6) % 7; // 월=0
  const monday = addDays(firstClassDay, -dow);
  const first = addDays(monday, weekday - 1);
  return [first, addDays(first, 14)];
}

export const isPublished = (e: { published?: boolean | null }) => e.published !== false;

// 학생에게 보여줄 특강만 (공개 전 초안 제외)
export const publicSpecials = <T extends { published?: boolean | null }>(list: T[]) => list.filter(isPublished);
