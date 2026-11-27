import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { allow, count } from "@/lib/rateLimit";
import { matchResult, parsePayload } from "@/lib/mockScores";
import { appsByStudentNos, getExamResults, upsertExamResults, type ExamResultRow } from "@/lib/db";

export const dynamic = "force-dynamic";

// 첫토익 채점 시스템이 모의고사 결과를 보내는 곳 (설계서 '첫토익 → 벨라 홈페이지 모의고사 성적 연동 v1')
// - 비밀 키: 헤더 x-firsttoeic-key = Vercel 환경변수 FIRSTTOEIC_SYNC_KEY (첫토익 쪽 VELLA_SYNC_KEY와 같은 값). 값은 코드·로그·응답 어디에도 남기지 않아요.
// - 한 요청 = 회차 하나, results 300개까지. 한 행이라도 형식이 틀리면 전체 거부(400, 하나도 저장 안 함).
// - dry_run이면 검사·연결 판정만 하고 저장하지 않아요(응답 모양은 같음).
// - 같은 result_id가 다시 오면 덮어쓰기. 관리자가 손으로 연결한(manual) 결과는 연결을 바꾸지 않아요.
// - 이름·생년월일이 들어 있어서 본문은 기록(console)하지 않아요.

const WINDOW = 10 * 60 * 1000;
const MAX_FAILED_AUTH = 10; // 키가 틀린 요청은 10분에 10번까지
const MAX_REQUESTS = 60;
const digest = (s: string) => createHash("sha256").update(s).digest();
const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (count(`ft-fail:${ip}`, WINDOW) >= MAX_FAILED_AUTH) return reply(429, { ok: false, error: "too_many" });

  const expected = (process.env.FIRSTTOEIC_SYNC_KEY ?? "").trim();
  if (expected.length < 16) return reply(500, { ok: false, error: "server_key_missing" }); // 키 설정이 없으면 절대 통과시키지 않아요
  const given = (req.headers.get("x-firsttoeic-key") ?? "").trim();
  if (!given || !timingSafeEqual(digest(given), digest(expected))) {
    allow(`ft-fail:${ip}`, Number.MAX_SAFE_INTEGER, WINDOW);
    return reply(401, { ok: false, error: "unauthorized" });
  }
  if (!allow(`ft-ok:${ip}`, MAX_REQUESTS, WINDOW)) return reply(429, { ok: false, error: "too_many" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { ok: false, error: "본문: JSON이 아니에요" });
  }
  const parsed = parsePayload(body);
  body = null;
  if (!parsed.ok) return reply(400, { ok: false, error: parsed.error });
  const { exam, results, dry_run } = parsed.data;

  try {
    // 개인번호 → 그 번호 학생의 신청서 이름들
    const apps = await appsByStudentNos(results.flatMap((r) => (r.student_no ? [r.student_no] : [])));
    const namesByNo = new Map<string, string[]>();
    for (const a of apps) if (a.student_no) namesByNo.set(a.student_no, [...(namesByNo.get(a.student_no) ?? []), a.name]);
    const existing = new Map((await getExamResults(results.map((r) => r.result_id))).map((r) => [r.result_id, r]));

    const rows: ExamResultRow[] = [];
    const out = results.map((r) => {
      const m = matchResult(r, namesByNo, existing.get(r.result_id) ?? null);
      rows.push({
        result_id: r.result_id,
        exam_id: exam.id,
        exam_title: exam.title,
        exam_date: exam.date,
        session: exam.session,
        answer_key: exam.answer_key,
        student_no: r.student_no,
        name: r.name,
        birth: r.birth,
        lc_correct: r.lc.correct,
        lc_score: r.lc.score,
        rc_correct: r.rc.correct,
        rc_score: r.rc.score,
        total: r.total,
        parts: r.parts,
        wrong: r.wrong,
        comment: r.comment,
        part_comments: r.part_comments,
        blank_sheet: r.blank_sheet,
        report_pdf_url: r.report_pdf_url,
        linked_no: m.linked_no,
        match_status: m.status,
        match_note: m.note,
      });
      return m.status === "review"
        ? { result_id: r.result_id, status: "review", note: m.note }
        : { result_id: r.result_id, status: m.status, student_id: m.linked_no };
    });
    if (!dry_run) await upsertExamResults(rows);
    return reply(200, { ok: true, dry_run, results: out });
  } catch (e) {
    console.error("firsttoeic receive failed", e instanceof Error ? e.name : "error", results.length); // 건수만
    return reply(500, { ok: false, error: "server_error" });
  }
}

const notAllowed = () => reply(405, { ok: false, error: "method_not_allowed" });
export const GET = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
