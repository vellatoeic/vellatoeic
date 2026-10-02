import "server-only";
import { TRACK_PARTS } from "./config";
import type { Application, Lecture } from "./db";

// 납부가 확인된 신청만 강의실 이용 가능
export const canWatch = (a: Application) => a.status !== "pending";

// 이 신청으로 볼 수 있는 강의인지: 같은 기수 + 같은 반 + 수강 과목에 포함된 파트
export function covers(a: Application, l: Lecture) {
  return canWatch(a) && a.cohort === l.cohort && a.course === l.course && TRACK_PARTS[a.track].includes(l.part);
}
