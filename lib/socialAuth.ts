import "server-only";
import { createHash, randomBytes } from "crypto";
import { googleClaims, type Provider } from "./socialLogin";

// ── 구글·카카오와 주고받기 (OAuth 2.0 authorization code) ──
// 키는 Vercel 환경변수에만 있어요: GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET / KAKAO_REST_API_KEY · (선택) KAKAO_CLIENT_SECRET
// 돌아올 주소(리디렉션 URI)는 각 개발자 사이트에 등록한 것과 글자까지 같아야 해요: {사이트 주소}/api/auth/{google|kakao}/callback

export const callbackUrl = (origin: string, p: Provider) => `${origin}/api/auth/${p}/callback`;
export const randomToken = (bytes = 24) => randomBytes(bytes).toString("base64url");
const challenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function authorizeUrl(p: Provider, origin: string, state: string, verifier: string): string {
  const redirect_uri = callbackUrl(origin, p);
  if (p === "google") {
    const q = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge(verifier),
      code_challenge_method: "S256",
      prompt: "select_account", // 한 기기에 구글 계정이 여러 개면 고르게 해요
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  const q = new URLSearchParams({ client_id: process.env.KAKAO_REST_API_KEY ?? "", redirect_uri, response_type: "code", state });
  return `https://kauth.kakao.com/oauth/authorize?${q}`;
}

export type Profile = { sub: string; email: string | null; nickname: string | null };

const post = (url: string, body: URLSearchParams) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" }, body, cache: "no-store", signal: AbortSignal.timeout(8000) });

// 돌아온 code로 학생 계정 번호를 받아요. 실패하면 null (키·토큰 값은 기록하지 않아요)
export async function fetchProfile(p: Provider, origin: string, code: string, verifier: string): Promise<Profile | null> {
  const redirect_uri = callbackUrl(origin, p);
  try {
    if (p === "google") {
      const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
      const res = await post("https://oauth2.googleapis.com/token", new URLSearchParams({
        code, client_id: clientId, client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri, grant_type: "authorization_code", code_verifier: verifier,
      }));
      if (!res.ok) return fail(p, `token ${res.status}`);
      const j = (await res.json()) as { id_token?: unknown };
      const c = typeof j.id_token === "string" ? googleClaims(j.id_token, clientId, Math.floor(Date.now() / 1000)) : null;
      return c ? { sub: c.sub, email: c.email, nickname: c.name } : fail(p, "id_token");
    }
    const body = new URLSearchParams({ grant_type: "authorization_code", client_id: process.env.KAKAO_REST_API_KEY ?? "", redirect_uri, code });
    if (process.env.KAKAO_CLIENT_SECRET) body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
    const res = await post("https://kauth.kakao.com/oauth/token", body);
    if (!res.ok) return fail(p, `token ${res.status}`);
    const t = (await res.json()) as { access_token?: unknown };
    if (typeof t.access_token !== "string") return fail(p, "access_token");
    const me = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${t.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!me.ok) return fail(p, `me ${me.status}`);
    const u = (await me.json()) as { id?: unknown; kakao_account?: { email?: unknown; profile?: { nickname?: unknown } }; properties?: { nickname?: unknown } };
    if (typeof u.id !== "number" && typeof u.id !== "string") return fail(p, "id");
    const nick = u.kakao_account?.profile?.nickname ?? u.properties?.nickname;
    return { sub: String(u.id), email: typeof u.kakao_account?.email === "string" ? u.kakao_account.email : null, nickname: typeof nick === "string" ? nick : null };
  } catch (e) {
    return fail(p, e instanceof Error ? e.name : "error");
  }
}

function fail(p: Provider, why: string): null {
  console.error(`social login ${p}: ${why}`);
  return null;
}
