import "server-only";
// ── 일정표 불러오기·저장 (규칙은 lib/timetable.ts) ──
// 저장 = 7개 반 수업일 + 그 기수 공휴일(자동) + 특강(날짜·종류, special_dates:기수). 특강은 공개 전 초안만 이름 바꾸고·옮기고·만들고·지워요.
import { createSpecialLecture, deleteSpecialLecture, getSetting, listCohortApplications, listSpecialLectures, listSpecialMaterials, listSpecialRegistrations, setSetting, updateSpecialLecture } from "./db";
import { isActive } from "./access";
import { SCHEDULE_CLASSES, holidayKey, parseHolidays, scheduleClassFor, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";
import { classDaysFromMarks, holidaysFor, marksFromDays, mismatchedClasses, planSpecialSync, type Marks, type SpecialPick } from "./timetable";
import { weekdayKey } from "./specialDrafts";

const KEYS = Object.keys(SCHEDULE_CLASSES) as ScheduleClass[];
export const specialDatesKey = (cohort: string) => `special_dates:${cohort}`;
export const timetableSavedKey = (cohort: string) => `timetable_saved:${cohort}`;

export async function loadTimetable(cohort: string) {
  const [raws, rawHolidays, savedAt, specials] = await Promise.all([
    Promise.all(KEYS.map((k) => getSetting(scheduleKey(cohort, k)))),
    getSetting(holidayKey(cohort)),
    getSetting(timetableSavedKey(cohort)),
    listSpecialLectures(),
  ]);
  const saved = rawHolidays ? parseHolidays(rawHolidays, cohort) : {};
  // 저장값을 읽을 때 빼는 공휴일 = 지금 강의실이 쓰는 값(저장한 공휴일, 없으면 기본값)과 같게
  const stored = Object.fromEntries(KEYS.map((k, i) => [k, schoolDaysFor(raws[i], cohort, k)])) as Record<ScheduleClass, string[]>;
  const active = rawHolidays ? saved : holidaysFor(cohort, {}, {});
  const days = Object.fromEntries(KEYS.map((k) => [k, stored[k].filter((d) => !active[d]).sort()])) as Record<ScheduleClass, string[]>;
  const marks = marksFromDays(days["start-all"], days["start-mw"], days["start-tt"]);
  return {
    marks,
    savedHolidays: saved, // 예전에 저장한 공휴일 (대한민국 공휴일 표와 합쳐서 보여줘요)
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

// 특강 초안을 고른 날짜·종류에 맞춰요. 자료·영상·신청이 있는 초안은 지우지 않아요.
export async function applySpecials(cohort: string, picks: SpecialPick[]) {
  const plan = planSpecialSync(cohort, picks, await listSpecialLectures());
  for (const c of plan.create) await createSpecialLecture({ event_date: c.date, title: c.title, starts_at: c.starts_at, ends_at: c.ends_at, registration_deadline: null, published: false });
  for (const m of plan.move) {
    const { id, date, ...rest } = m;
    await updateSpecialLecture(id, { event_date: date, ...rest });
  }
  let kept = 0;
  for (const id of plan.remove) {
    const [materials, regs, all] = await Promise.all([listSpecialMaterials(id), listSpecialRegistrations(id), listSpecialLectures()]);
    if (materials.length || regs.length || all.find((e) => e.id === id)?.youtube_id) kept++;
    else await deleteSpecialLecture(id);
  }
  return { ...plan, kept };
}

export async function saveTimetableData(cohort: string, marks: Marks, picks: SpecialPick[]) {
  const rawHolidays = await getSetting(holidayKey(cohort));
  // 공휴일은 자동: 범위 안 대한민국 공휴일 + 예전에 저장한 공휴일, 수업을 넣은 날은 빼요
  // (저장은 그 달 + 앞뒤 달로 걸친 수업 기간 안의 공휴일만 — 다음 달 공휴일 때문에 '공휴일 있는 달'로 보이지 않게)
  const days = classDaysFromMarks(marks);
  const [first, last] = [days["start-all"][0], days["start-all"].at(-1)];
  const holidays = Object.fromEntries(Object.entries(holidaysFor(cohort, rawHolidays ? parseHolidays(rawHolidays, cohort) : {}, marks))
    .filter(([d]) => d.startsWith(`${cohort}-`) || (first && last && d >= first && d <= last)));
  await Promise.all([
    ...KEYS.map((k) => setSetting(scheduleKey(cohort, k), JSON.stringify(days[k]))),
    setSetting(holidayKey(cohort), JSON.stringify(holidays)),
  ]);
  const result = await applySpecials(cohort, picks);
  await setSetting(specialDatesKey(cohort), JSON.stringify(result.picks));
  // 예전 '특강 요일' 설정도 맞춰 둬요 (이번 달 할 일 · 미리보기가 같은 요일을 봐요)
  const w = result.picks.length ? new Date(`${result.picks[0].date}T00:00:00Z`).getUTCDay() : null;
  if (w === 5 || w === 6) await setSetting(weekdayKey(cohort), String(w));
  await setSetting(timetableSavedKey(cohort), new Date().toISOString());
  return { ...result, holidays };
}
