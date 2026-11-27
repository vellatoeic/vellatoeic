import "server-only";
// ── 개강 전 학생 (2026-11-27 Vella) ──
// 12월 불라방 학생은 11월 중순~말에 미리 수강증·교재 신청을 해요. 그때 지난달(11월) 안내를 보고 단톡방에 먼저 들어가거나 헷갈리지 않게:
// ① 단톡방 카드(링크·참여코드)는 학생 반 개강 전날부터 보여주고, 그 전에는 '○일부터 열려요'만
// ② 개강 전 학생의 강의실·홈 맨 위에 '○월 수업 준비 중' 카드(개강일·지금 할 일)
// 개강일 = 학생 반 첫 수업일(lib/classCalendar, [일정표] 기준). 자동 테스트: tests/pre-course.test.ts
import { todayKST } from "./config";
import type { Application } from "./db";
import { canWatch, isActive } from "./access";
import { classDaysOf } from "./classCalendar";
import { shiftMonth } from "./signupMonths";

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const CHAT_OPEN_DAYS_BEFORE = 1; // 개강 전날부터

// 단톡방 카드: 대상 신청(이번 달·다음 달 납부 완료)마다 반 첫 수업일. 하나라도 '개강 전날'이 지났으면 열림, 아니면 가장 빠른 여는 날
export type ChatGate = { open: true } | { open: false; opensOn: string } | null;
export function chatGate(firsts: (string | null)[], today: string): ChatGate {
  if (firsts.length === 0) return null;
  if (firsts.some((f) => !f || today >= addDays(f, -CHAT_OPEN_DAYS_BEFORE))) return { open: true }; // 수업일을 모르면 막지 않아요
  return { open: false, opensOn: firsts.map((f) => addDays(f!, -CHAT_OPEN_DAYS_BEFORE)).sort()[0] };
}

export async function chatGateFor(apps: Application[], today = todayKST()): Promise<ChatGate> {
  const month = today.slice(0, 7);
  const targets = apps.filter((a) => canWatch(a) && (a.cohort === month || a.cohort === shiftMonth(month, 1)));
  return chatGate(await Promise.all(targets.map(async (a) => (await classDaysOf(a))[0] ?? null)), today);
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
