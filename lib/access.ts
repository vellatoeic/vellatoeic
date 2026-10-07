import "server-only";
import { TRACK_PARTS, type TimeSlot } from "./config";
import type { Application, LcAudio, Lecture } from "./db";

// ── 열람 권한은 모두 여기서 판단해요 (자동 테스트: tests/access.test.ts) ──
// 시간대(오전/저녁)로는 막지 않아요. 같은 반 수업은 오전·저녁 교차 수강이 가능해요.

// 환불·삭제된 신청은 로그인부터 막아요.
export const isActive = (a: Application) => a.status !== "refunded";

// 납부가 확인된 신청만 강의실 이용 가능 (입금 대기·환불 X)
export const canWatch = (a: Application) => a.status === "paid" || a.status === "shipped";

// 이 신청으로 볼 수 있는 강의인지: 같은 기수 + 같은 반(속성반은 시작·문풀 모두) + 수강 과목(RC/LC)
export function covers(a: Application, l: Lecture) {
  const courseAccess = a.course === l.course || (a.course === "intensive" && (l.course === "start" || l.course === "solve"));
  return canWatch(a) && a.cohort === l.cohort && courseAccess && TRACK_PARTS[a.track].includes(l.part);
}

// 강의 주소(/class/강의id)로 바로 들어와도 이 판단으로 막아요.
export function canOpenLecture(apps: Application[], lecture: Lecture | null) {
  return !!lecture && apps.some((a) => covers(a, lecture));
}

// 라이브 입장 버튼이 연결할 링크: 이 신청이 볼 수 있는 강의 중 고른 시간대(또는 구분 없는) 가장 최근 것
export function liveLinkFor(a: Application, lectures: Lecture[], slot: TimeSlot) {
  return lectures
    .filter((l) => covers(a, l) && (!l.slot || l.slot === slot))
    .sort((x, y) => y.created_at.localeCompare(x.created_at))[0] ?? null;
}

// 신청 교재에 들어 있는 LC 교재 (RC 단과는 없어서 음원도 안 보여요)
export function audioBooksFor(a: Application): LcAudio["book"][] {
  return canWatch(a) ? a.books.filter((b): b is LcAudio["book"] => b === "lc1" || b === "lc2") : [];
}

// LC 음원을 받을 수 있는지: 같은 기수 + 신청 교재에 그 LC 교재 + 본인 반 다운로드 기간 안
export function canDownloadAudio(
  apps: Application[],
  audio: LcAudio,
  periodOf: (a: Application) => { start: string; end: string } | null,
  today: string,
) {
  return apps.some((a) => {
    if (a.cohort !== audio.cohort || !audioBooksFor(a).includes(audio.book)) return false;
    const p = periodOf(a);
    return !!p && today >= p.start && today <= p.end;
  });
}

// 로그인: 이름·비밀번호가 맞는 신청 중 환불되지 않은 것만. 없으면 안내 문구를 돌려줘요.
export function loginApps(found: Application[], pinMatches: (a: Application) => boolean) {
  const matched = found.filter(pinMatches);
  const active = matched.filter(isActive);
  if (active.length > 0) return { apps: active };
  if (found.length === 0 || matched.length > 0) return { error: "수강 정보가 없어요. Vella쌤에게 문의해 주세요." };
  return { error: "이름 또는 비밀번호가 맞지 않아요." };
}
