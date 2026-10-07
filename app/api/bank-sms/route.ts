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

// 길이와 상관없이 같은 시간에 비교해요 (타이밍 공격 방지)
function tokenMatches(given: string) {
  const expected = process.env.DEPOSIT_WEBHOOK_TOKEN ?? "";
  if (expected.length < 16) return false; // 토큰이 없거나 너무 짧으면 꺼 둬요.
  return timingSafeEqual(digest(given), digest(expected));
}

const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (count(`fail:${ip}`, WINDOW) >= MAX_FAILED_AUTH) return reply(429, { ok: false, error: "too_many" });

  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!tokenMatches(given)) {
    allow(`fail:${ip}`, Number.MAX_SAFE_INTEGER, WINDOW);
    return reply(401, { ok: false, error: "unauthorized" });
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
