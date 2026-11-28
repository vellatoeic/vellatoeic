import { isOpened } from "./viewWindow";

// ── 학생 등급 (학생 명단, 2026-11-27 Vella) ──
// 날짜로 자동으로 바뀌어요(밤에 돌리는 작업 없이 화면을 열 때 계산). 한 학생이 두 등급일 수 있어요(예: 11월 수강생 + 12월 예비).
// · 수강생: 납부 완료 신청의 기수가 '개강일 오전 9시 ~ 열람 마감일(다음 달 개강 전날)' 안
// · 예비수강생: 개강일 오전 9시 전인 신청(입금 대기 포함), 또는 수업 중 기수에 낸 입금 대기 신청(중간 등록 · 30분 안 입금)
// · 일반: 위 둘 다 아님 (지난달 수강생은 다음 달 개강일 0시에 일반으로 바뀌어요 = 열람 마감일 다음 날)
// 환불·취소 신청은 등급에 넣지 않아요.

// prospect = 잠재 고객: 수강 신청 없이 특강(비수강생)으로 온 학생 (2026-11-28, 학생 명단에서만 붙여요)
export type Grade = "student" | "pre" | "general" | "prospect";
export const GRADE_LABEL: Record<Grade, string> = { student: "수강생", pre: "예비수강생", general: "일반", prospect: "잠재 고객" };

type AppLike = { cohort: string; status: string };
export type CohortWindow = { openAt: string | null; until: string };

export type GradeInfo = {
  grades: Grade[]; // 보여줄 순서: 수강생 → 예비수강생 (둘 다 아니면 일반)
  current: string[]; // 수강 중인 기수
  pre: { cohort: string; pending: boolean }[]; // 예비 기수 (pending = 입금 대기)
};

const paid = (s: string) => s === "paid" || s === "shipped";
const live = (s: string) => s !== "refunded" && s !== "cancelled";

export function gradeOf(apps: AppLike[], windows: Map<string, CohortWindow>, today: string, nowMs: number): GradeInfo {
  const current = new Set<string>();
  const pre = new Map<string, boolean>(); // 기수 → 모두 입금 대기인지
  for (const a of apps) {
    if (!live(a.status)) continue;
    const w = windows.get(a.cohort);
    if (!w || today > w.until) continue; // 열람 기간이 끝난 신청 → 일반 쪽
    const opened = isOpened(w.openAt, nowMs);
    if (opened && paid(a.status)) current.add(a.cohort);
    else if (!opened || a.status === "pending") pre.set(a.cohort, (pre.get(a.cohort) ?? true) && a.status === "pending");
  }
  for (const c of current) pre.delete(c); // 같은 기수에 납부 완료가 있으면 수강생만
  const grades: Grade[] = [];
  if (current.size) grades.push("student");
  if (pre.size) grades.push("pre");
  if (!grades.length) grades.push("general");
  return {
    grades,
    current: [...current].sort(),
    pre: [...pre].map(([cohort, pending]) => ({ cohort, pending })).sort((x, y) => x.cohort.localeCompare(y.cohort)),
  };
}

// 학생 묶기: 개인번호 → 카카오·구글 학생 번호 → (둘 다 없으면) 신청 하나
// 번호 없는 예전 신청은 같은 이름의 묶음이 딱 하나면 거기에 붙여요(명단 보기용, 권한과는 상관없어요)
type Groupable = { id: string; name: string; student_no?: string | null; account_id?: string | null };
const norm = (s: string) => s.replace(/\s/g, "");

export function groupStudents<T extends Groupable>(apps: T[]): T[][] {
  const groups: T[][] = [];
  const byNo = new Map<string, T[]>();
  const byAccount = new Map<string, T[]>();
  const loose: T[] = [];
  // 1) 번호·계정으로 묶기 (번호와 계정이 이어진 신청은 같은 묶음)
  for (const a of apps) {
    const g = (a.student_no && byNo.get(a.student_no)) || (a.account_id && byAccount.get(a.account_id)) || null;
    if (!a.student_no && !a.account_id) { loose.push(a); continue; }
    const target = g ?? [];
    if (!g) groups.push(target);
    target.push(a);
    if (a.student_no && !byNo.has(a.student_no)) byNo.set(a.student_no, target);
    if (a.account_id && !byAccount.has(a.account_id)) byAccount.set(a.account_id, target);
  }
  // 2) 번호·계정 없는 신청: 같은 이름 묶음이 딱 하나면 붙이고, 아니면 이름끼리
  const byName = new Map<string, T[][]>();
  for (const g of groups) for (const n of new Set(g.map((x) => norm(x.name)))) byName.set(n, [...(byName.get(n) ?? []), g]);
  const looseByName = new Map<string, T[]>();
  for (const a of loose) {
    const named = byName.get(norm(a.name)) ?? [];
    if (named.length === 1) named[0].push(a);
    else looseByName.set(norm(a.name), [...(looseByName.get(norm(a.name)) ?? []), a]);
  }
  return [...groups, ...looseByName.values()];
}

// 예: 오늘 · 어제 · 3일 전 · 11/2
export function seenLabel(iso: string | null | undefined, today: string): string {
  if (!iso) return "-";
  const day = new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000);
  if (diff <= 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff < 7) return `${diff}일 전`;
  return `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
}
