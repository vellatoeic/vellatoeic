import "server-only";
import { cookies } from "next/headers";
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
  (await cookies()).set("vella_student", seal(ids.join(",")), cookieOpts);
}
export async function getStudentIds(): Promise<string[]> {
  const v = unseal((await cookies()).get("vella_student")?.value);
  return v ? v.split(",").filter(Boolean) : [];
}
export async function clearStudent() {
  (await cookies()).delete("vella_student");
}

// ── 특강 신청 확인 (특강 신청 id 목록, 강의실 로그인과 따로 저장) ──
export async function setSpecialIds(ids: string[]) {
  (await cookies()).set("vella_special", seal([...new Set(ids)].join(",")), cookieOpts);
}
export async function getSpecialIds(): Promise<string[]> {
  const v = unseal((await cookies()).get("vella_special")?.value);
  return v ? v.split(",").filter(Boolean) : [];
}
export async function clearSpecialIds() {
  (await cookies()).delete("vella_special");
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
