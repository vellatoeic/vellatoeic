import "server-only";
import { createSpecialLecture, getSetting, listSpecialLectures, updateSpecialLecture } from "./db";
import { holidaysOf } from "./classCalendar";
import { scheduleKey, schoolDaysFor } from "./schedule";
import { SPECIAL_SLOTS, specialDatesFor, type SpecialWeekday } from "./specialPlan";

export const weekdayKey = (cohort: string) => `special_weekday:${cohort}`;

export async function specialWeekday(cohort: string): Promise<SpecialWeekday | null> {
  const v = await getSetting(weekdayKey(cohort));
  return v === "5" ? 5 : v === "6" ? 6 : null;
}

// 개강일 = 시작반 종합반 첫 수업일(공휴일 제외)
export async function openingDay(cohort: string) {
  const [raw, holidays] = await Promise.all([getSetting(scheduleKey(cohort, "start-all")), holidaysOf(cohort)]);
  return schoolDaysFor(raw, cohort, "start-all").filter((d) => !holidays[d]).sort()[0] ?? null;
}

// 미리보기: 1차·2차 날짜와 공휴일 여부
export async function specialPreview(cohort: string) {
  const [weekday, first, holidays] = await Promise.all([specialWeekday(cohort), openingDay(cohort), holidaysOf(cohort)]);
  if (!weekday || !first) return { weekday, dates: [] as { date: string; holiday: string | null; title: string }[] };
  const dates = specialDatesFor(first, weekday);
  return { weekday, dates: dates.map((date, i) => ({ date, holiday: holidays[date] ?? null, title: SPECIAL_SLOTS[i].title })) };
}

// 초안 만들기·맞추기: 같은 날짜 특강이 있거나 같은 제목 공개 특강이 그 달에 있으면 만들지 않아요.
// 요일을 바꾸면 공개 전 초안만 날짜를 옮겨요.
export async function syncSpecialDrafts(cohort: string) {
  const weekday = await specialWeekday(cohort);
  const first = await openingDay(cohort);
  if (!weekday || !first) return { created: 0, moved: 0 };
  const dates = specialDatesFor(first, weekday);
  const all = await listSpecialLectures();
  let created = 0, moved = 0;
  for (const [i, slot] of SPECIAL_SLOTS.entries()) {
    const date = dates[i];
    const inMonth = all.filter((e) => e.event_date.startsWith(cohort));
    if (all.some((e) => e.event_date === date)) continue;
    if (inMonth.some((e) => e.published !== false && e.title === slot.title)) continue;
    const draft = inMonth.find((e) => e.published === false && e.title === slot.title);
    if (draft) {
      await updateSpecialLecture(draft.id, { event_date: date });
      moved++;
    } else {
      await createSpecialLecture({ event_date: date, title: slot.title, starts_at: slot.starts_at, ends_at: slot.ends_at, registration_deadline: null, published: false });
      created++;
    }
  }
  return { created, moved };
}
