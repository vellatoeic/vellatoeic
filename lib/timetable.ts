// ── 일정표 (강사가 한 달 수업을 한 장에, 2026-11-27 Vella) ──
// 먼저 '몇 월 수업'인지 고르고, [월수반]·[화목반]·[특강] 버튼을 골라 날짜를 눌러요. 주 4일반(종합·단과·속성) = 월수반 + 화목반 전부.
// 12월반이 11월 말에 개강하는 달도 있어서 달력은 1일이 있는 주(앞달 날짜 포함) ~ 다음 달 첫 주까지 보여주고, 그 날짜도 그 기수 수업일로 저장해요.
// 공휴일은 대한민국 공휴일 표(lib/krHolidays.ts)로 자동 표시, 공휴일에 수업을 넣으면 수업이 우선이에요.
// 저장하면 7개 반 수업일·공휴일·특강 초안이 한 번에 바뀌어서 강의실·출석·숙제·테스트·음원·열람 기간·수강증 반 대조가 모두 이 일정표를 따라가요(기준선).
// 개강일 = 첫 수업일, 종강일 = 마지막 수업일. DB 없이 계산해요. 자동 테스트: tests/timetable.test.ts
import { KR_HOLIDAYS } from "./krHolidays";
import { SCHEDULE_CLASSES, type ScheduleClass } from "./schedule";
import { SPECIAL_SLOTS } from "./specialPlan";

export type DayMark = "mw" | "tt";
export type Marks = Record<string, DayMark>;
export const MARK_LABEL: Record<DayMark, string> = { mw: "월수반", tt: "화목반" };
export const SPECIAL_MAX = 2; // 특강은 한 달에 두 번

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay(); // 일 0 ~ 토 6
const shiftMonth = (cohort: string, n: number) => {
  const [y, m] = cohort.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
export const monthEnd = (cohort: string) => addDays(`${shiftMonth(cohort, 1)}-01`, -1);

// 일정표 달력 범위(일~토): 그 달 1일이 있는 주 ~ 마지막 날 7일 뒤가 있는 주 (12월: 11/29 ~ 1/9)
// 앞달 말 개강은 늘 1일과 같은 주(예: 12/1(화) → 11/30(월))라 앞달은 그 주만 보여줘요 (앞달만 있는 줄이 맨 위에 있으면 지난달 달력처럼 보여요)
export function timetableRange(cohort: string) {
  const a = `${cohort}-01`;
  const b = addDays(monthEnd(cohort), 7);
  return { start: addDays(a, -weekdayOf(a)), end: addDays(b, 6 - weekdayOf(b)) };
}
export const inRange = (day: string, cohort: string) => {
  if (!isDay(day)) return false;
  const r = timetableRange(cohort);
  return day >= r.start && day <= r.end;
};
export function timetableWeeks(cohort: string): string[][] {
  const { start, end } = timetableRange(cohort);
  const weeks: string[][] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  return weeks;
}

// 공휴일: 범위 안 대한민국 공휴일 + 예전에 저장한 공휴일, 수업을 넣은 날은 빼요(수업 우선)
export function holidaysFor(cohort: string, saved: Record<string, string>, marks: Marks): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [d, n] of [...Object.entries(KR_HOLIDAYS), ...Object.entries(saved)]) if (inRange(d, cohort) && !marks[d]) out[d] = n;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

// 개강일부터 자동 채우기: 주마다 월~금 중 공휴일을 뺀 앞 4일(보통 월~목, 공휴일 주·주 중간 개강 주는 금요일까지),
// 순서대로 월수반 → 화목반을 번갈아요 (12월: 12/1(화) 월수 · 12/2(수) 화목 · 12/3(목) 월수 · 12/4(금) 화목 = 회차 기준).
// 종강일을 주면 그날까지, 없으면 16회까지. 앞달 말 개강(예: 11/30)도 돼요.
export function autoFill(cohort: string, start: string, holidays: Record<string, string>, end?: string | null, sessions = 16): Marks {
  const out: Marks = {};
  if (!inRange(start, cohort) || (end && end < start)) return out;
  let n = 0;
  let week = "";
  let inWeek = 0;
  for (let day = start; inRange(day, cohort) && (end ? day <= end : n < sessions); day = addDays(day, 1)) {
    const w = weekdayOf(day);
    const monday = addDays(day, -((w + 6) % 7));
    if (monday !== week) [week, inWeek] = [monday, 0];
    if (w < 1 || w > 5 || holidays[day] || inWeek >= 4) continue;
    out[day] = n % 2 === 0 ? "mw" : "tt";
    n++;
    inWeek++;
  }
  return out;
}

// 일정표 → 7개 반 수업일
export function classDaysFromMarks(marks: Marks): Record<ScheduleClass, string[]> {
  const all = Object.keys(marks).sort();
  const mw = all.filter((d) => marks[d] === "mw");
  const tt = all.filter((d) => marks[d] === "tt");
  return { "start-all": all, "solve-all": all, "intensive-all": all, "start-mw": mw, "solve-mw": mw, "start-tt": tt, "solve-tt": tt };
}

// 저장된 반별 수업일 → 일정표 (시작반 기준). 주 4일반에만 있는 날은 적은 쪽 반으로 채워요.
export function marksFromDays(all: string[], mw: string[], tt: string[]): Marks {
  const out: Marks = {};
  for (const d of mw) out[d] = "mw";
  for (const d of tt) out[d] ??= "tt";
  for (const d of [...all].sort()) {
    if (out[d]) continue;
    const v = Object.values(out);
    out[d] = v.filter((m) => m === "mw").length <= v.filter((m) => m === "tt").length ? "mw" : "tt";
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

// 지금 저장된 반별 수업일 중 일정표와 다른 반 (예전 반별 화면에서 따로 고친 반) → 저장하면 일정표대로 맞춰져요
export function mismatchedClasses(days: Record<ScheduleClass, string[]>, marks: Marks): string[] {
  const want = classDaysFromMarks(marks);
  return (Object.keys(SCHEDULE_CLASSES) as ScheduleClass[])
    .filter((k) => [...days[k]].sort().join() !== want[k].join())
    .map((k) => SCHEDULE_CLASSES[k]);
}

// 요약: 개강일·종강일·회차 수, 반별 몇 번째 수업인지(칸에 '월수 3'처럼)
export function summarize(marks: Marks) {
  const all = Object.keys(marks).sort();
  const mw = all.filter((d) => marks[d] === "mw");
  const tt = all.filter((d) => marks[d] === "tt");
  const nth: Record<string, number> = {};
  mw.forEach((d, i) => (nth[d] = i + 1));
  tt.forEach((d, i) => (nth[d] = i + 1));
  return { first: all[0] ?? null, last: all.at(-1) ?? null, total: all.length, mw, tt, nth };
}

// 일정표 확인 문구 (16회 · 8회씩이 아니면 알려 줘요)
export function timetableWarnings(marks: Marks): string[] {
  const s = summarize(marks);
  const out: string[] = [];
  if (s.total === 0) return ["수업일이 하나도 없어요"];
  if (s.total !== 16) out.push(`주 4일반 수업이 ${s.total}회예요 (보통 16회)`);
  if (s.mw.length !== s.tt.length) out.push(`월수반 ${s.mw.length}회 · 화목반 ${s.tt.length}회예요 (보통 8회씩)`);
  return out;
}

// ── 특강: 날짜마다 어떤 특강인지 골라요 ↔ [특강 관리]의 특강 ──
// 특강 신청은 '특강 날짜가 속한 달' 기수 수강생만 할 수 있어서, 특강 날짜는 그 달 안에서만 골라요.
export type SpecialPick = { date: string; title: string };
export type SpecialRow = { id: string; event_date: string; title: string; starts_at?: string; ends_at?: string | null; published?: boolean | null };
export const SPECIAL_KINDS = SPECIAL_SLOTS.map((s) => ({ title: s.title, starts_at: s.starts_at, ends_at: s.ends_at }));
export const specialTimes = (title: string) => SPECIAL_KINDS.find((k) => k.title === title) ?? { title, starts_at: "10:00", ends_at: null as string | null };
export const specialInMonth = (day: string, cohort: string) => isDay(day) && day.startsWith(`${cohort}-`);

// 저장할 때 할 일: 공개한 특강은 그대로(날짜·이름 잠김), 공개 전 초안만 이름 바꾸고·옮기고·만들고·지워요.
export function planSpecialSync(cohort: string, picks: SpecialPick[], existing: SpecialRow[]) {
  const month = existing.filter((e) => e.event_date.startsWith(`${cohort}-`));
  const published = month.filter((e) => e.published !== false);
  const locked = new Set(published.map((e) => e.event_date));
  const byDate = new Map<string, string>();
  for (const p of picks) if (specialInMonth(p.date, cohort) && !locked.has(p.date) && p.title.trim()) byDate.set(p.date, p.title.trim().slice(0, 60));
  const want = [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, title]) => ({ date, title }));
  const used = new Set<string>();
  const create: (SpecialPick & { starts_at: string; ends_at: string | null })[] = [];
  const move: { id: string; date: string; title?: string; starts_at?: string; ends_at?: string | null }[] = [];
  const pending: SpecialPick[] = [];
  for (const p of want) {
    const here = month.find((e) => e.published === false && e.event_date === p.date && !used.has(e.id));
    if (!here) { pending.push(p); continue; }
    used.add(here.id);
    if (here.title !== p.title) { const t = specialTimes(p.title); move.push({ id: here.id, date: p.date, title: p.title, starts_at: t.starts_at, ends_at: t.ends_at }); }
  }
  const drafts = month.filter((e) => e.published === false && !used.has(e.id));
  for (const p of pending) {
    const same = drafts.find((e) => e.title === p.title && !used.has(e.id));
    const draft = same ?? drafts.find((e) => !used.has(e.id));
    const t = specialTimes(p.title);
    if (draft) {
      used.add(draft.id);
      move.push(same ? { id: draft.id, date: p.date } : { id: draft.id, date: p.date, title: p.title, starts_at: t.starts_at, ends_at: t.ends_at });
    } else create.push({ ...p, starts_at: t.starts_at, ends_at: t.ends_at });
  }
  const remove = drafts.filter((e) => !used.has(e.id)).map((e) => e.id);
  const all = [...published.map((e) => ({ date: e.event_date, title: e.title })), ...want].sort((a, b) => a.date.localeCompare(b.date));
  return { picks: all, create, move, remove };
}
