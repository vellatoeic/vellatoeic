import "server-only";
import { COURSES, KINDS, TIME_SLOTS, todayKST, type Track } from "./config";
import { examResultsByNos, getStudentProfiles, listApplications, listLoginLinks, listProspects, listSpecialLectures, listSpecialRegistrations, type Application, type ExamResultRow, type LoginLink, type Prospect, type SpecialLecture, type SpecialRegistration, type StudentProfile } from "./db";
import { specialDay } from "./special";
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
  course: Application["course"] | null; // 레벨 필터용 (여는 신청의 반, 잠재 고객은 없음)
  kind: Application["kind"] | null;
  slot: Application["slot"];
  guest: { optIn: boolean; specials: string[] } | null; // 특강으로 온 비수강생 기록 (소식 받기 동의 · 신청한 특강)
  exam: { total: number; date: string; count: number } | null; // 가장 최근 모의고사 (백지 제외)
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

// 비수강생이 신청한 특강 (예: 12/5(토) PART 5 액기스 특강, 취소 제외, 최근이 위)
const specialsOf = (prospectId: string, regs: SpecialRegistration[], events: Map<string, SpecialLecture>) =>
  regs.filter((r) => r.prospect_id === prospectId && r.deposit !== "cancelled")
    .map((r) => events.get(r.special_lecture_id)).filter((e): e is SpecialLecture => !!e)
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
    .map((e) => `${specialDay(e.event_date)} ${e.title}`);

export async function buildRoster(nowMs = Date.now()): Promise<{ rows: RosterRow[]; cohorts: string[] }> {
  const today = todayKST();
  const [apps, prospects] = await Promise.all([
    listApplications().then((x) => x.filter(visibleToAdmin)),
    safe("roster.prospects", () => listProspects(), [] as Prospect[]),
  ]);
  const groups = groupStudents(apps);
  const cohorts = [...new Set(apps.map((a) => a.cohort))].sort().reverse();
  const allNos = [...apps.map((a) => a.student_no ?? ""), ...prospects.map((x) => x.student_no ?? "")].filter(Boolean);
  const [windows, profiles, links, regs, events, exams] = await Promise.all([
    cohortWindows(cohorts),
    safe("roster.profiles", () => getStudentProfiles(allNos), [] as StudentProfile[]),
    safe("roster.links", () => listLoginLinks([...apps.map((a) => a.account_id ?? ""), ...prospects.map((x) => x.account_id)].filter(Boolean)), [] as LoginLink[]),
    prospects.length ? safe("roster.regs", () => listSpecialRegistrations(), [] as SpecialRegistration[]) : Promise.resolve([] as SpecialRegistration[]),
    prospects.length ? safe("roster.events", () => listSpecialLectures(), [] as SpecialLecture[]) : Promise.resolve([] as SpecialLecture[]),
    safe("roster.exams", () => examResultsByNos(allNos), [] as ExamResultRow[]),
  ]);
  const profileOf = new Map(profiles.map((p) => [p.student_no, p]));
  const eventOf = new Map(events.map((e) => [e.id, e]));
  const examOf = (no: string | null): RosterRow["exam"] => {
    const list = no ? exams.filter((r) => r.linked_no === no && !r.blank_sheet) : [];
    const last = [...list].sort((a, b) => b.exam_date.localeCompare(a.exam_date) || (b.session ?? -1) - (a.session ?? -1))[0];
    return last ? { total: last.total, date: last.exam_date, count: list.length } : null;
  };
  const usedProspects = new Set<string>();
  const rows = groups.map((g): RosterRow => {
    const sorted = [...g].sort((x, y) => y.cohort.localeCompare(x.cohort) || y.created_at.localeCompare(x.created_at));
    const info = gradeOf(g, windows, today, nowMs);
    const live = sorted.filter((a) => a.status !== "refunded" && a.status !== "cancelled");
    const main = live.find((a) => info.current.includes(a.cohort)) ?? live.find((a) => info.pre.some((p) => p.cohort === a.cohort)) ?? live[0] ?? sorted[0];
    const no = sorted.find((a) => a.student_no)?.student_no ?? null;
    const accounts = new Set(g.map((a) => a.account_id).filter(Boolean));
    const myLinks = links.filter((l) => accounts.has(l.account_id));
    const profile = no ? profileOf.get(no) ?? null : null;
    // 특강으로 먼저 온 비수강생 기록 (같은 개인번호 또는 같은 카카오·구글 계정)
    const pr = prospects.find((x) => (no && x.student_no === no) || accounts.has(x.account_id)) ?? null;
    if (pr) usedProspects.add(pr.id);
    const phone = profile?.phone ?? sorted.find((a) => a.phone)?.phone ?? pr?.phone ?? null;
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
      guest: pr ? { optIn: pr.news_opt_in, specials: specialsOf(pr.id, regs, eventOf) } : null,
      exam: examOf(no),
      providers: [...new Set(myLinks.map((l) => l.provider))].sort(),
      lastVia: profile?.last_login_via ?? null,
      lastLoginAt: profile?.last_login_at ?? null,
      lastSeenAt: profile?.last_seen_at ?? null,
      phone,
      latestAt: sorted.map((a) => a.created_at).sort().at(-1) ?? "",
      search: [...new Set(g.flatMap((a) => [a.name, a.depositor, a.phone ?? "", a.student_no ?? ""]).concat(phone ?? ""))].join("|").replace(/[\s-]/g, ""),
    };
  });
  // 수강 신청 없이 특강으로만 온 비수강생 = 잠재 고객
  for (const pr of prospects.filter((x) => !usedProspects.has(x.id))) {
    const myLinks = links.filter((l) => l.account_id === pr.account_id);
    const profile = pr.student_no ? profileOf.get(pr.student_no) ?? null : null;
    rows.push({
      key: pr.student_no ?? pr.account_id,
      appId: "",
      name: pr.name,
      no: pr.student_no,
      photo: photoOf(myLinks),
      grades: ["prospect"],
      current: [],
      pre: [],
      months: [],
      course: null,
      kind: null,
      slot: null,
      guest: { optIn: pr.news_opt_in, specials: specialsOf(pr.id, regs, eventOf) },
      exam: examOf(pr.student_no),
      providers: [...new Set(myLinks.map((l) => l.provider))].sort(),
      lastVia: profile?.last_login_via ?? null,
      lastLoginAt: profile?.last_login_at ?? null,
      lastSeenAt: profile?.last_seen_at ?? null,
      phone: pr.phone,
      latestAt: pr.updated_at ?? pr.created_at,
      search: [pr.name, pr.phone ?? "", pr.student_no ?? ""].join("|").replace(/[\s-]/g, ""),
    });
  }
  rows.sort((x, y) => y.latestAt.localeCompare(x.latestAt));
  return { rows, cohorts };
}
