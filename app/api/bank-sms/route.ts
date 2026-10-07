import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { handleBankSms } from "@/lib/deposits";

export const dynamic = "force-dynamic";

// 아이폰 단축어가 은행 입금 문자를 보내는 곳이에요.
// 비밀 토큰(Vercel 환경변수 DEPOSIT_WEBHOOK_TOKEN)이 맞을 때만 처리해요. 문자 원문은 저장하지 않아요.
function authorized(req: NextRequest) {
  const expected = process.env.DEPOSIT_WEBHOOK_TOKEN ?? "";
  if (expected.length < 16) return false; // 토큰이 없거나 너무 짧으면 꺼 둬요.
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || req.nextUrl.searchParams.get("token") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
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
  if (!text.trim()) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  return NextResponse.json(await handleBankSms(text.slice(0, 2000)));
}
