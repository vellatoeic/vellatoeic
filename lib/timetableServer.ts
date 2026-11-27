import "server-only";
// ── 일정표 불러오기·저장 (규칙은 lib/timetable.ts) ──
// 저장 = 7개 반 수업일 + 그 기수 공휴일 + 특강 날짜(special_dates:기수)를 한 번에. 특강은 공개 전 초안만 옮기고 만들고 지워요.
import { createSpecialLecture, deleteSpecialLecture, getSetting, listCohortApplications, listSpecialLectures, listSpecialMaterials, listSpecialRegistrations, setSetting, updateSpecialLecture } from "./db";
import { isActive } from "./access";
import { krHolidaysOf } from "./krHolidays";
import { SCHEDULE_CLASSES, defaultHolidays, holidayKey, parseHolidays, scheduleClassFor, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";
import { classDaysFromMarks, marksFromDays, mismatchedClasses, planSpecialSync, type Marks } from "./timetable";
import { weekdayKey } from "./specialDrafts";

const KEYS = Object.keys(SCHEDULE_CLASSES) as ScheduleClass[];
export const specialDatesKey = (cohort: string) => `special_dates:${cohort}`;
export const timetableSavedKey = (cohort: string) => `timetable_saved:${cohort}`;

export function parseSpecialDates(raw: string, cohort: string): string[] | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d.startsWith(`${cohort}-`)))].sort() : null;
  } catch {
    return null;
  }
}

export async function loadTimetable(cohort: string) {
  const [raws, rawHolidays, savedAt, specials] = await Promise.all([
    Promise.all(KEYS.map((k) => getSetting(scheduleKey(cohort, k)))),
    getSetting(holidayKey(cohort)),
    getSetting(timetableSavedKey(cohort)),
    listSpecialLectures(),
  ]);
  const holidays = rawHolidays ? parseHolidays(rawHolidays, cohort) : defaultHolidays(cohort);
  const days = Object.fromEntries(KEYS.map((k, i) => [k, schoolDaysFor(raws[i], cohort, k).filter((d) => !holidays[d]).sort()])) as Record<ScheduleClass, string[]>;
  const marks = marksFromDays(days["start-all"], days["start-mw"], days["start-tt"]);
  return {
    marks,
    holidays,
    publicHolidays: krHolidaysOf(cohort), // 저장한 공휴일에 없으면 칸에 흐리게 '수업함'으로 보여요
    specials: specials
      .filter((e) => e.event_date.startsWith(`${cohort}-`))
      .map((e) => ({ id: e.id, date: e.event_date, title: e.title, starts_at: e.starts_at.slice(0, 5), ends_at: e.ends_at?.slice(0, 5) ?? null, published: e.published !== false })),
    mismatch: mismatchedClasses(days, marks),
    saved: raws.some(Boolean), // 하나도 저장 안 했으면 기본값(첫째 월요일부터)
    savedAt: savedAt || null,
  };
}

// 반편성 현황: 반마다 수업 횟수·기간·신청 인원(납부 완료·수강증 자동 확인)
export async function classRoster(cohort: string, marks: Marks) {
  const days = classDaysFromMarks(marks);
  const apps = (await listCohortApplications(cohort)).filter(isActive);
  return KEYS.map((k) => {
    const mine = apps.filter((a) => scheduleClassFor(a.course, a.track) === k);
    return {
      klass: k,
      label: SCHEDULE_CLASSES[k],
      count: days[k].length,
      first: days[k][0] ?? null,
      last: days[k].at(-1) ?? null,
      students: mine.length,
      paid: mine.filter((a) => a.status === "paid" || a.status === "shipped").length,
      receipt: mine.filter((a) => a.receipt_status === "auto" || a.receipt_status === "approved").length,
    };
  });
}

// 특강 초안을 고른 날짜에 맞춰요. 자료·영상·신청이 있는 초안은 지우지 않아요.
export async function applySpecialDates(cohort: string, wanted: string[]) {
  const plan = planSpecialSync(cohort, wanted, await listSpecialLectures());
  for (const c of plan.create) await createSpecialLecture({ event_date: c.date, title: c.title, starts_at: c.starts_at, ends_at: c.ends_at, registration_deadline: null, published: false });
  for (const m of plan.move) await updateSpecialLecture(m.id, { event_date: m.date, title: m.title, starts_at: m.starts_at, ends_at: m.ends_at });
  let kept = 0;
  for (const id of plan.remove) {
    const [materials, regs, all] = await Promise.all([listSpecialMaterials(id), listSpecialRegistrations(id), listSpecialLectures()]);
    if (materials.length || regs.length || all.find((e) => e.id === id)?.youtube_id) kept++;
    else await deleteSpecialLecture(id);
  }
  return { ...plan, kept };
}

export async function saveTimetableData(cohort: string, marks: Marks, holidays: Record<string, string>, specialDates: string[]) {
  const clean: Marks = Object.fromEntries(Object.entries(marks).filter(([d]) => !holidays[d]));
  const days = classDaysFromMarks(clean);
  await Promise.all([
    ...KEYS.map((k) => setSetting(scheduleKey(cohort, k), JSON.stringify(days[k]))),
    setSetting(holidayKey(cohort), JSON.stringify(holidays)),
  ]);
  const result = await applySpecialDates(cohort, specialDates);
  await setSetting(specialDatesKey(cohort), JSON.stringify(result.dates));
  // 예전 '특강 요일' 설정도 맞춰 둬요 (이번 달 할 일 · 미리보기가 같은 요일을 봐요)
  const w = result.dates.length ? new Date(`${result.dates[0]}T00:00:00Z`).getUTCDay() : null;
  if (w === 5 || w === 6) await setSetting(weekdayKey(cohort), String(w));
  await setSetting(timetableSavedKey(cohort), new Date().toISOString());
  return result;
}
