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
// 구글·카카오 로그인도 같은 쿠키(신청 id 목록)를 써요. 강사 '학생 화면 보기' 중이면 그 학생 것만 들어 있어요.
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
  jar.delete("vella_view");
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
export type PendingLink = { p: "google" | "kakao"; sub: string; email: string | null; nick: string | null; photo?: string | null; none?: boolean };
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

// ── 로그아웃: 학생·관리자·연결 대기 기록을 모두 지워요 ──
// 카카오는 브라우저에 로그인을 기억해서, 그냥 두면 다음에 버튼을 누르자마자 같은 계정으로 들어가요.
// 그래서 로그아웃한 뒤 첫 카카오 로그인은 카카오 로그인 화면을 다시 보여줘요(vella_relogin, 1시간, /api/auth에만).
const RELOGIN = { ...cookieOpts, path: "/api/auth", maxAge: 60 * 60 };
export async function logoutAll() {
  await clearStudent();
  const jar = await cookies();
  jar.delete("vella_admin");
  jar.delete("vella_link");
  jar.set("vella_relogin", "1", RELOGIN);
}
export async function takeRelogin() {
  const jar = await cookies();
  const v = jar.get("vella_relogin")?.value === "1";
  if (v) jar.set("vella_relogin", "", { ...RELOGIN, maxAge: 0 });
  return v;
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
  (await cookies()).delete("vella_view");
}

// ── 강사의 '학생 화면으로 보기' (보기 전용) ──
// 관리자가 학생 한 명을 골라 그 학생 화면(대시보드·강의실)을 그대로 봐요.
// 이 표시가 있으면 학생 쪽 기록을 바꾸는 동작(테스트 제출·숙제 별·미션·특강 신청·교재 수령·공지 확인·선물)은 막혀요.
export async function setViewing(appId: string, name: string) {
  forget("student:");
  forget("apps:active");
  const jar = await cookies();
  jar.set("vella_student", seal(appId), { ...cookieOpts, maxAge: 60 * 60 * 4 });
  jar.set("vella_view", seal(`${appId}|${name}`), { ...cookieOpts, maxAge: 60 * 60 * 4 });
}
// 보기 전용 중이면 { appId, name }. 관리자 로그인이 풀렸으면 보기 전용도 아니에요.
export async function getViewing(): Promise<{ appId: string; name: string } | null> {
  const v = unseal((await cookies()).get("vella_view")?.value);
  if (!v || !(await isAdmin())) return null;
  const [appId, name] = v.split("|");
  return appId ? { appId, name: name ?? "" } : null;
}
// 학생 쪽 기록을 바꾸는 동작 맨 앞에서 불러요: 보기 전용이면 true (아무것도 바꾸지 않아요)
export async function isViewOnly() {
  return !!unseal((await cookies()).get("vella_view")?.value);
}
export async function clearViewing() {
  forget("student:");
  forget("apps:active");
  const jar = await cookies();
  jar.delete("vella_view");
  jar.delete("vella_student");
}
