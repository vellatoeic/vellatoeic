import "server-only";
import { getStudentIds } from "./auth";
import { getApplications } from "./db";
import { isActive } from "./access";
import { memo } from "./requestMemo";

// 로그인 쿠키에 담긴 신청 중 아직 유효한 것(환불·삭제 제외). 한 요청 안에서는 한 번만 읽어요.
export function activeStudentApps() {
  return memo("apps:active", async () => {
    const ids = await getStudentIds();
    return { loggedIn: ids.length > 0, apps: (await getApplications(ids)).filter(isActive) };
  });
}
