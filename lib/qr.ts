import "server-only";
import { createHmac } from "crypto";
import type { Klass } from "./config";

// 30초마다 바뀌는 출석 코드. 화면에 뜬 뒤 2분까지 인정 (로그인하는 시간 여유)
const STEP = 30_000;
const GRACE = 4;
const SECRET =
  process.env.SESSION_SECRET ||
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "preview") + (process.env.ADMIN_PASSWORD ?? "");

function codeAt(klass: Klass, w: number) {
  return createHmac("sha256", SECRET).update(`att:${klass}:${w}`).digest("base64url").slice(0, 8);
}
export function currentCode(klass: Klass) {
  return codeAt(klass, Math.floor(Date.now() / STEP));
}
export function verifyCode(klass: Klass, code: string) {
  const w = Math.floor(Date.now() / STEP);
  for (let i = 0; i <= GRACE; i++) if (codeAt(klass, w - i) === code) return true;
  return false;
}
