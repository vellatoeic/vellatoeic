// ── 강의·특강 열람 기간 (DB 없이 계산) ──
// 공식 규칙(학생 안내·FAQ): 정규 강의와 특강 다시보기 모두 '종강일까지'.
// 실제 열람: 종강일에 자동 연장 공지를 띄우고 '다음 달 첫 수업일(시작반 종합반) 전날'까지 열어 둬요.
// 다음 달 수업일이 없으면 그 기수 마지막 수업일 + 7일까지.
// 종강일 = 학생 반 마지막 수업일(격일반은 8회차). 신청이 여러 개면 가장 늦은 종강일.

export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// 그 기수 실제 열람 마감일
export function viewUntil(nextFirstDay: string | null, lastClassDays: string[]): string {
  if (nextFirstDay) return addDays(nextFirstDay, -1);
  const last = [...lastClassDays].sort().at(-1);
  return last ? addDays(last, 7) : "9999-12-31";
}

export const viewOpen = (until: string, today: string) => today <= until;

// ── 권한 오픈: 개강일 오전 9시 (2026-11-27 Vella: 첫 수업 10시보다 1시간 전) ──
// 개강일 = 그 기수 가장 이른 수업일(일정표). 이 시각 전에는 납부를 마친 '예비수강생'이라도
// 강의 목록·강의 주소·라이브 링크·LC 음원이 열리지 않아요. 지난달 강의는 다음 달 개강일 0시에 닫혀요(viewUntil).
export const OPEN_HOUR = 9;
export const openAtOf = (firstDay: string | null | undefined) => (firstDay ? `${firstDay}T${String(OPEN_HOUR).padStart(2, "0")}:00:00+09:00` : null);
// 개강 시각을 모르면(수업일 없음·계산 실패) 막지 않아요
export const isOpened = (openAt: string | null | undefined, nowMs = Date.now()) => !openAt || nowMs >= Date.parse(openAt);
// 지금 강의를 볼 수 있는지: 개강일 9시 ~ 열람 마감일
export const canViewNow = (w: { until: string; openAt?: string | null } | undefined, today: string, nowMs = Date.now()) =>
  !!w && isOpened(w.openAt, nowMs) && viewOpen(w.until, today);
// 예: 12/1(화) 오전 9시
export const openLabel = (openAt: string) => `${dayLabelKo(openAt.slice(0, 10))} 오전 ${OPEN_HOUR}시`;

// 강의실에서 강의를 읽을 기수: 오늘 열람 가능한 신청(개강일 9시부터, 종강 후 다음 달 개강 전날까지 연장 포함)의 기수만
// (마감일을 모르는 신청은 닫힌 것으로 봐요. 강의실 화면의 viewable과 같은 규칙)
export function viewableCohorts(apps: { id: string; cohort: string }[], windows: Map<string, { until: string; openAt?: string | null }>, today: string, nowMs = Date.now()): string[] {
  return [...new Set(apps.filter((a) => canViewNow(windows.get(a.id), today, nowMs)).map((a) => a.cohort))].sort();
}

// 종강일 연장 공지·안내 단계: before(종강일 전) / endDay(종강일 당일) / extended(종강일 다음 날 ~ 마감일) / closed(마감 후)
export function viewPhase(end: string, until: string, today: string): "before" | "endDay" | "extended" | "closed" {
  if (today > until) return "closed";
  if (today > end) return "extended";
  if (today === end) return "endDay";
  return "before";
}

// 종강일 자동 연장 팝업: 종강일 당일 00:00 ~ 마감일
export const courseEndPopupOpen = (end: string, until: string, today: string) => today >= end && today <= until;

// 예: 11/1(일)
export const dayLabelKo = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${"일월화수목금토"[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;
