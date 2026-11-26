// ── [강의 관리] '오늘 수업 링크' 판: 시간표 6칸에 링크만 붙이면 반·RC/LC·오전/저녁이 자동으로 정해져요 ──
// 평달 시간표 (CLAUDE.md '수업 운영'):
//   오전 10:00 시작반 RC → 11:10 LC 공통 → 12:20 문풀반 RC
//   저녁 18:00 문풀반 RC → 19:10 LC 공통 → 20:20 시작반 RC
// LC 공통은 시작반·문풀반 두 곳에 같은 링크로 올라가요 (속성반은 두 반 강의를 다 봐요, lib/access.ts covers).
// 자동 테스트: tests/lecture-board.test.ts
import type { CourseId, Part, TimeSlot } from "./config";

export type BoardRow = {
  id: string; // 폼 칸 이름 (link_<id>)
  slot: TimeSlot;
  from: string;
  to: string;
  courses: ("start" | "solve")[];
  part: Part;
  label: string; // 예: "시작반 RC"
};

export const BOARD_ROWS: BoardRow[] = [
  { id: "am-start-rc", slot: "am", from: "10:00", to: "11:00", courses: ["start"], part: "rc", label: "시작반 RC" },
  { id: "am-lc", slot: "am", from: "11:10", to: "12:10", courses: ["start", "solve"], part: "lc", label: "LC 공통" },
  { id: "am-solve-rc", slot: "am", from: "12:20", to: "13:20", courses: ["solve"], part: "rc", label: "문풀반 RC" },
  { id: "pm-solve-rc", slot: "pm", from: "18:00", to: "19:00", courses: ["solve"], part: "rc", label: "문풀반 RC" },
  { id: "pm-lc", slot: "pm", from: "19:10", to: "20:10", courses: ["start", "solve"], part: "lc", label: "LC 공통" },
  { id: "pm-start-rc", slot: "pm", from: "20:20", to: "21:20", courses: ["start"], part: "rc", label: "시작반 RC" },
];

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
// "2026-12-03" → "12/3(목)"
export function dateLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${WEEK[w]})`;
}

// 회차: 그 반(종합반) 수업일 중 몇 번째인지. 수업일이 아니면 null
export function sessionNo(days: string[], date: string): number | null {
  const i = days.indexOf(date);
  return i >= 0 ? i + 1 : null;
}

// 기본 제목 예: "3회 · 12/3(목) 시작반 RC · 오전반" (회차를 모르면 날짜만)
export function defaultTitle(row: BoardRow, date: string, no: number | null) {
  return `${no ? `${no}회 · ` : ""}${dateLabel(date)} ${row.label} · ${row.slot === "am" ? "오전반" : "저녁반"}`;
}

// 칸 하나가 올라갈 곳 (LC 공통은 두 반)
export function targetsOf(row: BoardRow): { course: CourseId; part: Part; slot: TimeSlot }[] {
  return row.courses.map((course) => ({ course, part: row.part, slot: row.slot }));
}

// 한국 시각 날짜 (YYYY-MM-DD)
export const kstDate = (iso: string) => new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 10);

type L = { cohort: string; course: CourseId; part: Part; slot: TimeSlot | null; title: string; created_at: string; youtube_id: string };
// 그 날짜에 이미 올린 칸: 같은 기수·반·RC/LC·시간대 강의 중 제목에 그 날짜가 있거나 그날(한국 시각) 올린 것
// LC 공통은 두 반 중 한 곳만 있어도 올린 것으로 봐요 (다른 반에 빠진 곳은 missing으로 알려 줘요)
export function rowStatus(row: BoardRow, lectures: L[], cohort: string, date: string) {
  const label = dateLabel(date);
  const found = targetsOf(row).map((t) =>
    lectures
      .filter((l) => l.cohort === cohort && l.course === t.course && l.part === t.part && l.slot === t.slot && (l.title.includes(label) || kstDate(l.created_at) === date))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
  );
  const done = found.filter((x): x is L => !!x);
  return {
    done: done.length > 0,
    youtubeId: done[0]?.youtube_id ?? null,
    missing: done.length > 0 ? targetsOf(row).filter((_, i) => !found[i]).map((t) => t.course) : [],
  };
}

// 지금 수업 중이거나 10분 안에 시작하는 칸 (관리 화면에서 '지금' 표시)
export function liveRowId(nowHHMM: string): string | null {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const n = toMin(nowHHMM);
  return BOARD_ROWS.find((r) => n >= toMin(r.from) - 10 && n <= toMin(r.to))?.id ?? null;
}
