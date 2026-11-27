// ── 일정표 (강사가 한 달 수업을 한 장에, 2026-11-27 Vella) ──
// 날짜마다 월수반(mw) 또는 화목반(tt). 주 4일반(종합·단과·속성) = 월수반 + 화목반 전부, 격일반은 자기 칸만.
// 저장하면 7개 반 수업일(settings schooldays_기수_반)·공휴일·특강 날짜가 한 번에 바뀌어서
// 강의실·라이브·출석·숙제·음원·열람 기간·수강증 반 대조가 모두 이 일정표를 따라가요(기준선).
// 개강일 = 첫 수업일, 종강일 = 마지막 수업일. DB 없이 계산해요. 자동 테스트: tests/timetable.test.ts
import { SCHEDULE_CLASSES, type ScheduleClass } from "./schedule";
import { SPECIAL_SLOTS } from "./specialPlan";

export type DayMark = "mw" | "tt";
export type Marks = Record<string, DayMark>;
export const MARK_LABEL: Record<DayMark, string> = { mw: "월수반", tt: "화목반" };
export const SPECIAL_MAX = 2; // 특강은 한 달에 두 번

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay(); // 일 0 ~ 토 6
const inMonth = (day: string, cohort: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && day.startsWith(`${cohort}-`);

// 개강일부터 자동 채우기: 주마다 월~금 중 공휴일을 뺀 앞 4일(보통 월~목, 공휴일 주·주 중간 개강 주는 금요일까지),
// 순서대로 월수반 → 화목반을 번갈아요 (12월: 12/1(화) 월수 · 12/2(수) 화목 · 12/3(목) 월수 · 12/4(금) 화목 = 회차 기준).
// 종강일을 주면 그날까지, 없으면 16회까지.
export function autoFill(cohort: string, start: string, holidays: Record<string, string>, end?: string | null, sessions = 16): Marks {
  const out: Marks = {};
  if (!inMonth(start, cohort) || (end && end < start)) return out;
  let n = 0;
  let week = "";
  let inWeek = 0;
  for (let day = start; inMonth(day, cohort) && (end ? day <= end : n < sessions); day = addDays(day, 1)) {
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

// ── 특강: 일정표에서 고른 날짜 ↔ [특강 관리]의 특강 ──
export type SpecialRow = { id: string; event_date: string; title: string; starts_at?: string; ends_at?: string | null; published?: boolean | null };
export type SpecialSlot = { date: string; title: string; starts_at: string; ends_at: string | null };

// 고른 날짜 순서대로 1차 'PART 5 액기스 특강' · 2차 '적중 모의고사 + 풀이'
export const specialSlotsFor = (dates: string[]): SpecialSlot[] =>
  [...new Set(dates)].sort().map((date, i) => {
    const s = SPECIAL_SLOTS[i] ?? { title: "특강", starts_at: "10:00", ends_at: null };
    return { date, title: s.title, starts_at: s.starts_at, ends_at: s.ends_at };
  });

// 저장할 때 할 일: 공개한 특강은 그대로(날짜도 일정표에 늘 포함), 공개 전 초안만 옮기고·만들고·지워요.
export function planSpecialSync(cohort: string, wanted: string[], existing: SpecialRow[]) {
  const month = existing.filter((e) => e.event_date.startsWith(`${cohort}-`));
  const published = month.filter((e) => e.published !== false);
  const dates = [...new Set([...wanted.filter((d) => inMonth(d, cohort)), ...published.map((e) => e.event_date)])].sort();
  const slots = specialSlotsFor(dates);
  const used = new Set<string>();
  const create: SpecialSlot[] = [];
  const move: (SpecialSlot & { id: string })[] = [];
  const pending: SpecialSlot[] = [];
  for (const slot of slots) {
    const here = month.find((e) => e.event_date === slot.date && !used.has(e.id));
    if (!here) { pending.push(slot); continue; }
    used.add(here.id);
    if (here.published === false && here.title !== slot.title) move.push({ ...slot, id: here.id }); // 순서가 바뀐 초안은 제목만 맞춰요
  }
  const drafts = month.filter((e) => e.published === false && !used.has(e.id));
  for (const slot of pending) {
    const draft = drafts.find((e) => e.title === slot.title && !used.has(e.id)) ?? drafts.find((e) => !used.has(e.id));
    if (draft) {
      used.add(draft.id);
      move.push({ ...slot, id: draft.id });
    } else create.push(slot);
  }
  const remove = drafts.filter((e) => !used.has(e.id)).map((e) => e.id);
  return { dates, create, move, remove };
}
