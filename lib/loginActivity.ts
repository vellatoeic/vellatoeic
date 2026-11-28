import "server-only";
import { saveStudentProfile, type Application } from "./db";
import { ensureStudentNo } from "./studentNumbers";
import { todayKST } from "./config";

// 학생 명단용 기록 (SQL 47, student_profiles): 마지막 로그인(방법 · 시각)과 마지막 접속일
// 로그인을 막지 않게 부르는 쪽에서 safe()/after()로 감싸요. 강사 '학생 화면 보기'에서는 부르지 않아요.
export type LoginVia = "pin" | "kakao" | "google";

export async function recordLogin(apps: Pick<Application, "id" | "student_no" | "created_at">[], via: LoginVia) {
  if (apps.length === 0) return;
  const no = await ensureStudentNo(apps);
  if (!no) return;
  const now = new Date().toISOString();
  await saveStudentProfile(no, { last_login_at: now, last_login_via: via, last_seen_at: now });
}

// 비수강생(잠재 고객): 개인번호로 같은 기록을 남겨요
export async function recordProspectLogin(no: string | null, via: LoginVia) {
  if (!no) return;
  const now = new Date().toISOString();
  await saveStudentProfile(no, { last_login_at: now, last_login_via: via, last_seen_at: now });
}

// 한국 날짜 (YYYY-MM-DD)
export const kstDay = (iso: string | null | undefined) => (iso ? new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 10) : null);

// 접속일: 하루에 한 번만 적어요 (오늘 이미 적었으면 그대로)
export async function recordSeen(no: string | null, lastSeen: string | null | undefined) {
  if (!no || kstDay(lastSeen) === todayKST()) return;
  await saveStudentProfile(no, { last_seen_at: new Date().toISOString() });
}
