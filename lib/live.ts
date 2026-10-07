import { KLASS_TIME, TIME_SLOTS, isAlt, klassOf, type CourseId, type TimeSlot, type Track } from "./config";
import { specialDay } from "./special";

export const LIVE_OPEN_BEFORE_MIN = 10; // 라이브 입장 버튼은 수업 10분 전부터 빨간색

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

type LiveApp = { course: CourseId; track: Track; slot: TimeSlot | null };

// 본인 반 수업 요일 (예: 월~목, 월·수)
export function classDaysLabel(a: { course: CourseId; track: Track }) {
  if (a.track === "alt_mw" || a.track === "alt") return "월·수";
  if (a.track === "alt_tt") return "화·목";
  return isAlt(a.track) ? "주 2일" : "월~목";
}

// 본인 반 수업 시간 (수강 시간이 없으면 오전·저녁 둘 다)
export function classTimes(a: LiveApp) {
  const slots = KLASS_TIME[klassOf(a)];
  return (a.slot ? [a.slot] : (["am", "pm"] as TimeSlot[])).map((s) => ({ slot: s, label: TIME_SLOTS[s], from: slots[s === "am" ? 0 : 1].from, to: slots[s === "am" ? 0 : 1].to }));
}

// 지금 라이브 입장이 열려 있는지(수업 30분 전 ~ 종료), 아니면 다음 라이브가 언제인지
export function liveState(a: LiveApp, scheduleDays: string[], nowMs = Date.now()) {
  const kst = new Date(nowMs + 9 * 3600 * 1000);
  const today = kst.toISOString().slice(0, 10);
  const now = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const times = classTimes(a).sort((x, y) => toMin(x.from) - toMin(y.from));
  const days = [...new Set(scheduleDays)].sort();

  if (days.includes(today)) {
    const open = times.find((t) => now >= toMin(t.from) - LIVE_OPEN_BEFORE_MIN && now <= toMin(t.to));
    if (open) return { open: true as const, slot: open.slot, label: `${open.label} ${open.from}~${open.to}` };
  }
  for (const day of days.filter((d) => d >= today)) {
    const t = times.find((x) => day > today || now < toMin(x.from) - LIVE_OPEN_BEFORE_MIN);
    if (t) return { open: false as const, next: `${specialDay(day)} ${t.from}` };
  }
  return { open: false as const, next: null };
}
