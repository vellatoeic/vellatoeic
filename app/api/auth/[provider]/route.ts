import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { setOAuthState } from "@/lib/auth";
import { authorizeUrl, randomToken } from "@/lib/socialAuth";
import { isProvider, safeNext } from "@/lib/socialLogin";
import { loginSetup } from "@/lib/socialServer";

export const dynamic = "force-dynamic";

// [구글로 로그인] · [카카오로 로그인]: 확인값을 쿠키에 적어 두고 구글·카카오 로그인 화면으로 보내요
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const { providers } = await loginSetup();
  if (!isProvider(provider) || !providers.includes(provider)) redirect(next);
  const state = randomToken(), verifier = randomToken(32);
  await setOAuthState({ p: provider, s: state, v: verifier, n: next, l: req.nextUrl.searchParams.get("link") === "1" });
  redirect(authorizeUrl(provider, req.nextUrl.origin, state, verifier));
}
