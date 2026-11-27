// ── 첫토익 모의고사 성적 연동 규칙 (설계서 v1, 2026-11-27) — DB 없이 계산, 자동 테스트: tests/mock-scores.test.ts ──
// 요청·응답 형식(설계서 4장)과 학생 연결 규칙(5장)은 첫토익 쪽과 약속한 것이라 바꾸지 않아요.
// 이 사이트의 '학생'은 개인번호 6자리(applications.student_no)예요. 같은 학생의 여러 달 신청은 같은 번호를 가져요.
// 생년월일은 받지 않아서(2026-11-27) 번호가 없거나 안 맞는 답안지는 모두 '확인 필요'로 관리자가 연결해요.

export type ExamInfo = { id: string; title: string; date: string; session: number | null; answer_key: string | null };
export type PartRow = { part: number; correct: number; total: number };
export type WrongRow = { q: number; part: number; answer: string; chosen: string | null };
export type PartComment = { part: number; comment: string };
export type ExamResultIn = {
  result_id: string;
  student_no: string | null;
  name: string;
  birth: string | null;
  lc: { correct: number; score: number };
  rc: { correct: number; score: number };
  total: number;
  parts: PartRow[];
  wrong: WrongRow[];
  comment: string | null;
  part_comments: PartComment[];
  blank_sheet: boolean;
  report_pdf_url: string | null;
};
export type ExamPayload = { version: 1; dry_run: boolean; exam: ExamInfo; results: ExamResultIn[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIX = /^[0-9]{6}$/;
const CHOICES = ["A", "B", "C", "D"];
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function validDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// 형식 검사: 한 행이라도 틀리면 전체 거부 (설계서 4장). 오류는 '어느 칸이 왜'만 (이름·생년월일 값은 넣지 않아요)
export function parsePayload(body: unknown): { ok: true; data: ExamPayload } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!isObj(body)) return fail("본문: JSON 객체가 아니에요");
  if (body.version !== 1) return fail("version: 1이어야 해요");
  if (body.dry_run !== undefined && typeof body.dry_run !== "boolean") return fail("dry_run: true/false여야 해요");
  const e = body.exam;
  if (!isObj(e)) return fail("exam: 객체가 없어요");
  if (typeof e.id !== "string" || !UUID.test(e.id)) return fail("exam.id: uuid여야 해요");
  if (typeof e.title !== "string" || !e.title.trim() || e.title.length > 200) return fail("exam.title: 1~200자여야 해요");
  if (!validDate(e.date)) return fail("exam.date: YYYY-MM-DD여야 해요");
  if (e.session !== null && e.session !== undefined && !isInt(e.session, 0, 1000)) return fail("exam.session: 정수 또는 null이어야 해요");
  if (e.answer_key !== null && e.answer_key !== undefined && (typeof e.answer_key !== "string" || e.answer_key.length > 100)) return fail("exam.answer_key: 문자 또는 null이어야 해요");
  if (!Array.isArray(body.results)) return fail("results: 배열이어야 해요");
  if (body.results.length > 300) return fail("results: 300개까지예요");

  const seen = new Set<string>();
  const results: ExamResultIn[] = [];
  for (let i = 0; i < body.results.length; i++) {
    const r = body.results[i];
    const at = (k: string) => `results[${i}].${k}`;
    if (!isObj(r)) return fail(`results[${i}]: 객체가 아니에요`);
    if (typeof r.result_id !== "string" || !UUID.test(r.result_id)) return fail(`${at("result_id")}: uuid여야 해요`);
    if (seen.has(r.result_id.toLowerCase())) return fail(`${at("result_id")}: 같은 요청에 두 번 있어요`);
    seen.add(r.result_id.toLowerCase());
    if (r.student_no !== null && r.student_no !== undefined && (typeof r.student_no !== "string" || !SIX.test(r.student_no))) return fail(`${at("student_no")}: 숫자 6자리 또는 null이어야 해요`);
    if (typeof r.name !== "string" || r.name.trim().length < 1 || r.name.trim().length > 30) return fail(`${at("name")}: 1~30자여야 해요`);
    if (r.birth !== null && r.birth !== undefined && (typeof r.birth !== "string" || !SIX.test(r.birth))) return fail(`${at("birth")}: YYMMDD 6자리 또는 null이어야 해요`);
    for (const k of ["lc", "rc"] as const) {
      const s = r[k];
      if (!isObj(s) || !isInt(s.correct, 0, 100) || !isInt(s.score, 5, 495)) return fail(`${at(k)}: correct 0~100, score 5~495 정수여야 해요`);
    }
    if (!isInt(r.total, 10, 990)) return fail(`${at("total")}: 10~990 정수여야 해요`);
    if (!Array.isArray(r.parts) || r.parts.length !== 7) return fail(`${at("parts")}: 파트 1~7, 7개여야 해요`);
    const partSeen = new Set<number>();
    for (const p of r.parts) {
      if (!isObj(p) || !isInt(p.part, 1, 7) || partSeen.has(p.part) || !isInt(p.total, 0, 100) || !isInt(p.correct, 0, p.total as number)) return fail(`${at("parts")}: part 1~7 한 번씩, 0 ≤ correct ≤ total 정수여야 해요`);
      partSeen.add(p.part);
    }
    if (!Array.isArray(r.wrong) || r.wrong.length > 200) return fail(`${at("wrong")}: 배열(200개까지)이어야 해요`);
    for (const w of r.wrong) {
      if (!isObj(w) || !isInt(w.q, 1, 200) || !isInt(w.part, 1, 7) || typeof w.answer !== "string" || !CHOICES.includes(w.answer) || (w.chosen !== null && (typeof w.chosen !== "string" || !CHOICES.includes(w.chosen)))) {
        return fail(`${at("wrong")}: q 1~200, part 1~7, answer A~D, chosen A~D 또는 null이어야 해요`);
      }
    }
    if (r.comment !== null && r.comment !== undefined && (typeof r.comment !== "string" || r.comment.length > 5000)) return fail(`${at("comment")}: 문자(5000자까지) 또는 null이어야 해요`);
    const pcs = r.part_comments ?? [];
    if (!Array.isArray(pcs) || pcs.length > 7) return fail(`${at("part_comments")}: 배열(7개까지)이어야 해요`);
    for (const c of pcs) if (!isObj(c) || !isInt(c.part, 1, 7) || typeof c.comment !== "string" || c.comment.length > 3000) return fail(`${at("part_comments")}: part 1~7과 comment 문자여야 해요`);
    if (r.blank_sheet !== undefined && typeof r.blank_sheet !== "boolean") return fail(`${at("blank_sheet")}: true/false여야 해요`);
    if (r.report_pdf_url !== null && r.report_pdf_url !== undefined && (typeof r.report_pdf_url !== "string" || !/^https:\/\/\S+$/.test(r.report_pdf_url) || r.report_pdf_url.length > 2000)) return fail(`${at("report_pdf_url")}: https 주소 또는 null이어야 해요`);
    results.push({
      result_id: r.result_id.toLowerCase(),
      student_no: (r.student_no as string | null | undefined) ?? null,
      name: r.name.trim(),
      birth: (r.birth as string | null | undefined) ?? null,
      lc: { correct: (r.lc as { correct: number }).correct, score: (r.lc as { score: number }).score },
      rc: { correct: (r.rc as { correct: number }).correct, score: (r.rc as { score: number }).score },
      total: r.total,
      parts: (r.parts as PartRow[]).map((p) => ({ part: p.part, correct: p.correct, total: p.total })).sort((a, b) => a.part - b.part),
      wrong: (r.wrong as WrongRow[]).map((w) => ({ q: w.q, part: w.part, answer: w.answer, chosen: w.chosen ?? null })).sort((a, b) => a.q - b.q),
      comment: (r.comment as string | null | undefined) ?? null,
      part_comments: (pcs as PartComment[]).map((c) => ({ part: c.part, comment: c.comment })),
      blank_sheet: r.blank_sheet === true,
      report_pdf_url: (r.report_pdf_url as string | null | undefined) ?? null,
    });
  }
  return {
    ok: true,
    data: {
      version: 1,
      dry_run: body.dry_run === true,
      exam: { id: e.id.toLowerCase(), title: e.title.trim(), date: e.date as string, session: (e.session as number | null | undefined) ?? null, answer_key: (e.answer_key as string | null | undefined) ?? null },
      results,
    },
  };
}

// 이름 비교: 앞뒤·사이 공백을 지운 뒤 같은지 (설계서 5장)
export const sameName = (a: string, b: string) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");

export type MatchStatus = "matched" | "review" | "manual";
export type Match = { status: MatchStatus; linked_no: string | null; note: string | null };

// 학생 연결 (설계서 5장). namesByNo: 개인번호 → 그 번호 학생의 신청서 이름들. existing: 이미 저장된 같은 result_id의 연결
// 관리자가 손으로 연결한(manual) 결과는 다시 와도 연결을 바꾸지 않아요.
export function matchResult(r: Pick<ExamResultIn, "student_no" | "name">, namesByNo: Map<string, string[]>, existing?: { match_status: MatchStatus; linked_no: string | null; match_note: string | null } | null): Match {
  if (existing?.match_status === "manual") return { status: "manual", linked_no: existing.linked_no, note: existing.match_note };
  if (r.student_no && namesByNo.has(r.student_no)) {
    const names = namesByNo.get(r.student_no)!;
    if (names.some((n) => sameName(n, r.name))) return { status: "matched", linked_no: r.student_no, note: null };
    return { status: "review", linked_no: null, note: "학생번호와 이름이 달라요" };
  }
  // 생년월일을 받지 않아서 이름 + 생년월일 연결은 하지 않아요. 이름만으로는 자동 연결하지 않아요.
  return { status: "review", linked_no: null, note: r.student_no ? "일치하는 학생 없음" : "학생번호 없음" };
}

// 개인번호 6자리: 첫 자리는 0이 아니게 (답안지에 적기 쉽고, 앞의 0을 빼먹는 실수가 없게)
export const isStudentNo = (v: string | null | undefined): v is string => !!v && /^[1-9][0-9]{5}$/.test(v);
export const randomStudentNo = (rand: () => number = Math.random) => String(100000 + Math.floor(rand() * 900000));

// 같은 학생 신청 묶음에서 쓸 번호: 이미 번호가 있는 신청이 있으면 그 번호(가장 먼저 신청한 것), 없으면 null(새로 발급)
export function numberForGroup(apps: { student_no?: string | null; created_at: string }[]): string | null {
  const withNo = apps.filter((a) => isStudentNo(a.student_no)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  return withNo[0]?.student_no ?? null;
}

// ── 1.1 한 번의 전송 = 그 회차의 지금 전체 명단 (결과화면 가이드 2026-11-27) ──
// 실제 전송이면 같은 회차(exam.id)의 예전 결과 중 이번 요청에 없는 result_id는 지워요(다시 스캔·강사 삭제).
// 결과가 하나도 없는 요청은 지우지 않아요(실수로 빈 명단이 와도 성적이 사라지지 않게).
export function staleResultIds(existingIds: string[], incomingIds: string[]): string[] {
  if (incomingIds.length === 0) return [];
  const keep = new Set(incomingIds.map((x) => x.toLowerCase()));
  return existingIds.filter((id) => !keep.has(id.toLowerCase()));
}

// 다시 스캔되어 지워지는 '선생님 연결(manual)' 결과의 연결을, 같은 회차에 새로 온 '확인 필요' 결과로 이어받아요.
// 이름이 같고(공백 무시) 지워지는 쪽·새로 온 쪽 모두 그 이름이 딱 한 명일 때만 (동명이인이면 선생님이 다시 연결)
export function carryManualLinks(
  removed: { result_id: string; name: string; match_status: MatchStatus; linked_no: string | null }[],
  incoming: { result_id: string; name: string; status: MatchStatus }[],
): Map<string, string> {
  const out = new Map<string, string>();
  const manual = removed.filter((r) => r.match_status === "manual" && r.linked_no);
  for (const m of manual) {
    if (manual.filter((x) => sameName(x.name, m.name)).length !== 1) continue;
    const fresh = incoming.filter((i) => sameName(i.name, m.name));
    if (fresh.length === 1 && fresh[0].status === "review") out.set(fresh[0].result_id, m.linked_no!);
  }
  return out;
}
