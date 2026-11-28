import "server-only";
// ── 개강 전 학생 · 달별 단톡방 (2026-11-27~28 Vella) ──
// 12월 불라방 학생은 11월 중순~말에 미리 수강증·교재 신청을 해요. 그때 지난달(11월) 안내를 보고 단톡방에 먼저 들어가거나 헷갈리지 않게:
// ① 단톡방은 달마다 새로 열어요(settings chat_url:기수 · chat_code:기수). 학생은 자기 수강 달의 방만,
//    그 반 개강 전날부터 그 달 열람 마감일(다음 달 개강 전날)까지 보여요. 그 전에는 '○일부터 열려요'만.
//    두 달 신청(11월 → 12월 이어 듣는 학생)은 기간 안인 가장 최근 달 방(링크가 아직 없으면 그 전 달 방).
// ② 개강 전 학생의 강의실·홈 맨 위에 '○월 수업 준비 중' 카드(개강일·지금 할 일)
// 개강일 = 학생 반 첫 수업일(lib/classCalendar, [일정표] 기준). 자동 테스트: tests/pre-course.test.ts
import { todayKST } from "./config";
import { getSetting, type Application } from "./db";
import { canWatch, isActive } from "./access";
import { classDaysOf } from "./classCalendar";
import { cohortUntil } from "./viewWindowServer";

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const CHAT_OPEN_DAYS_BEFORE = 1; // 개강 전날부터
export const chatUrlKey = (cohort: string) => `chat_url:${cohort}`;
export const chatCodeKey = (cohort: string) => `chat_code:${cohort}`;

// 기수마다 { 반 첫 수업일, 열람 마감일, 링크가 있는지 } → 지금 보여줄 방
export type ChatRow = { cohort: string; first: string | null; until: string | null; hasLink: boolean };
export type ChatPick = { cohort: string; open: true } | { cohort: string; open: false; opensOn: string } | null;
export function pickChat(rows: ChatRow[], today: string): ChatPick {
  const openRows = rows
    .filter((r) => (!r.first || today >= addDays(r.first, -CHAT_OPEN_DAYS_BEFORE)) && (!r.until || today <= r.until) && (r.first || r.until))
    .sort((a, b) => b.cohort.localeCompare(a.cohort));
  if (openRows.length) return { cohort: (openRows.find((r) => r.hasLink) ?? openRows[0]).cohort, open: true };
  const soon = rows.filter((r) => r.first && today < addDays(r.first, -CHAT_OPEN_DAYS_BEFORE)).sort((a, b) => a.first!.localeCompare(b.first!))[0];
  return soon ? { cohort: soon.cohort, open: false, opensOn: addDays(soon.first!, -CHAT_OPEN_DAYS_BEFORE) } : null;
}

// open = 링크·코드 / soon = '○일부터' / waiting = 기간인데 그 달 링크를 아직 안 넣음 / null = 납부 완료 신청 없음
export type ChatRoom =
  | { state: "open"; cohort: string; url: string; code: string }
  | { state: "soon"; cohort: string; opensOn: string }
  | { state: "waiting"; cohort: string }
  | null;

export async function chatRoomFor(apps: Application[], today = todayKST()): Promise<ChatRoom> {
  const paid = apps.filter(canWatch);
  const cohorts = [...new Set(paid.map((a) => a.cohort))];
  const rows = await Promise.all(cohorts.map(async (cohort) => {
    const firsts = (await Promise.all(paid.filter((a) => a.cohort === cohort).map(async (a) => (await classDaysOf(a))[0] ?? null))).filter((d): d is string => !!d).sort();
    const [until, url] = await Promise.all([cohortUntil(cohort).catch(() => null), getSetting(chatUrlKey(cohort))]);
    return { cohort, first: firsts[0] ?? null, until, hasLink: !!url };
  }));
  const pick = pickChat(rows, today);
  if (!pick) return null;
  if (!pick.open) return { state: "soon", cohort: pick.cohort, opensOn: pick.opensOn };
  const [url, code] = await Promise.all([getSetting(chatUrlKey(pick.cohort)), getSetting(chatCodeKey(pick.cohort))]);
  return url ? { state: "open", cohort: pick.cohort, url, code } : { state: "waiting", cohort: pick.cohort };
}

// 개강 전 학생: 지금 수업 중인 신청이 없고(오늘이 어느 신청의 첫~마지막 수업일 안도 아님) 다가오는 신청이 있으면 가장 빠른 것
export type PreCourse = { app: Application; first: string; dStart: number };
export function pickPreCourse<A extends { id: string }>(rows: { app: A; days: string[] }[], today: string): { app: A; first: string; dStart: number } | null {
  if (rows.some((r) => r.days.length && r.days[0] <= today && today <= r.days.at(-1)!)) return null;
  const next = rows.filter((r) => r.days.length && r.days[0] > today).sort((x, y) => x.days[0].localeCompare(y.days[0]))[0];
  if (!next) return null;
  return { app: next.app, first: next.days[0], dStart: Math.round((Date.parse(`${next.days[0]}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) };
}

export async function preCourseFor(apps: Application[], today = todayKST()): Promise<PreCourse | null> {
  const rows = await Promise.all(apps.filter(isActive).map(async (app) => ({ app, days: [...(await classDaysOf(app))].sort() })));
  return pickPreCourse(rows, today);
}
