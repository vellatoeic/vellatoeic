// 출석·숙제로 "관리 필요 학생"을 고르는 규칙 (DB 없이 계산만 해요)
// - 결석: 오늘 이전 수업일 중 출석 기록이 없는 날 (오늘 수업은 아직 안 끝났으니 빼요)
// - 연속 결석: 가장 최근 수업일부터 거꾸로 이어진 결석 수
// - 숙제 미제출: 첫 수업일을 빼고, 다음 날 제출 기한까지 지난 수업일 중 숙제 기록이 없는 날

export const WATCH_RULES = { absent: 3, streak: 2, homework: 3 } as const;

export type WatchSummary = {
  past: number; // 지난 수업 수
  attended: number;
  late: number;
  absent: number;
  streak: number;
  hwDue: number;
  hwMissing: number;
  reasons: string[];
};

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function watchSummary(classDays: string[], attendance: { day: string; late?: boolean }[], homeworkDays: string[], today: string): WatchSummary {
  const days = [...classDays].sort();
  const past = days.filter((d) => d < today);
  const came = new Map(attendance.map((a) => [a.day, a]));
  const absentDays = past.filter((d) => !came.has(d));
  let streak = 0;
  for (let i = past.length - 1; i >= 0 && !came.has(past[i]); i--) streak++;
  const hwDueDays = days.slice(1).filter((d) => addDays(d, 1) < today);
  const hw = new Set(homeworkDays);
  const hwMissing = hwDueDays.filter((d) => !hw.has(d)).length;
  const reasons: string[] = [];
  if (absentDays.length >= WATCH_RULES.absent) reasons.push(`결석 ${absentDays.length}회`);
  if (streak >= WATCH_RULES.streak) reasons.push(`최근 ${streak}회 연속 결석`);
  if (hwMissing >= WATCH_RULES.homework) reasons.push(`숙제 미제출 ${hwMissing}회`);
  return {
    past: past.length,
    attended: past.filter((d) => came.has(d)).length,
    late: past.filter((d) => came.get(d)?.late).length,
    absent: absentDays.length,
    streak,
    hwDue: hwDueDays.length,
    hwMissing,
    reasons,
  };
}

// 심한 순서: 연속 결석 → 결석 수 → 숙제 미제출
export const watchRank = (s: WatchSummary) => s.streak * 100 + s.absent * 10 + s.hwMissing;

// 관리 필요 학생 카테고리 (학생이 많을 때 나눠 보기). 정렬은 그 카테고리에서 심한 순서.
export const WATCH_CATEGORIES = {
  all: { label: "전체", test: (s: WatchSummary) => s.reasons.length > 0, rank: watchRank },
  streak: { label: "연속 결석", test: (s: WatchSummary) => s.streak >= WATCH_RULES.streak, rank: (s: WatchSummary) => s.streak * 100 + s.absent },
  absent: { label: `결석 ${WATCH_RULES.absent}회+`, test: (s: WatchSummary) => s.absent >= WATCH_RULES.absent, rank: (s: WatchSummary) => s.absent * 100 + s.streak },
  homework: { label: "숙제 미제출", test: (s: WatchSummary) => s.hwMissing >= WATCH_RULES.homework, rank: (s: WatchSummary) => s.hwMissing * 100 + s.absent },
} as const;
export type WatchCategory = keyof typeof WATCH_CATEGORIES;
export const isWatchCategory = (v: string | undefined): v is WatchCategory => !!v && Object.hasOwn(WATCH_CATEGORIES, v);
