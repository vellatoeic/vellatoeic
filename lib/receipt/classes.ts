// ── 수강증 반 대조용 반 목록 (DB 없이 lib/config에서 만들어요) ──
// 키트(match.ts)는 '열린 반' 목록을 받아 레벨·속성반·종합/단과·시간·요일·수강월이 딱 맞는 반 하나를 골라요.
// 우리 반은 기수 × 반(시작·문풀·속성) × 과정(종합·RC·LC·격일 월수·화목) × 시간(오전·저녁)이라 매달 SQL로 넣지 않고 여기서 만들어요.
import { COURSES, KLASS_TIME, SINGLE_TIME, TIME_SLOTS, TRACKS, klassOf, type CourseId, type TimeSlot, type Track as ApplyTrack } from "../config";
import type { Section } from "./match";
import type { Kind, Track } from "./receipt";

export type ReceiptClass = { cohort: string; course: CourseId; track: ApplyTrack; slot: TimeSlot };

const SLOTS: TimeSlot[] = ["am", "pm"];

// 예: "12월 시작반 주 4일(종합반) · 오전반"
export const classText = (c: Pick<ReceiptClass, "cohort" | "course" | "track" | "slot">) =>
  `${Number(c.cohort.slice(5, 7))}월 ${COURSES[c.course].label} ${TRACKS[c.track]} · ${TIME_SLOTS[c.slot]}`;

// 수강증의 레벨 표기 (YBM '650+반'·'750+반'·'실전속성') ↔ 우리 반 이름
export const LEVEL_TAG: Record<CourseId, string> = { start: "650+", solve: "750+", intensive: "750+" };
// 예: "12월 시작반 650+ · 주 4일(종합반) · 오전반" (수강증 인식 결과 화면에서 우리 반 이름과 레벨을 함께 보여줘요)
export const classTextWithLevel = (c: Pick<ReceiptClass, "cohort" | "course" | "track" | "slot">) =>
  `${Number(c.cohort.slice(5, 7))}월 ${COURSES[c.course].label} ${LEVEL_TAG[c.course]} · ${TRACKS[c.track]} · ${TIME_SLOTS[c.slot]}`;

// YBM 강좌 시간 (예: 시작반 종합 오전 10:00~12:10, 문풀반 RC 저녁 18:00~19:00)
export function timeBlockOf(c: { course: CourseId; track: ApplyTrack }, slot: TimeSlot): string {
  const i = slot === "am" ? 0 : 1;
  if ((c.track === "rc" || c.track === "lc") && c.course !== "intensive") return SINGLE_TIME[c.course][c.track][i];
  const s = KLASS_TIME[klassOf(c)][i];
  return `${s.from}~${s.to}`;
}

const kindOf = (t: ApplyTrack): Kind => (t === "rc" ? "rc" : t === "lc" ? "lc" : "full");
const trackOf = (t: ApplyTrack): Track => (t === "alt_mw" ? "mw" : t === "alt_tt" ? "tt" : "w4");

export const sectionId = (c: ReceiptClass) => `${c.cohort}|${c.course}|${c.track}|${c.slot}`;

export function classOfSection(id: string): ReceiptClass | null {
  const [cohort, course, track, slot] = id.split("|");
  if (!/^\d{4}-\d{2}$/.test(cohort) || !(course in COURSES) || !COURSES[course as CourseId].tracks.includes(track as ApplyTrack) || (slot !== "am" && slot !== "pm")) return null;
  return { cohort, course: course as CourseId, track: track as ApplyTrack, slot };
}

// 신청을 받는 달들의 모든 반 (요일 미지정 'alt'는 새로 고를 수 없어서 빼요)
// open: [일정표]에 그 반 수업일이 있는지 (없는 반은 수강증이 그 반으로 맞춰지지 않아요)
export function sectionsFor(cohorts: readonly string[], open: (c: ReceiptClass) => boolean = () => true): Section[] {
  const out: Section[] = [];
  for (const cohort of cohorts) {
    for (const course of Object.keys(COURSES) as CourseId[]) {
      for (const track of COURSES[course].tracks) {
        if (track === "alt") continue;
        for (const slot of SLOTS) {
          if (!open({ cohort, course, track, slot })) continue;
          out.push({
            id: sectionId({ cohort, course, track, slot }),
            term: cohort,
            kind: kindOf(track),
            level: course === "start" ? 650 : 750,
            program: course === "intensive" ? "premier" : "score",
            track: trackOf(track),
            timeBlock: timeBlockOf({ course, track }, slot),
          });
        }
      }
    }
  }
  return out;
}
