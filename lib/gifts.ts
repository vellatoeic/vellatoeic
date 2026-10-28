import "server-only";
import { COURSES, KINDS, TIME_SLOTS, TRACKS, todayKST } from "./config";
import { listApplications, listStamps, type Application } from "./db";
import { canWatch } from "./access";
import { classDaysOf, holidaysOf } from "./classCalendar";
import { studentDays } from "./studentDays";
import { boardStatus, giftEligibleTrack, type BoardStatus } from "./stickerComplete";

export type StudentBoard = { app: Application; status: BoardStatus; eligible: boolean };

export const klassText = (a: Application) => `${COURSES[a.course].label} ${TRACKS[a.track]}${a.slot ? ` · ${TIME_SLOTS[a.slot]}` : ""}`;
export const kindText = (a: Application) => KINDS[a.kind].short;

// 신청 여러 건의 스티커판 상태 (환불 제외, 중간 등록생은 신청 후 수업일 기준)
export async function boardsFor(apps: Application[], today = todayKST()): Promise<StudentBoard[]> {
  const targets = apps.filter(canWatch);
  if (targets.length === 0) return [];
  const { attendance, homework } = await listStamps(targets.map((a) => a.id));
  const cache = new Map<string, Promise<string[]>>();
  const daysOf = (a: Application) => {
    const k = `${a.cohort}|${a.course}|${a.track}`;
    if (!cache.has(k)) cache.set(k, Promise.all([classDaysOf(a), holidaysOf(a.cohort)]).then(([d, h]) => d.filter((x) => !h[x])));
    return cache.get(k)!;
  };
  return Promise.all(targets.map(async (app) => ({
    app,
    status: boardStatus(studentDays(await daysOf(app), app.created_at), attendance.filter((x) => x.app_id === app.id), homework.filter((x) => x.app_id === app.id), today),
    eligible: giftEligibleTrack(app.track),
  })));
}

export async function cohortBoards(cohort: string, today = todayKST()) {
  return boardsFor((await listApplications()).filter((a) => a.cohort === cohort), today);
}

// 학생 1명(같은 로그인) = 그 기수 본인 신청 중 가장 작은 id
export const studentKeyOf = (apps: Application[]) => [...apps].map((a) => a.id).sort()[0];

// 확인 코드: 헷갈리는 글자(0·O·1·I·L) 뺀 영문·숫자 4자리
export function giftCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
