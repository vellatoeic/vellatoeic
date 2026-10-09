// ── 공지 팝업: 누가 대상인지, 지금 보여줄 공지가 무엇인지 (DB 없이 계산해요. 테스트: tests/notices.test.ts) ──
import type { CourseId, Kind, TimeSlot, Track } from "./config";

// 대상 조건 한 줄. 비어 있는 항목은 '모두'예요. 여러 줄이면 어느 한 줄에라도 맞으면 대상이에요.
// 과목: 종합(all)을 고르면 격일(alt)도 포함돼요.
export type TrackGroup = "all" | "alt" | "rc" | "lc";
export type NoticeTarget = { courses?: CourseId[]; tracks?: TrackGroup[]; kinds?: Kind[]; slots?: TimeSlot[] };
export type NoticeSection = { icon: string; title: string; body: string; gray?: boolean };

export type Notice = {
  id: string;
  title: string;
  to_label: string; // 예: 문풀반 · 현장 수강생 안내
  lead: string; // 첫 문장 (**핵심 문장**은 형광펜)
  sections: NoticeSection[];
  link_label: string | null;
  link_url: string | null; // "@study"면 관리자 설정의 스터디 인증 게시판 링크
  targets: NoticeTarget[]; // 비어 있으면 전체 (로그인 안 한 방문자 포함)
  starts_on: string;
  ends_on: string;
  popup: boolean;
  pinned: boolean;
  created_at: string;
};

type Student = { course: CourseId; track: Track; kind: Kind; slot: TimeSlot | null };

export const TRACK_GROUP_LABEL: Record<TrackGroup, string> = { all: "종합(격일 포함)", alt: "격일", rc: "RC 단과", lc: "LC 단과" };

export function trackGroup(t: Track): TrackGroup {
  if (t === "rc" || t === "lc") return t;
  return t === "all" ? "all" : "alt";
}

function ruleMatches(r: NoticeTarget, s: Student) {
  const g = trackGroup(s.track);
  const trackOk = !r.tracks?.length || r.tracks.includes(g) || (g === "alt" && r.tracks.includes("all"));
  return (!r.courses?.length || r.courses.includes(s.course))
    && trackOk
    && (!r.kinds?.length || r.kinds.includes(s.kind))
    && (!r.slots?.length || (s.slot !== null && r.slots.includes(s.slot)));
}

export const isForEveryone = (n: Pick<Notice, "targets">) => n.targets.length === 0;

// 학생(신청 여러 개면 하나라도)이 대상인지. 로그인 안 한 방문자(students 빈 배열)는 '전체' 공지만.
export function noticeMatches(n: Pick<Notice, "targets">, students: Student[]) {
  if (isForEveryone(n)) return true;
  return students.some((s) => n.targets.some((r) => ruleMatches(r, s)));
}

export const isLive = (n: Pick<Notice, "starts_on" | "ends_on">, today: string) => n.starts_on <= today && today <= n.ends_on;

// 지금 띄울 팝업: 게시 중 · 팝업 · 대상 · 아직 확인 안 함. 최신순 (상단 고정 먼저)
export function popupNotices<N extends Notice>(all: N[], students: Student[], readIds: Set<string>, today: string) {
  return sortNotices(all.filter((n) => n.popup && isLive(n, today) && noticeMatches(n, students) && !readIds.has(n.id)));
}

export function sortNotices<N extends Notice>(list: N[]) {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
}

// 공지 목록(🔔): 시작한 공지 중 본인 대상 (지난 공지도 다시 볼 수 있어요)
export function myNotices<N extends Notice>(all: N[], students: Student[], today: string) {
  return sortNotices(all.filter((n) => n.starts_on <= today && noticeMatches(n, students)));
}
