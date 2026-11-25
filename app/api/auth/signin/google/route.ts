import { NextResponse, type NextRequest } from "next/server";
import { googleKeys, startGoogleLogin } from "@/lib/google";
import { setOAuthState } from "@/lib/auth";

// 구글 로그인 시작: 위조 방지 값을 쿠키에 잠깐(10분) 두고 구글 로그인 화면으로 보내요.
// 사용: /api/auth/signin/google?next=/class
export async function GET(req: NextRequest) {
  const keys = googleKeys();
  if (!keys) return NextResponse.redirect(new URL("/login?error=setup", req.url));
  const { url, cookie } = startGoogleLogin(keys.clientId, req.nextUrl.origin, req.nextUrl.searchParams.get("next") ?? "/");
  await setOAuthState(cookie);
  return NextResponse.redirect(url);
}
