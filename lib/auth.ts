import "server-only";
import { cookies } from "next/headers";
import { forget, memo } from "./requestMemo";
import { createHmac, scryptSync, timingSafeEqual, randomBytes } from "crypto";
import { isPreview } from "./db";

const SECRET =
  process.env.SESSION_SECRET ||
  (isPreview ? "preview-secret" : (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "") + (process.env.ADMIN_PASSWORD ?? ""));

function sign(v: string) {
  return createHmac("sha256", SECRET).update(v).digest("base64url");
}
function seal(v: string) {
  return `${Buffer.from(v).toString("base64url")}.${sign(v)}`;
}
function unseal(t: string | undefined): string | null {
  if (!t) return null;
  const [b, s] = t.split(".");
  if (!b || !s) return null;
  const v = Buffer.from(b, "base64url").toString();
  const exp = Buffer.from(sign(v));
  const got = Buffer.from(s);
  return exp.length === got.length && timingSafeEqual(exp, got) ? v : null;
}

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 60,
};

// ── 강의실 비밀번호 ─────────────────────────────
export function hashPin(pin: string) {
  const salt = randomBytes(8).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}
export function checkPin(pin: string, stored: string | null) {
  if (!stored) return false;
  const [salt, h] = stored.split(":");
  const a = Buffer.from(h, "hex");
  const b = scryptSync(pin, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── 학생 로그인 (신청 id 목록을 서명해서 쿠키에 저장) ──
export async function setStudent(ids: string[]) {
  forget("student:");
  forget("apps:active");
  (await cookies()).set("vella_student", seal(ids.join(",")), cookieOpts);
}
// 한 요청 안에서는 쿠키를 한 번만 풀어요
export function getStudentIds(): Promise<string[]> {
  return memo("student:ids", async () => {
    const v = unseal((await cookies()).get("vella_student")?.value);
    return v ? v.split(",").filter(Boolean) : [];
  });
}
export async function clearStudent() {
  forget("student:");
  forget("apps:active");
  const jar = await cookies();
  jar.delete("vella_student");
  jar.delete("vella_account");
}

// ── 구글·카카오 로그인 ──────────────────────────
// 학생 번호(account_id): 구글·카카오로 로그인(또는 연결)한 기기에만 있어요. 구글·카카오만 방식의 신청서가 이 번호로 저장돼요.
export async function setAccount(id: string) {
  forget("student:");
  (await cookies()).set("vella_account", seal(id), cookieOpts);
}
export function getAccountId(): Promise<string | null> {
  return memo("student:account", async () => unseal((await cookies()).get("vella_account")?.value));
}

// 잠깐만 쓰는 쿠키: 만든 시각을 함께 서명해서, 정해진 시간이 지나면 서버에서도 무시해요
function sealTimed(v: object) {
  return seal(JSON.stringify({ ...v, t: Date.now() }));
}
function unsealTimed<T>(raw: string | undefined, maxMs: number): T | null {
  const v = unseal(raw);
  if (!v) return null;
  try {
    const o = JSON.parse(v) as T & { t?: number };
    return typeof o.t === "number" && Date.now() - o.t >= 0 && Date.now() - o.t < maxMs ? o : null;
  } catch {
    return null;
  }
}

// 구글·카카오로 보내기 전 확인값 (state, PKCE): 10분, 로그인 주소(/api/auth)에만 보내요
// l = 강의실 [연결하기] 버튼에서 왔어요 (이미 로그인한 신청을 그대로 연결)
// a = 관리자 로그인(login) · 관리자 계정 등록(add)
export type OAuthState = { p: string; s: string; v: string; n: string; l?: boolean; a?: "login" | "add" };
const OAUTH_MS = 10 * 60 * 1000;
export async function setOAuthState(st: OAuthState) {
  (await cookies()).set("vella_oauth", sealTimed(st), { ...cookieOpts, path: "/api/auth", maxAge: OAUTH_MS / 1000 });
}
export async function takeOAuthState(): Promise<OAuthState | null> {
  const jar = await cookies();
  const st = unsealTimed<OAuthState>(jar.get("vella_oauth")?.value, OAUTH_MS);
  jar.set("vella_oauth", "", { ...cookieOpts, path: "/api/auth", maxAge: 0 });
  return st;
}

// 처음 로그인한 구글·카카오 계정: 이름+비밀번호로 내 신청을 찾을 때까지 20분 기억해요
// none = 이미 연결된 계정인데 수강 신청이 하나도 없을 때
export type PendingLink = { p: "google" | "kakao"; sub: string; email: string | null; nick: string | null; none?: boolean };
const LINK_MS = 20 * 60 * 1000;
export async function setPendingLink(l: PendingLink) {
  (await cookies()).set("vella_link", sealTimed(l), { ...cookieOpts, maxAge: LINK_MS / 1000 });
}
export async function getPendingLink(): Promise<PendingLink | null> {
  return unsealTimed<PendingLink>((await cookies()).get("vella_link")?.value, LINK_MS);
}
export async function clearPendingLink() {
  (await cookies()).delete("vella_link");
}

// ── 관리자 ─────────────────────────────────────
function adminPassword() {
  return process.env.ADMIN_PASSWORD || (isPreview ? "vella" : "");
}
export function checkAdminPassword(pw: string) {
  const real = adminPassword();
  return !!real && pw === real;
}
export async function setAdmin() {
  (await cookies()).set("vella_admin", seal("admin"), { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
}
export async function isAdmin() {
  if (!adminPassword()) return false;
  return unseal((await cookies()).get("vella_admin")?.value) === "admin";
}
export async function clearAdmin() {
  (await cookies()).delete("vella_admin");
}
