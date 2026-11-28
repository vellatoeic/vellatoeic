// ── 특강 신청 마감 ──
// 마감 일시를 따로 정하지 않으면 '특강 전날 17:00(한국 시간)'이에요. 마감 전이고 특강 시작 전이어야 신청할 수 있어요.
type DeadlineEvent = { event_date: string; starts_at: string; registration_deadline?: string | null };

export function defaultDeadline(eventDate: string) {
  const d = new Date(`${eventDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return new Date(`${d.toISOString().slice(0, 10)}T17:00:00+09:00`).toISOString();
}

export const deadlineOf = (e: DeadlineEvent) => e.registration_deadline || defaultDeadline(e.event_date);

export function specialRegistrationOpen(e: DeadlineEvent, nowMs = Date.now()) {
  const start = Date.parse(`${e.event_date}T${e.starts_at.slice(0, 5)}:00+09:00`);
  return nowMs < Date.parse(deadlineOf(e)) && nowMs < start;
}

// 예: 10/16(금) 17:00
export function kstLabel(iso: string) {
  const k = new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString();
  return `${specialDay(k.slice(0, 10))} ${k.slice(11, 16)}`;
}

// 마감 배지: 24시간보다 많이 남으면 마감 일시, 24시간 이내면 'D-1 · n시간 남음', 1시간 이내면 '곧 마감'
export function deadlineBadge(e: DeadlineEvent, nowMs = Date.now()): string | null {
  const left = Date.parse(deadlineOf(e)) - nowMs;
  if (left <= 0) return null;
  if (left <= 3600 * 1000) return "곧 마감";
  if (left <= 24 * 3600 * 1000) return `마감 D-1 · ${Math.floor(left / 3600 / 1000)}시간 남음`;
  return `${kstLabel(deadlineOf(e))} 마감`;
}

// 예: 10/17(토)
export function specialDay(eventDate: string) {
  const [y, m, d] = eventDate.split("-").map(Number);
  return `${m}/${d}(${"일월화수목금토"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

// 예: 10/17(토) · 10:00~12:00
export function specialWhen(event: { event_date: string; starts_at: string; ends_at: string | null }) {
  const time = event.ends_at ? `${event.starts_at.slice(0, 5)}~${event.ends_at.slice(0, 5)}` : `${event.starts_at.slice(0, 5)} 시작`;
  return `${specialDay(event.event_date)} · ${time}`;
}

// ── 보증금 · 정원 (2026-11-28 Vella) ──
// 12월 특강부터 보증금 없음: 현장 신청도 바로 확정(deposit 비어 있음). 11월까지 특강은 예전 보증금 규칙 그대로(기록 보관).
// 현장 정원은 특강마다 90명(수강생·비수강생 합쳐서, 불라방은 제한 없음).
export const DEPOSIT_FREE_FROM = "2026-12-01";
export const needsDeposit = (eventDate: string) => eventDate < DEPOSIT_FREE_FROM;
export const SPECIAL_CAPACITY = 90;
type RegLike = { mode: "onsite" | "online"; deposit: string | null };
// 신청 확정: 불라방 · 보증금 확인 · 보증금 없는 특강의 현장 신청 (취소 제외)
export function specialConfirmed(reg: RegLike, eventDate: string) {
  if (reg.deposit === "cancelled") return false;
  if (reg.mode === "online") return true;
  return reg.deposit === "paid" || !needsDeposit(eventDate);
}
// 현장 자리를 차지하는 신청 수 (취소 제외)
export const onsiteTaken = (regs: RegLike[]) => regs.filter((r) => r.mode === "onsite" && r.deposit !== "cancelled").length;

// ── 지난 특강 다시 보기 ──
// 공식: 종강일까지 / 실제: 그 특강 달 기수의 열람 마감일(until = 다음 달 개강 전날)까지 (lib/viewWindow.ts)
// 불라방 신청자: 특강 전부터 / 현장 신청자: 신청이 확정(보증금 확인 · 12월부터는 바로 확정)된 경우 특강 당일부터. 자동 취소된 신청은 제외.
export function canSeeSpecialMaterials(reg: RegLike, eventDate: string, today: string, until: string) {
  if (today > until) return false;
  if (!specialConfirmed(reg, eventDate)) return false;
  if (reg.mode === "online") return true;
  return eventDate <= today;
}

// 특강 시작 시각(한국 시간)
type StartEvent = { event_date: string; starts_at: string };
export const specialStartMs = (e: StartEvent) => Date.parse(`${e.event_date}T${e.starts_at.slice(0, 5)}:00+09:00`);
// 특강이 시작됐는지 (현장 신청자: 시작 뒤에는 '강의실(CLASSROOM)로 와주세요' 대신 자료·영상 칸)
export const specialStarted = (e: StartEvent, nowMs = Date.now()) => nowMs >= specialStartMs(e);
// 다시 보기 단계: 특강 시작 2시간 뒤부터 '📺 특강 다시 보기' + '📚 지난 특강' 안내
export const REPLAY_AFTER_MS = 2 * 3600 * 1000;
export const specialReplay = (e: StartEvent, nowMs = Date.now()) => nowMs >= specialStartMs(e) + REPLAY_AFTER_MS;
