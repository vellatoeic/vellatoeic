import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { handleBankSms } from "@/lib/deposits";
import { allow, count } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// 아이폰 단축어가 은행 입금 문자를 보내는 곳이에요.
// - 비밀 토큰(Vercel 환경변수 DEPOSIT_WEBHOOK_TOKEN)을 Authorization 헤더로만 받아요. 주소(?token=)로는 받지 않아요(접속 기록에 남을 수 있어서).
// - 문자 원문은 저장·기록(console)·오류 응답 어디에도 남기지 않아요.
// - 할 수 있는 일은 특강 보증금 입금 확정과 수신 기록 남기기뿐이에요. 다른 데이터를 돌려주지 않아요.

const WINDOW = 10 * 60 * 1000; // 10분
const MAX_REQUESTS = 30; // 10분에 30번까지
const MAX_FAILED_AUTH = 10; // 토큰이 틀린 요청은 10분에 10번까지

const digest = (s: string) => createHash("sha256").update(s).digest();

const MIN_TOKEN_LENGTH = 16;

// 토큰 확인. 실패하면 어디서 막혔는지 구분해서 알려줘요. (토큰 값은 응답·로그에 절대 넣지 않고, 글자 수만)
// 앞뒤 공백·줄바꿈은 자동으로 지우고 비교해요.
type AuthResult = { ok: true } | { ok: false; status: number; error: string; countsAsFailure: boolean; extra?: Record<string, number> };

function checkAuth(req: NextRequest): AuthResult {
  const expected = (process.env.DEPOSIT_WEBHOOK_TOKEN ?? "").trim();
  if (!expected) return { ok: false, status: 503, error: "server_token_missing", countsAsFailure: false };
  if (expected.length < MIN_TOKEN_LENGTH) {
    return { ok: false, status: 503, error: "server_token_too_short", countsAsFailure: false, extra: { server_length: expected.length, min_length: MIN_TOKEN_LENGTH } };
  }
  const header = (req.headers.get("authorization") ?? "").trim();
  if (!header) return { ok: false, status: 401, error: "no_auth_header", countsAsFailure: true };
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, status: 401, error: "bad_format", countsAsFailure: true };
  const given = m[1].trim();
  // 길이와 상관없이 같은 시간에 비교해요 (타이밍 공격 방지)
  if (!timingSafeEqual(digest(given), digest(expected))) {
    return { ok: false, status: 401, error: "token_mismatch", countsAsFailure: true, extra: { received_length: given.length, server_length: expected.length } };
  }
  return { ok: true };
}

const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (count(`fail:${ip}`, WINDOW) >= MAX_FAILED_AUTH) return reply(429, { ok: false, error: "too_many" });

  const auth = checkAuth(req);
  if (!auth.ok) {
    if (auth.countsAsFailure) allow(`fail:${ip}`, Number.MAX_SAFE_INTEGER, WINDOW);
    return reply(auth.status, { ok: false, error: auth.error, ...auth.extra });
  }
  if (!allow(`ok:${ip}`, MAX_REQUESTS, WINDOW) || !allow("ok:all", MAX_REQUESTS * 2, WINDOW)) return reply(429, { ok: false, error: "too_many" });

  try {
    const type = req.headers.get("content-type") ?? "";
    let text = "";
    if (type.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as { text?: unknown };
      text = typeof body.text === "string" ? body.text : "";
    } else if (type.includes("form")) {
      text = String((await req.formData()).get("text") ?? "");
    } else {
      text = await req.text();
    }
    if (!text.trim()) return reply(400, { ok: false, error: "empty" });
    const { result } = await handleBankSms(text.slice(0, 2000));
    text = ""; // 원문은 여기서 버려요.
    return reply(200, { ok: true, result });
  } catch {
    // 오류 내용에도 문자가 섞이지 않게, 기록 없이 짧은 응답만 돌려줘요.
    return reply(500, { ok: false, error: "failed" });
  }
}
