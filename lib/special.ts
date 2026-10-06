export function specialRegistrationOpen(eventDate: string, startsAt: string, nowMs = Date.now()) {
  const kst = new Date(nowMs + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().slice(0, 10);
  if (eventDate > today) return true;
  if (eventDate < today) return false;
  const currentMinutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const [hour, minute] = startsAt.slice(0, 5).split(":").map(Number);
  return currentMinutes < hour * 60 + minute;
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
