import "server-only";
import { COURSES, KINDS, TIME_SLOTS, todayKST, type Track } from "./config";
import { getStudentProfiles, listApplications, listLoginLinks, type Application, type LoginLink, type StudentProfile } from "./db";
import { visibleToAdmin } from "./cancellations";
import { cohortWindows } from "./viewWindowServer";
import { gradeOf, groupStudents, type Grade } from "./grades";
import { LEVEL_TAG } from "./receipt/classes";
import { safe } from "./safe";

// ── 학생 명단 (관리 [학생 명단], 2026-11-27 Vella) ──
// 한 줄 = 학생 한 명(개인번호 → 카카오·구글 번호로 여러 달 신청을 묶음). 등급은 날짜로 자동(lib/grades.ts).

export const TRACK_SHORT: Record<Track, string> = { all: "주 4일", rc: "RC 단과", lc: "LC 단과", alt_mw: "격일 월수", alt_tt: "격일 화목", alt: "격일" };
export const STATUS_SHORT: Record<Application["status"], string> = { pending: "입금 대기", paid: "납부 완료", shipped: "납부 완료", refunded: "환불", cancelled: "취소" };

export type RosterMonth = { cohort: string; label: string; status: Application["status"]; statusLabel: string; appId: string };
export type RosterRow = {
  key: string;
  appId: string; // 이름을 누르면 여는 신청 (수강 중 → 예비 → 가장 최근)
  name: string;
  no: string | null;
  photo: string | null;
  grades: Grade[];
  current: string[];
  pre: { cohort: string; pending: boolean }[];
  months: RosterMonth[]; // 최근 달이 위
  course: Application["course"]; // 레벨 필터용 (여는 신청의 반)
  kind: Application["kind"];
  slot: Application["slot"];
  providers: LoginLink["provider"][];
  lastVia: string | null;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  phone: string | null;
  latestAt: string; // 가장 최근 신청 시각
  search: string; // 이름·번호·휴대폰·입금자 (공백·- 없이)
};

// 예: 12월 문풀반 750+ · 주 4일 · 저녁반 · 불라방
export const monthLabel = (a: Pick<Application, "cohort" | "course" | "track" | "slot" | "kind">) =>
  `${Number(a.cohort.slice(5, 7))}월 ${COURSES[a.course].label} ${LEVEL_TAG[a.course]} · ${TRACK_SHORT[a.track]}${a.slot ? ` · ${TIME_SLOTS[a.slot]}` : ""} · ${KINDS[a.kind].short}`;

// 사진: 가장 최근에 로그인한 연결의 사진
export const photoOf = (links: LoginLink[]) =>
  [...links].filter((l) => l.photo_url).sort((x, y) => (y.last_login_at ?? y.created_at).localeCompare(x.last_login_at ?? x.created_at))[0]?.photo_url ?? null;

export async function buildRoster(nowMs = Date.now()): Promise<{ rows: RosterRow[]; cohorts: string[] }> {
  const today = todayKST();
  const apps = (await listApplications()).filter(visibleToAdmin);
  const groups = groupStudents(apps);
  const cohorts = [...new Set(apps.map((a) => a.cohort))].sort().reverse();
  const [windows, profiles, links] = await Promise.all([
    cohortWindows(cohorts),
    safe("roster.profiles", () => getStudentProfiles(apps.map((a) => a.student_no ?? "").filter(Boolean)), [] as StudentProfile[]),
    safe("roster.links", () => listLoginLinks(apps.map((a) => a.account_id ?? "").filter(Boolean)), [] as LoginLink[]),
  ]);
  const profileOf = new Map(profiles.map((p) => [p.student_no, p]));
  const rows = groups.map((g): RosterRow => {
    const sorted = [...g].sort((x, y) => y.cohort.localeCompare(x.cohort) || y.created_at.localeCompare(x.created_at));
    const info = gradeOf(g, windows, today, nowMs);
    const live = sorted.filter((a) => a.status !== "refunded" && a.status !== "cancelled");
    const main = live.find((a) => info.current.includes(a.cohort)) ?? live.find((a) => info.pre.some((p) => p.cohort === a.cohort)) ?? live[0] ?? sorted[0];
    const no = sorted.find((a) => a.student_no)?.student_no ?? null;
    const accounts = new Set(g.map((a) => a.account_id).filter(Boolean));
    const myLinks = links.filter((l) => accounts.has(l.account_id));
    const profile = no ? profileOf.get(no) ?? null : null;
    const phone = profile?.phone ?? sorted.find((a) => a.phone)?.phone ?? null;
    return {
      key: no ?? [...accounts][0] ?? main.id,
      appId: main.id,
      name: main.name,
      no,
      photo: photoOf(myLinks),
      grades: info.grades,
      current: info.current,
      pre: info.pre,
      months: sorted.map((a) => ({ cohort: a.cohort, label: monthLabel(a), status: a.status, statusLabel: STATUS_SHORT[a.status], appId: a.id })),
      course: main.course,
      kind: main.kind,
      slot: main.slot,
      providers: [...new Set(myLinks.map((l) => l.provider))].sort(),
      lastVia: profile?.last_login_via ?? null,
      lastLoginAt: profile?.last_login_at ?? null,
      lastSeenAt: profile?.last_seen_at ?? null,
      phone,
      latestAt: sorted.map((a) => a.created_at).sort().at(-1) ?? "",
      search: [...new Set(g.flatMap((a) => [a.name, a.depositor, a.phone ?? "", a.student_no ?? ""]).concat(phone ?? ""))].join("|").replace(/[\s-]/g, ""),
    };
  });
  rows.sort((x, y) => y.latestAt.localeCompare(x.latestAt));
  return { rows, cohorts };
}
