import "server-only";
import { getSetting, listNoticeReads, listNotices, type Application } from "./db";
import { activeStudentApps } from "./student";
import { isForEveryone, isLive, liveFor, myNotices, popupNotices, readKey, seenStorageKey, type Notice } from "./notices";
import { classDaysOf } from "./classCalendar";
import { studentStartDay } from "./studentDays";
import { todayKST } from "./config";
import { classAppsFor, classCohortNow } from "./classCohort";

// 공지를 판단할 때 쓰는 학생 신청: 이번 모집 기수 신청(없으면 가장 최근 기수)
export async function noticeIdentity(): Promise<{ loggedIn: boolean; apps: Application[] }> {
  const { loggedIn, apps } = await activeStudentApps();
  if (apps.length === 0) return { loggedIn, apps: [] };
  // 수업 기수(날짜 기준)의 신청으로 공지 대상을 판단해요
  return { loggedIn, apps: (await classAppsFor(apps)).apps };
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
    // (매달 반복 공지는 개강일을 알 수 없는 방문자에게는 띄우지 않아요)
    const everyone = all.filter((n) => isForEveryone(n) && !n.repeat_monthly && isLive(n, today));
    const visitorCohort = await classCohortNow(today);
    return {
      loggedIn: false, cohort: visitorCohort,
      popups: await withLinks(everyone.filter((n) => n.popup)), unread: 0,
      visitorKeys: everyone.map((n) => seenStorageKey(n, visitorCohort)),
    };
  }
  // 반복 공지용: 학생 첫 수업일(반 개강일, 중간 등록생은 신청 후 첫 수업일)
  const students = await Promise.all(apps.map(async (a) => ({ ...a, start: studentStartDay(await classDaysOf(a), a.created_at) })));
  const cohort = apps[0].cohort;
  const reads = new Set((await listNoticeReads({ appIds: apps.map((a) => a.id) })).flatMap((r) => (r.cohort ? [r.notice_id, `${r.notice_id}:${r.cohort}`] : [r.notice_id])));
  const mine = myNotices(all, students, today);
  return {
    loggedIn: true, cohort,
    popups: await withLinks(popupNotices(all, students, reads, today)),
    unread: mine.filter((n) => liveFor(n, students, today) && !reads.has(readKey(n, cohort))).length,
    visitorKeys: [] as string[],
  };
}
