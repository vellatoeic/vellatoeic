import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { takeOAuthState } from "@/lib/auth";
import { fetchProfile } from "@/lib/socialAuth";
import { isProvider, safeNext } from "@/lib/socialLogin";
import { addAdminLogin, adminSignIn, socialSignIn } from "@/lib/socialServer";

export const dynamic = "force-dynamic";

// 구글·카카오 로그인 후 돌아오는 주소 (각 개발자 사이트에 등록한 리디렉션 URI)
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const q = req.nextUrl.searchParams;
  const st = await takeOAuthState();
  const next = st?.a ? "/admin" : safeNext(st?.n);
  // 학생이 로그인 화면에서 [취소]를 누르면 원래 화면으로 조용히 돌아가요
  if (q.get("error")) redirect(next);
  // 횟수 제한은 두지 않아요: 수업 시작 때 801호 학생들이 같은 와이파이(같은 IP)로 한꺼번에 로그인해요.
  // 위조는 확인값(state·PKCE) 쿠키와 구글·카카오 쪽 확인으로 막아요.
  const code = q.get("code");
  const ok = isProvider(provider) && !!st && st.p === provider && !!code && q.get("state") === st.s;
  const profile = ok ? await fetchProfile(provider, req.nextUrl.origin, code!, st!.v) : null;
  if (!profile || !isProvider(provider)) redirect(`/login?e=fail&next=${encodeURIComponent(next)}`);
  if (st?.a === "add") redirect(await addAdminLogin(provider, profile));
  if (st?.a === "login") redirect(await adminSignIn(provider, profile));
  redirect(await socialSignIn(provider, profile, next, !!st?.l));
}
