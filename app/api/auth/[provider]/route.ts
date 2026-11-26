import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { setOAuthState, takeRelogin } from "@/lib/auth";
import { authorizeUrl, randomToken } from "@/lib/socialAuth";
import { isAdminOAuth, isProvider, readyProviders, safeNext } from "@/lib/socialLogin";
import { loginSetup } from "@/lib/socialServer";

export const dynamic = "force-dynamic";

// [구글로 로그인] · [카카오로 로그인]: 확인값을 쿠키에 적어 두고 구글·카카오 로그인 화면으로 보내요
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const q = req.nextUrl.searchParams;
  // 관리자 로그인·관리자 계정 등록은 학생 로그인 방식과 상관없이 키가 있는 로그인이면 돼요
  const admin = q.get("admin");
  const next = isAdminOAuth(admin) ? "/admin" : safeNext(q.get("next"));
  const providers = isAdminOAuth(admin) ? readyProviders() : (await loginSetup()).providers;
  if (!isProvider(provider) || !providers.includes(provider)) redirect(next);
  const state = randomToken(), verifier = randomToken(32);
  await setOAuthState({ p: provider, s: state, v: verifier, n: next, l: q.get("link") === "1", ...(isAdminOAuth(admin) ? { a: admin } : {}) });
  const relogin = (await takeRelogin()) && !/KAKAOTALK/i.test(req.headers.get("user-agent") ?? "");
  redirect(authorizeUrl(provider, req.nextUrl.origin, state, verifier, relogin));
}
