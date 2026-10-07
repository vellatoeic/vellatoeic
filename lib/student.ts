import "server-only";
import { getStudentIds } from "./auth";
import { getApplications } from "./db";
import { isActive } from "./access";

// 로그인 쿠키에 담긴 신청 중 아직 유효한 것(환불·삭제 제외)
export async function activeStudentApps() {
  const ids = await getStudentIds();
  return { loggedIn: ids.length > 0, apps: (await getApplications(ids)).filter(isActive) };
}
