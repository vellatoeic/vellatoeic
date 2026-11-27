// ── 구글·카카오 로그인 규칙 (DB 없이 계산, 자동 테스트: tests/social-login.test.ts) ──
// 학생 한 명 = account_id 하나. 신청서(applications.account_id)와 로그인 연결(login_links)이 같은 account_id를 가져요.
// 이미 이름+비밀번호로 신청한 학생은 처음 한 번만 이름+비밀번호로 '내 신청 찾기'를 하면 연결돼요.
import type { Application } from "./db";

export type Provider = "google" | "kakao";
export const PROVIDERS: Provider[] = ["google", "kakao"];
export const PROVIDER_LABEL: Record<Provider, string> = { google: "구글", kakao: "카카오" };
export const isProvider = (v: string): v is Provider => (PROVIDERS as string[]).includes(v);

// 학생 로그인 방식 (관리 [기본 설정] settings.login_mode)
//   pin    = 이름 + 비밀번호만 (지금까지와 같아요, 기본값)
//   both   = 구글·카카오 버튼 + 이름·비밀번호 (옮겨 가는 기간)
//   social = 구글·카카오만 (이미 신청한 학생은 처음 한 번 이름+비밀번호로 연결)
export type LoginMode = "pin" | "both" | "social";
export const LOGIN_MODES: { id: LoginMode; label: string; desc: string }[] = [
  { id: "pin", label: "이름 + 비밀번호만", desc: "지금까지와 같아요" },
  { id: "both", label: "둘 다", desc: "구글·카카오 버튼 + 이름·비밀번호 (옮겨 가는 기간)" },
  { id: "social", label: "구글·카카오만", desc: "비밀번호 칸이 없어져요. 이미 신청한 학생은 처음 한 번만 이름+비밀번호로 연결" },
];
export const loginModeOf = (v: string | null | undefined): LoginMode => (v === "both" || v === "social" ? v : "pin");

type Env = Record<string, string | undefined>;
// 키가 들어 있는 로그인만 켜져요 (카카오는 키를 넣는 순간 버튼이 생겨요)
export function providerReady(p: Provider, env: Env = process.env) {
  if (p === "google") return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
  return !!env.KAKAO_REST_API_KEY;
}
export const readyProviders = (env: Env = process.env) => PROVIDERS.filter((p) => providerReady(p, env));

// 켜진 로그인이 하나도 없으면 '구글·카카오만'이어도 이름+비밀번호로 돌아가요 (모두가 못 들어오는 일이 없게)
export function effectiveMode(mode: LoginMode, providers: Provider[]): LoginMode {
  return providers.length === 0 ? "pin" : mode;
}
export const showPinLogin = (m: LoginMode) => m !== "social";
export const showSocialLogin = (m: LoginMode) => m !== "pin";

// 로그인 뒤 돌아갈 주소: 사이트 안의 정해진 화면만 (다른 사이트로 보내지 않아요)
// 정해지지 않았으면 /go → 관리자 / 신청 후 / 신청 전 중 알맞은 화면 (lib/zones.ts)
const NEXT_OK = [/^\/go$/, /^\/class$/, /^\/class\/tests$/, /^\/class\/scores$/, /^\/welcome$/, /^\/me$/, /^\/check(\?[\w=&%.-]*)?$/, /^\/mission$/, /^\/faq$/, /^\/special$/, /^\/guide\/(onsite|online)$/];
export function safeNext(next: string | null | undefined): string {
  const v = (next ?? "").trim();
  return NEXT_OK.some((re) => re.test(v)) ? v : "/go";
}
export const isSignupNext = (next: string) => /^\/guide\/(onsite|online)$/.test(next);

// 카톡·인스타·네이버 앱 안의 브라우저: 구글은 이런 곳에서 로그인을 막아요(403 disallowed_useragent)
export function inAppBrowser(ua: string): "kakaotalk" | "other" | null {
  if (/KAKAOTALK/i.test(ua)) return "kakaotalk";
  if (/Instagram|FBAN|FBAV|FB_IAB|NAVER\(inapp|Line\/|DaumApps|everytimeApp|BAND\/|; wv\)/i.test(ua)) return "other";
  return null;
}
export const isAndroid = (ua: string) => /Android/i.test(ua);

// 구글이 돌려준 id_token 확인 (토큰 교환 응답에서 바로 받은 것: 받는 사람·발급처·만료·이메일 확인 여부)
export function googleClaims(idToken: string, clientId: string, nowSec: number): { sub: string; email: string | null; name: string | null } | null {
  try {
    const part = idToken.split(".")[1];
    if (!part) return null;
    const c = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
    const audOk = c.aud === clientId || (Array.isArray(c.aud) && c.aud.includes(clientId));
    const issOk = c.iss === "https://accounts.google.com" || c.iss === "accounts.google.com";
    if (!audOk || !issOk || typeof c.sub !== "string" || !c.sub || typeof c.exp !== "number" || c.exp < nowSec) return null;
    const email = typeof c.email === "string" && c.email_verified !== false ? c.email : null;
    const picture = typeof c.picture === "string" && /^https:\/\//.test(c.picture) ? c.picture : null;
    return { sub: c.sub, email, name: typeof c.name === "string" ? c.name : null, ...(picture ? { picture } : {}) };
  } catch {
    return null;
  }
}

// ── 이름+비밀번호로 찾은 신청을 이 로그인에 연결하는 계획 ──
// 이미 다른 로그인으로 연결된 신청이 있으면 그 학생 번호(account_id)를 그대로 쓰고,
// 여러 번호가 섞여 있으면(예전에 따로 연결) 가장 먼저 신청한 쪽으로 합쳐요.
// keep: 이 로그인이 이미 연결된 학생 번호 (신청 없는 계정에 예전 신청을 붙일 때)
export function planLink(apps: Pick<Application, "id" | "created_at" | "account_id">[], keep: string | null, newId: () => string) {
  const byAge = [...apps].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const existing = [...new Set(byAge.map((a) => a.account_id).filter((x): x is string => !!x))];
  const accountId = keep ?? existing[0] ?? newId();
  return {
    accountId,
    merge: existing.filter((x) => x !== accountId), // 이 번호들의 신청·로그인을 accountId로 옮겨요
    attach: byAge.filter((a) => !a.account_id).map((a) => a.id), // 아직 번호가 없는 신청
  };
}

// ── 관리자 구글·카카오 계정 (settings.admin_logins) ──
// 이메일이 아니라 계정 고유번호(provider + subject)로 등록해요: 코드·저장소에 이메일을 쓰지 않고, 이메일을 바꿔도 그대로예요.
// 등록은 관리자 비밀번호로 들어온 상태에서 관리 화면 [구글 계정 추가]·[카카오 계정 추가]로만 해요.
export type AdminLogin = { p: Provider; sub: string; label: string | null; at: string };
export type AdminOAuth = "login" | "add"; // login = 관리자 로그인, add = 이 계정을 관리자로 등록
export const isAdminOAuth = (v: string | null | undefined): v is AdminOAuth => v === "login" || v === "add";

export function parseAdminLogins(raw: string | null | undefined): AdminLogin[] {
  try {
    const v = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is AdminLogin => !!x && isProvider(String(x.p)) && typeof x.sub === "string" && x.sub.length > 0);
  } catch {
    return [];
  }
}
// 같은 계정은 한 번만 (다시 등록하면 이름·시각만 새로)
export function withAdminLogin(list: AdminLogin[], add: AdminLogin): AdminLogin[] {
  return [...list.filter((x) => !(x.p === add.p && x.sub === add.sub)), add];
}
export const isAdminLogin = (list: AdminLogin[], p: Provider, sub: string) => list.some((x) => x.p === p && x.sub === sub);
