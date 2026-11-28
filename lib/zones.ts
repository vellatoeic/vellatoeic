import "server-only";
import { getAccountId, getPendingLink, getViewing, isAdmin } from "./auth";
import { activeStudentApps } from "./student";
import { currentClassApp } from "./dashboard";
import { safe } from "./safe";
import { getProspectByAccount, getSpecialLecture, specialRegistrationsOfProspect } from "./db";
import { todayKST } from "./config";

// ── 로그인한 뒤 어디로 갈까: 홈페이지 세 구역 ──
//   관리자            → /admin (관리 첫 화면)
//   신청 후(수강생)    → / (이번 달 수강생 대시보드) · 이번 달 수업이 아니면 /class (강의실: 입금 확인 중·다음 달 개강 안내)
//   신청 전           → /guide (필독 사항 → 수강 신청) · 구글·카카오로 처음 들어와 연결 전이면 /login (내 신청 찾기)
//   비수강생(특강 신청한 잠재 고객) → /special (다가오는 특강 신청이 있을 때) · 아니면 /class/scores (내 모의고사 성적)
//   로그인 안 함       → / (소개 첫 화면)
export type Zone = "admin" | "student" | "linking" | "guest" | "before" | "visitor";

export function zonePath(zone: Zone, current: boolean): string {
  if (zone === "admin") return "/admin";
  if (zone === "student") return current ? "/" : "/class";
  if (zone === "linking") return "/login";
  if (zone === "guest") return current ? "/special" : "/class/scores"; // current = 다가오는 특강 신청이 있음
  if (zone === "before") return "/guide";
  return "/";
}

export async function myZone(): Promise<{ zone: Zone; current: boolean }> {
  if ((await safe("zone.admin", () => isAdmin(), false)) && !(await safe("zone.viewing", () => getViewing(), null))) return { zone: "admin", current: false };
  const { apps } = await safe("zone.apps", () => activeStudentApps(), { loggedIn: false, apps: [] });
  if (apps.length > 0) {
    const current = await safe("zone.current", () => currentClassApp(apps), null);
    return { zone: "student", current: !!current };
  }
  if (await safe("zone.pending", () => getPendingLink(), null)) return { zone: "linking", current: false };
  const account = await safe("zone.account", () => getAccountId(), null);
  if (account) {
    const prospect = await safe("zone.prospect", () => getProspectByAccount(account), null);
    if (prospect) {
      const upcoming = await safe("zone.guestUpcoming", async () => {
        const regs = (await specialRegistrationsOfProspect(prospect.id)).filter((r) => r.deposit !== "cancelled");
        const events = await Promise.all(regs.map((r) => getSpecialLecture(r.special_lecture_id)));
        return events.some((e) => !!e && e.event_date >= todayKST());
      }, false);
      return { zone: "guest", current: upcoming };
    }
    return { zone: "before", current: false };
  }
  return { zone: "visitor", current: false };
}

export async function myHome(): Promise<string> {
  const { zone, current } = await myZone();
  return zonePath(zone, current);
}
