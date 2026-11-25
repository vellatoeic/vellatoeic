import { NextResponse, type NextRequest } from "next/server";
import { finishGoogleLogin, googleKeys, safeNext } from "@/lib/google";
import { setMember, takeOAuthState } from "@/lib/auth";
import { getApplications, memberAppIds, upsertMember } from "@/lib/db";
import { isActive } from "@/lib/access";
import { currentClassApp } from "@/lib/dashboard";
import { safe } from "@/lib/safe";

// 구글에서 돌아오는 주소 (구글 클라우드 콘솔 '승인된 리디렉션 URI'에 등록: {사이트 주소}/api/auth/callback/google)
// ① 위조 방지 값 확인 ② 코드 → 구글 계정 ③ 회원 저장·로그인 ④ 연결된 신청이 없으면 처음 한 번 연결 화면으로
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, req.url));
  const keys = googleKeys();
  if (!keys) return fail("setup");
  const raw = await takeOAuthState();
  if (sp.get("error")) return fail("cancel"); // 구글 화면에서 취소
  let saved: { state?: string; verifier?: string; next?: string; at?: number } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  const code = sp.get("code");
  if (!saved?.state || !saved.verifier || !code || sp.get("state") !== saved.state || Date.now() - (saved.at ?? 0) > 10 * 60 * 1000) return fail("state");

  let profile;
  try {
    profile = await finishGoogleLogin(keys, req.nextUrl.origin, code, saved.verifier);
  } catch (e) {
    console.error("[google login]", e instanceof Error ? e.message : "error"); // 토큰·계정 정보는 남기지 않아요
    return fail("google");
  }
  const member = await upsertMember({ provider: "google", provider_id: profile.sub, email: profile.email, name: profile.name });
  await setMember(member.id);

  const next = safeNext(saved.next);
  const apps = (await safe("google.apps", async () => (await getApplications(await memberAppIds(member.id))).filter(isActive), []));
  if (apps.length === 0) return NextResponse.redirect(new URL(`/login/link${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`, req.url));
  if (next !== "/") return NextResponse.redirect(new URL(next, req.url));
  const current = await safe("google.current", () => currentClassApp(apps), null);
  return NextResponse.redirect(new URL(current ? "/" : "/class", req.url));
}
