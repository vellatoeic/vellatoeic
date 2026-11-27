import "server-only";
import { todayKST } from "./config";
import { getSetting, getSpecialRegistrationsFor, listAudios, listLectures, listMissions, listSpecialLectures, listStamps, type Application } from "./db";
import { activeStudentApps } from "./student";
import { canWatch, liveLinkFor } from "./access";
import { classAppsFor } from "./classCohort";
import { classDaysOf } from "./classCalendar";
import { studentDays } from "./studentDays";
import { cohortOpenAt, viewInfo } from "./viewWindowServer";
import { isOpened } from "./viewWindow";
import { liveState } from "./live";
import { studentTests, takesTests } from "./dailyTests";
import { audioBooksFor, dayDiff, studentAudioWindow } from "./audio";
import { missionCount, missionFor } from "./mission";
import { publicSpecials } from "./specialPlan";
import { deadlineBadge, specialDay, specialRegistrationOpen } from "./special";
import { isHomeworkStickerEligible } from "./schedule";
import { safe } from "./safe";
import { chatGateFor, type ChatGate } from "./preCourse";

// ── 학생 대시보드 (로그인한 이번 달 수강생의 첫 화면 /) ──
// 강의실과 같은 규칙을 그대로 써요: 수업 기수(lib/classCohort) · 열람 기간(lib/viewWindow) · 수업일(lib/classCalendar, 공휴일 제외)
// · 중간 등록생 첫 수업일(lib/studentDays) · 라이브(lib/live) · 테스트(lib/dailyTests) · 음원(lib/audio) · 특강(lib/special)

// 대시보드를 보여줄 신청: 납부 완료 + 수업 기수 + 열람 기간 안. 없으면 null (→ 첫 화면은 소개 화면)
export async function currentClassApp(apps: Application[], today = todayKST()): Promise<Application | null> {
  const paid = apps.filter(canWatch);
  if (paid.length === 0) return null;
  const { cohort, apps: inCohort } = await classAppsFor(paid, today);
  if (!cohort || inCohort.length === 0) return null;
  const view = await viewInfo(inCohort);
  const open = inCohort.filter((a) => today <= (view.get(a.id)?.until ?? ""));
  // 같은 기수에 신청이 여러 개면 먼저 낸 신청 (보통 하나예요)
  return [...open].sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null;
}

export type Dashboard = {
  app: Application;
  name: string; // 성을 뺀 이름 (예: 지은)
  cohortMonth: number;
  pendingCount: number; // 입금 확인 중인 다른 신청
  days: string[];
  first: string | null;
  last: string | null;
  done: number; // 오늘까지 지난 수업 수
  isClassDay: boolean;
  next: string | null; // 다음 수업일 (오늘 제외)
  dEnd: number | null; // 종강까지
  dStart: number | null; // 개강까지 (개강 전)
  live: { open: true; label: string; link: string | null } | { open: false; next: string | null };
  attendedToday: boolean;
  attendance: number; // 출석 수
  stars: number; // 숙제 별 수
  tests: { today: number; todayDone: number; missed: number; early: number } | null;
  audio: { count: number; end: string; left: number; start: string } | null;
  mission: number; // 0~4
  specials: { date: string; label: string; state: "confirmed" | "pending" | "open"; badge: string | null }[];
  chat: { url: string; code: string } | null;
  chatGate: ChatGate; // 단톡방은 학생 반 개강 전날부터 (lib/preCourse.ts)
};

export async function studentDashboard(today = todayKST()): Promise<Dashboard | null> {
  const { loggedIn, apps } = await activeStudentApps();
  if (!loggedIn) return null;
  const app = await safe("dash.current", () => currentClassApp(apps, today), null);
  if (!app) return null;
  const cohort = app.cohort;

  const days = studentDays(await safe("dash.days", () => classDaysOf(app), []), app.created_at);
  const first = days[0] ?? null;
  const last = days.at(-1) ?? null;
  const done = days.filter((d) => d <= today).length;
  const next = days.find((d) => d > today) ?? null;

  const [lectures, stamps, tests, audio, missions, specials, chatUrl, chatCode] = await Promise.all([
    safe("dash.lectures", () => listLectures([cohort]), []),
    safe("dash.stamps", () => listStamps([app.id]), { attendance: [], homework: [] }),
    takesTests(app) ? safe("dash.tests", () => studentTests(app, today), null) : Promise.resolve(null),
    safe("dash.audio", async () => {
      const books = audioBooksFor(app);
      if (books.length === 0) return null;
      const w = await studentAudioWindow(app);
      if (!w || today > w.end) return null;
      const count = (await listAudios(cohort)).filter((x) => books.includes(x.book)).length;
      return { count, end: w.end, start: w.start, left: dayDiff(today, w.end) };
    }, null),
    safe("dash.missions", () => listMissions([app.id]), []),
    safe("dash.specials", async () => {
      const [regs, events] = await Promise.all([getSpecialRegistrationsFor(apps.map((x) => x.id)), listSpecialLectures().then(publicSpecials)]);
      const mine = regs.filter((r) => r.deposit !== "cancelled");
      return events
        .filter((e) => e.event_date >= today && e.event_date.startsWith(cohort))
        .sort((a, b) => a.event_date.localeCompare(b.event_date))
        .flatMap((e): Dashboard["specials"] => {
          const r = mine.find((x) => x.special_lecture_id === e.id);
          if (r) return [{ date: e.event_date, label: specialDay(e.event_date), state: r.mode === "online" || r.deposit === "paid" ? "confirmed" : "pending", badge: null }];
          if (specialRegistrationOpen(e)) return [{ date: e.event_date, label: specialDay(e.event_date), state: "open", badge: deadlineBadge(e) ?? null }];
          return [];
        });
    }, [] as Dashboard["specials"]),
    safe("dash.chatUrl", () => getSetting("chat_url"), ""),
    safe("dash.chatCode", () => getSetting("chat_code"), ""),
  ]);

  const state = liveState(app, days);
  // 라이브 링크는 개강일 오전 9시부터 (그 전엔 '곧 시작'만)
  const openAt = await safe("dash.openAt", () => cohortOpenAt(cohort), null);
  const live = state.open
    ? { open: true as const, label: state.label, link: (() => { const l = isOpened(openAt) ? liveLinkFor(app, lectures, state.slot) : null; return l ? `https://youtu.be/${l.youtube_id}` : null; })() }
    : { open: false as const, next: state.next };

  const myAttendance = stamps.attendance.filter((s) => s.app_id === app.id && days.includes(s.day));
  const myHomework = stamps.homework.filter((s) => s.app_id === app.id && days.includes(s.day) && isHomeworkStickerEligible(s.day, s.created_at));
  // 단톡방: 이번 달·다음 달 납부 완료 신청 중 개강 전날이 지난 것이 있을 때만 링크·코드 (그 전에는 '○일부터 열려요')
  const chatGate = chatUrl ? await safe("dash.chatGate", () => chatGateFor(apps, today), { open: true } as ChatGate) : null;

  return {
    app,
    name: app.name.length > 1 ? app.name.slice(1) : app.name,
    cohortMonth: Number(cohort.slice(5, 7)),
    pendingCount: apps.filter((a) => a.status === "pending").length,
    days,
    first,
    last,
    done,
    isClassDay: days.includes(today),
    next,
    dEnd: last && today <= last ? dayDiff(today, last) : null,
    dStart: first && today < first ? dayDiff(today, first) : null,
    live,
    attendedToday: myAttendance.some((s) => s.day === today),
    attendance: myAttendance.length,
    stars: myHomework.length,
    tests: tests
      ? {
          today: tests.today.length,
          todayDone: tests.today.filter((t) => t.result).length,
          missed: tests.missed.length,
          early: tests.next.length,
        }
      : null,
    audio,
    mission: missionCount(missionFor(app.id, missions)),
    specials,
    chat: chatUrl && chatGate?.open ? { url: chatUrl, code: chatCode } : null,
    chatGate,
  };
}
