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
  if (left <= 3600 * 1000) return "⏰ 곧 마감";
  if (left <= 24 * 3600 * 1000) return `⏰ 마감 D-1 · ${Math.floor(left / 3600 / 1000)}시간 남음`;
  return `⏰ ${kstLabel(deadlineOf(e))} 마감`;
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

// ── 지난 특강 다시 보기 ──
// 특강이 있던 달 말까지만 자료·영상을 볼 수 있어요.
// 불라방 신청자: 특강 전부터 달 말까지 / 현장 신청자: 보증금 확인(paid)된 경우 특강 다음 날부터 달 말까지
type ViewReg = { mode: "onsite" | "online"; deposit: string | null };
export function canSeeSpecialMaterials(reg: ViewReg, eventDate: string, today: string) {
  if (today.slice(0, 7) > eventDate.slice(0, 7)) return false;
  if (reg.mode === "online") return true;
  return reg.deposit === "paid" && eventDate < today;
}
