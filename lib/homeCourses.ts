// 첫 화면 '○월 강좌 시간표' 카드
// 시간은 lib/config.ts KLASS_TIME(공개 시간표와 같은 값), 개강일은 [수업일 설정]에 저장한 수업일의 첫날이에요.
// 그래서 달마다 손으로 고칠 필요가 없어요. (예전 디자인의 '12월 강좌' 고정 문구 대신)
import { KLASS_TIME } from "./config";
import type { ScheduleClass } from "./schedule";

export type CourseGroup = "all" | "lc" | "rc" | "alt";
export type CourseCard = {
  group: CourseGroup;
  kind: string; // 종합반 · LC 단과 · RC 단과 · 격일반
  level: string; // 650+ · 750+ · 실전속성
  goal: string; // 650 목표 · 750 목표 · 개념+실전
  days: string; // 월~목 · 월수 · 화목
  count: string; // 월16회 · 월8회
  months: 1 | 2;
  times: [string, string]; // 오전반 · 저녁반
  klass: ScheduleClass; // 개강일을 찾을 반
};

const range = (s: { from: string; to: string }) => `${s.from}~${s.to}`;
const [startAm, startPm] = KLASS_TIME["start-daily"];
const [solveAm, solvePm] = KLASS_TIME["solve-daily"];
const [fastAm, fastPm] = KLASS_TIME["intensive-daily"];
const [lcAm, lcPm] = KLASS_TIME["lc-common"];
// RC 단과 시간 (config의 시작반·문풀반 시간표 안 RC 시간과 같아요)
const START_RC: [string, string] = ["10:00~11:00", "20:20~21:20"];
const SOLVE_RC: [string, string] = ["12:20~13:20", "18:00~19:00"];

export const COURSE_CARDS: CourseCard[] = [
  { group: "all", kind: "종합반", level: "실전속성", goal: "개념+실전 한 번에", days: "월~목", count: "월16회", months: 1, times: [range(fastAm), range(fastPm)], klass: "intensive-all" },
  { group: "all", kind: "종합반", level: "750+", goal: "750 목표", days: "월~목", count: "월16회", months: 1, times: [range(solveAm), range(solvePm)], klass: "solve-all" },
  { group: "all", kind: "종합반", level: "650+", goal: "650 목표", days: "월~목", count: "월16회", months: 1, times: [range(startAm), range(startPm)], klass: "start-all" },
  { group: "lc", kind: "LC 단과", level: "650+ · 750+", goal: "LC 공통 수업", days: "월~목", count: "월16회", months: 1, times: [range(lcAm), range(lcPm)], klass: "start-all" },
  { group: "rc", kind: "RC 단과", level: "750+", goal: "750 목표", days: "월~목", count: "월16회", months: 1, times: SOLVE_RC, klass: "solve-all" },
  { group: "rc", kind: "RC 단과", level: "650+", goal: "650 목표", days: "월~목", count: "월16회", months: 1, times: START_RC, klass: "start-all" },
  { group: "alt", kind: "격일반", level: "750+", goal: "750 목표", days: "월수", count: "월8회", months: 2, times: [range(solveAm), range(solvePm)], klass: "solve-mw" },
  { group: "alt", kind: "격일반", level: "750+", goal: "750 목표", days: "화목", count: "월8회", months: 2, times: [range(solveAm), range(solvePm)], klass: "solve-tt" },
  { group: "alt", kind: "격일반", level: "650+", goal: "650 목표", days: "월수", count: "월8회", months: 2, times: [range(startAm), range(startPm)], klass: "start-mw" },
  { group: "alt", kind: "격일반", level: "650+", goal: "650 목표", days: "화목", count: "월8회", months: 2, times: [range(startAm), range(startPm)], klass: "start-tt" },
];

// 예: 2026-12-01 → '12월 1일(화)'
export function startLabel(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const [y, m, d] = day.split("-").map(Number);
  return `${m}월 ${d}일(${"일월화수목금토"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}
