// ── 종강일 자동 연장 공지 (공지 표에 쓰지 않고 코드로 만들어요) ──
// 학생 종강일 당일 00:00 ~ 열람 마감일까지, 그 기수 납부 완료 학생에게. '확인했어요'는 기기에 기수별로 저장.
import type { Kind } from "./config";
import type { Notice } from "./notices";
import { courseEndPopupOpen, dayLabelKo } from "./viewWindow";
import { shiftMonth } from "./signupMonths";

export const COURSE_END_PREFIX = "course-end:";

export type CourseEndInput = { cohort: string; end: string; until: string; kind: Kind; hasNext: boolean };

export function courseEndNotices(list: CourseEndInput[], today: string): Notice[] {
  return list.filter((x) => courseEndPopupOpen(x.end, x.until, today)).map((x) => {
    const mon = Number(x.cohort.slice(5, 7));
    const next = Number(shiftMonth(x.cohort, 1).slice(5, 7));
    const until = dayLabelKo(x.until);
    return {
      id: `${COURSE_END_PREFIX}${x.cohort}`,
      title: `🎁 종강 기념! ${mon}월 강의를 ${until}까지 열어 둘게요`,
      to_label: `${mon}월 수강생 안내`,
      lead: `한 달 동안 수고 많았어요 :) 놓친 강의와 특강은 **${until}까지** 강의실 📚 지난 강의와 특강 페이지에서 다시 볼 수 있어요.`,
      sections: x.hasNext ? [] : [{ icon: "☁️", title: `${next}월 수업도 함께해요!`, body: `${next}월 수강 신청을 하면 다음 달에도 강의실에서 함께해요.` }],
      link_label: x.hasNext ? null : `${next}월 수강 신청하기`,
      link_url: x.hasNext ? null : `/guide/${x.kind}`,
      targets: [],
      starts_on: today,
      ends_on: x.until,
      popup: true,
      pinned: true,
      created_at: `${today}T00:00:00.000Z`,
    } satisfies Notice;
  });
}
