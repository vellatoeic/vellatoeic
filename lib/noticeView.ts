import "server-only";
import { currentCohort, getSetting, listNoticeReads, listNotices, type Application } from "./db";
import { activeStudentApps } from "./student";
import { isForEveryone, isLive, myNotices, popupNotices, type Notice } from "./notices";
import { todayKST } from "./config";

// 공지를 판단할 때 쓰는 학생 신청: 이번 모집 기수 신청(없으면 가장 최근 기수)
export async function noticeIdentity(): Promise<{ loggedIn: boolean; apps: Application[] }> {
  const { loggedIn, apps } = await activeStudentApps();
  if (apps.length === 0) return { loggedIn, apps: [] };
  const now = await currentCohort();
  const latest = apps.some((a) => a.cohort === now) ? now : apps.map((a) => a.cohort).sort().at(-1)!;
  return { loggedIn, apps: apps.filter((a) => a.cohort === latest) };
}

// '@study' 링크는 관리자 설정의 스터디 인증 게시판 주소로 바꿔요. (주소가 없으면 버튼을 숨겨요)
export async function withLinks(list: Notice[]) {
  const study = await getSetting("study_board_url");
  return list.map((n) => ({ ...n, link_url: n.link_url === "@study" ? study || null : n.link_url }));
}

// 홈·강의실·🔔에서 쓰는 공지 묶음
export async function noticeSummary() {
  const today = todayKST();
  const [{ loggedIn, apps }, all] = await Promise.all([noticeIdentity(), listNotices()]);
  if (!loggedIn || apps.length === 0) {
    // 로그인 안 한 방문자: '전체' 공지만, 기기당 한 번 (확인 여부는 브라우저에 저장)
    const everyone = all.filter((n) => isForEveryone(n) && isLive(n, today));
    return { loggedIn: false, popups: await withLinks(everyone.filter((n) => n.popup)), unread: 0, visitorIds: everyone.map((n) => n.id) };
  }
  const reads = new Set((await listNoticeReads({ appIds: apps.map((a) => a.id) })).map((r) => r.notice_id));
  const mine = myNotices(all, apps, today);
  return {
    loggedIn: true,
    popups: await withLinks(popupNotices(all, apps, reads, today)),
    unread: mine.filter((n) => isLive(n, today) && !reads.has(n.id)).length,
    visitorIds: [] as string[],
  };
}
