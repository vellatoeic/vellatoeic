// ── 구글 로그인 (OAuth 2.0 + PKCE, 라이브러리 없이) ──
// 키 값은 Vercel 환경변수에서 읽어요. 이름이 조금 달라도 되게 흔한 이름을 차례로 찾아요 (값은 어디에도 출력하지 않아요).
// 구글 클라우드 콘솔 '승인된 리디렉션 URI'에 등록할 주소: {사이트 주소}/api/auth/callback/google
//   예) https://vellatoeic.vercel.app/api/auth/callback/google  (미리보기 주소에서 쓰려면 그 주소도 따로 등록)
import { createHash, randomBytes } from "node:crypto";

export const GOOGLE_ID_ENV = ["GOOGLE_CLIENT_ID", "AUTH_GOOGLE_ID", "GOOGLE_ID", "GOOGLE_OAUTH_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"] as const;
export const GOOGLE_SECRET_ENV = ["GOOGLE_CLIENT_SECRET", "AUTH_GOOGLE_SECRET", "GOOGLE_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET"] as const;
export const CALLBACK_PATH = "/api/auth/callback/google";

type Env = Record<string, string | undefined>;
const pick = (env: Env, names: readonly string[]) => {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return { name, value };
  }
  return null;
};

// 켜졌는지 + 어떤 이름을 찾았는지 (관리 화면 점검용, 값은 빼요)
export function googleSetup(env: Env = process.env) {
  const id = pick(env, GOOGLE_ID_ENV);
  const secret = pick(env, GOOGLE_SECRET_ENV);
  return { on: !!id && !!secret, idName: id?.name ?? null, secretName: secret?.name ?? null };
}

export function googleKeys(env: Env = process.env) {
  const id = pick(env, GOOGLE_ID_ENV);
  const secret = pick(env, GOOGLE_SECRET_ENV);
  return id && secret ? { clientId: id.value, clientSecret: secret.value } : null;
}

export const redirectUriFor = (origin: string) => `${origin.replace(/\/$/, "")}${CALLBACK_PATH}`;

// 로그인 뒤 돌아갈 곳: 사이트 안의 정해진 화면만 (다른 사이트로 보내는 주소는 무시)
const ALLOWED_NEXT = ["/", "/class", "/class/tests", "/mission", "/faq", "/special", "/notices", "/check"];
export function safeNext(next: string | null | undefined) {
  const v = String(next ?? "");
  if (v.startsWith("/check?") && !v.includes("//")) return v;
  return ALLOWED_NEXT.includes(v) ? v : "/";
}

const b64url = (buf: Buffer) => buf.toString("base64url");

// 로그인 시작: 위조 방지 값(state) + PKCE 확인 값(verifier)을 만들고 구글 로그인 주소를 돌려줘요
export function startGoogleLogin(clientId: string, origin: string, next: string) {
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUriFor(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie: JSON.stringify({ state, verifier, next: safeNext(next), at: Date.now() }) };
}

export type GoogleProfile = { sub: string; email: string | null; name: string | null; emailVerified: boolean };

// 돌아온 코드 → 토큰 → 구글 계정 정보 (서버에서 구글과 직접 주고받아요)
export async function finishGoogleLogin(keys: { clientId: string; clientSecret: string }, origin: string, code: string, verifier: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: keys.clientId,
      client_secret: keys.clientSecret,
      redirect_uri: redirectUriFor(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) throw new Error(`google_token_${tokenRes.status}`);
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("google_token_missing");
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  if (!infoRes.ok) throw new Error(`google_userinfo_${infoRes.status}`);
  const info = (await infoRes.json()) as { sub?: string; email?: string; name?: string; email_verified?: boolean };
  if (!info.sub) throw new Error("google_sub_missing");
  return { sub: info.sub, email: info.email ?? null, name: info.name ?? null, emailVerified: !!info.email_verified };
}
