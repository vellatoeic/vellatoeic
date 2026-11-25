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
  (await cookies()).delete("vella_student");
  (await cookies()).delete("vella_view");
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
