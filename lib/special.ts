export function specialRegistrationOpen(eventDate: string, startsAt: string, nowMs = Date.now()) {
  const kst = new Date(nowMs + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().slice(0, 10);
  if (eventDate > today) return true;
  if (eventDate < today) return false;
  const currentMinutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const [hour, minute] = startsAt.slice(0, 5).split(":").map(Number);
  return currentMinutes < hour * 60 + minute;
}
