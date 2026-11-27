// ── 학생 '내 정보' (SQL 44): 처음 로그인 뒤 한 장에 한 질문씩 ──
// ① 카카오·구글 연결(키가 있고 아직 연결 안 했을 때, '나중에' 가능) ② 휴대폰 번호(동명이인 구분) ③ 목표 점수 ④ 토익 공부 이유(카드, 여러 개)
// 개인번호(applications.student_no)별로 저장해요. 자동 테스트: tests/profile.test.ts
export type Profile = { student_no: string; phone: string | null; target_score: number | null; reasons: string[]; reason_note: string | null };
export type Step = "link" | "phone" | "target" | "reason";

export const REASONS: { id: string; label: string; icon: string }[] = [
  { id: "job", label: "취업 · 입사 지원", icon: "target" },
  { id: "graduate", label: "졸업 요건", icon: "school" },
  { id: "public", label: "공무원 · 공기업", icon: "laurel" },
  { id: "career", label: "승진 · 이직", icon: "chart" },
  { id: "study", label: "교환학생 · 대학원", icon: "reading" },
  { id: "self", label: "영어 실력 · 자기계발", icon: "star" },
  { id: "etc", label: "기타", icon: "feedback" },
];
export const TARGET_CHIPS = [650, 700, 750, 800, 850, 900];

export const reasonLabel = (id: string) => REASONS.find((r) => r.id === id)?.label ?? id;

// 아직 안 한 단계 (순서대로). needLink: 카카오·구글 버튼이 켜져 있고 이 학생이 아직 연결 안 함 + 이번에 '나중에'를 안 누름
export function stepsLeft(p: Pick<Profile, "phone" | "target_score" | "reasons"> | null, needLink: boolean): Step[] {
  const out: Step[] = [];
  if (needLink) out.push("link");
  if (!p?.phone) out.push("phone");
  if (!p?.target_score) out.push("target");
  if (!p?.reasons?.length) out.push("reason");
  return out;
}
export const profileDone = (p: Pick<Profile, "phone" | "target_score" | "reasons"> | null) => stepsLeft(p, false).length === 0;

// 휴대폰: 숫자만 남겨 010xxxxxxxx (형식이 틀리면 null)
export function cleanPhone(v: string): string | null {
  const d = v.replace(/[^0-9]/g, "");
  return /^01[0-9]{8,9}$/.test(d) ? d : null;
}
export const phoneLabel = (d: string | null) => (d ? d.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3") : "");

// 목표 점수: 10~990 사이 5점 단위로 맞춰요
export function cleanTarget(v: string): number | null {
  const n = Number(v.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(n) || n < 10 || n > 990) return null;
  return Math.round(n / 5) * 5;
}

// 공부 이유: 정해진 카드만, 겹치지 않게 (기타는 한 줄 메모)
export function cleanReasons(ids: string[]): string[] {
  const ok = new Set(REASONS.map((r) => r.id));
  return [...new Set(ids.filter((id) => ok.has(id)))];
}
