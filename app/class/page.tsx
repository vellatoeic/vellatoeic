import Link from "next/link";
import { myProfileState } from "@/lib/profileServer";
import { after } from "next/server";
import { BOOKS, COURSES, PARTS, TIME_SLOTS, TRACKS, TRACK_PARTS, cohortLabel, todayKST, won } from "@/lib/config";
import { liveState } from "@/lib/live";
import AddToHome from "@/components/AddToHome";
import Icon from "@/components/Icon";
import IconText from "@/components/IconText";
import StudentTabBar from "@/components/StudentTabBar";
import NoticePopupHost from "@/components/notices/NoticePopupHost";
import BookReceived from "@/components/BookReceived";
import TestForm from "@/components/tests/TestForm";
import { studentTests, takesTests } from "@/lib/dailyTests";
import { TEST_LABEL } from "@/lib/tests";
import { specialConfirmed, specialDay } from "@/lib/special";
import { listAudios, listLectures, listMissions, listStamps, getSetting, getSpecialRegistrationsFor, listSpecialLectures } from "@/lib/db";
import { missionCount, missionFor } from "@/lib/mission";
import { audioBooksFor, dayDiff, studentAudioWindow } from "@/lib/audio";
import { activeStudentApps } from "@/lib/student";
import { canWatch, covers, liveLinkFor } from "@/lib/access";
import type { TimeSlot } from "@/lib/config";
import { studentLogout } from "@/app/actions";
import AudioBanner from "@/components/audio/AudioBanner";
import AudioList from "@/components/audio/AudioList";
import AudioPopup from "@/components/audio/AudioPopup";
import LoginCard from "./LoginCard";
import StickerBoard from "./StickerBoard";
import SocialButtons from "@/components/SocialButtons";
import { loginSetup } from "@/lib/socialServer";
import { defaultHolidays, holidayKey, parseHolidays, schoolDaysFor, scheduleClassFor, scheduleKey } from "@/lib/schedule";
import { classAppsFor } from "@/lib/classCohort";
import { studentDays } from "@/lib/studentDays";
import { shiftMonth } from "@/lib/signupMonths";
import { publicSpecials } from "@/lib/specialPlan";
import { boardsFor, studentKeyOf } from "@/lib/gifts";
import { giftWindowOpen } from "@/lib/stickerComplete";
import { getGiftDraw } from "@/lib/db";
import GiftDraw from "@/components/gift/GiftDraw";
import { expireUnpaid } from "@/lib/cancellations";
import { getApplications } from "@/lib/db";
import { getStudentIds } from "@/lib/auth";
import CancelledNotice from "@/components/CancelledNotice";
import { cohortOpenAt, viewInfo } from "@/lib/viewWindowServer";
import { canViewNow, dayLabelKo, isOpened, openLabel, viewOpen, viewPhase, viewableCohorts } from "@/lib/viewWindow";
import { signupMonths } from "@/lib/signupMonthsServer";
import { safe } from "@/lib/safe";
import { classDaysOf, holidaysOf } from "@/lib/classCalendar";
import { chatRoomFor, preCourseFor, type ChatRoom } from "@/lib/preCourse";
import ChatRoomCard from "@/components/ChatRoomCard";
import PreCourseCard from "@/components/PreCourseCard";

const nextMonthOf = (today: string) => shiftMonth(today.slice(0, 7), 1);

export const dynamic = "force-dynamic";
export const metadata = { title: "강의실 · vella_toeic", robots: { index: false } };

export default async function ClassRoom({ searchParams }: { searchParams: Promise<{ t?: string; expired?: string }> }) {
  after(() => safe("expireUnpaid", () => expireUnpaid(), null)); // 30분 지난 입금 대기 자동 취소는 화면을 보낸 뒤에 (1분에 한 번, 실패해도 강의실은 열려요)
  const { loggedIn, apps } = await activeStudentApps();
  const profileTodo = loggedIn && apps.length > 0 && ((await safe("class.profile", () => myProfileState(), null))?.steps.length ?? 0) > 0;
  if (!loggedIn) return <LoginCard />;
  // 환불·삭제된 수강생은 아무것도 볼 수 없어요. 취소된 신청만 있으면 취소 안내를 보여줘요.
  if (apps.length === 0) {
    const cancelled = (await safe("cancelledApps", async () => getApplications(await getStudentIds()), [])).filter((a) => a.status === "cancelled").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (cancelled) return <CancelledNotice reason={cancelled.cancel_reason} retryHref={`/guide/${cancelled.kind}`} kakao={await getSetting("kakao_channel_url")} />;
    return (
      <div className="pt-12">
        <div className="card mx-auto max-w-sm space-y-3 text-center">
          <p className="font-jua text-2xl text-sky-ink">수강 정보가 없어요</p>
          <p className="text-slate-600">Vella쌤에게 문의해 주세요.</p>
          <form action={studentLogout}><button className="btn-ghost w-full">처음으로</button></form>
        </div>
      </div>
    );
  }

  const name = apps[0].name;
  const loginInfo = await safe("loginSetup", () => loginSetup(), { mode: "pin" as const, providers: [], pin: true });
  const paid = apps.filter(canWatch).sort((a, b) => b.cohort.localeCompare(a.cohort));

  // 스티커판: 같은 기수·같은 수업 학생들의 출석 날짜 = 수업일
  // 수업 기수(날짜 기준): 모집 기수를 다음 달로 바꿔도 이번 달 라이브·테스트는 그대로 열려요
  const { cohort } = await safe("classAppsFor", () => classAppsFor(paid), { cohort: paid[0]?.cohort ?? null, apps: paid });
  const [cafeUrl, account] = await Promise.all([getSetting("cafe_homework_url"), getSetting("bank_account")]);
  const pending = apps.filter((a) => a.status === "pending");
  const today = todayKST();
  // 🎁 스티커판 완성 선물: 수업 기수 신청 기준, 학생 1명당 기수마다 1번 (격일반은 선물 없이 축하만)
  const giftApps = paid.filter((a) => a.cohort === cohort);
  const [giftBoards, kakaoChannel] = await Promise.all([safe("boardsFor", () => boardsFor(giftApps, today), []), safe("kakaoChannel", () => getSetting("kakao_channel_url"), "")]);
  const myDraw = cohort && giftApps.length ? await safe("getGiftDraw", () => getGiftDraw(cohort, studentKeyOf(giftApps)), null) : null;
  const giftDone = giftBoards.find((b) => b.eligible && b.status.complete);
  const showGift = !!myDraw || (!!giftDone && giftWindowOpen(giftDone.status.last, today));
  const stamps = await safe("listStamps", () => listStamps(paid.map((a) => a.id)), { attendance: [], homework: [] });
  const missions = await safe("listMissions", () => listMissions(apps.map((a) => a.id)), []);
  // 권한 오픈: 기수마다 개강일 오전 9시 (그 전에는 예비수강생 · 강의 목록·라이브 링크·음원이 안 열려요). 계산에 실패하면 막지 않아요.
  const opensAt = new Map(await safe("cohortOpenAt", () => Promise.all([...new Set(paid.map((a) => a.cohort))].map(async (c) => [c, await cohortOpenAt(c)] as const)), []));
  const opened = (c: string) => isOpened(opensAt.get(c));
  // LC 음원: 본인 반 첫 수업일(또는 납부일)부터 종강일까지 보여요. (종강 직전 납부는 최소 7일, 개강일은 오전 9시부터)
  const audioBoxes = new Map(await safe("audioBoxes", () => Promise.all(paid.filter((a) => audioBooksFor(a).length > 0).map(async (a) => {
    const period = await studentAudioWindow(a);
    const books = audioBooksFor(a);
    const list = period && today >= period.start && today <= period.end && opened(a.cohort)
      ? (await listAudios(a.cohort)).filter((x) => books.includes(x.book))
      : [];
    return [a.id, { period, list }] as const;
  })), []));
  // 지금 다운로드 기간인 음원 (배너·팝업은 첫 번째 것 기준)
  const audioNow = paid.map((a) => ({ a, box: audioBoxes.get(a.id) }))
    .find((x) => x.box?.period && today >= x.box.period.start && today <= x.box.period.end && opened(x.a.cohort) && x.box.list.length > 0);
  const latestMission = missionCount(missionFor([...apps].sort((a, b) => b.cohort.localeCompare(a.cohort))[0].id, missions));
  const boardKeys = [...new Map(paid.map((a) => {
    const klass = scheduleClassFor(a.course, a.track);
    return [`${a.cohort}:${klass}`, { cohort: a.cohort, klass }];
  })).values()];
  const schedulesByClass = new Map(await Promise.all(boardKeys.map(async ({ cohort: appCohort, klass }) => {
    const [rawDays, rawHolidays] = await Promise.all([
      getSetting(scheduleKey(appCohort, klass)),
      getSetting(holidayKey(appCohort)),
    ]);
    const holidays = rawHolidays ? parseHolidays(rawHolidays, appCohort) : defaultHolidays(appCohort);
    // 수업일은 공휴일 제외 (라이브 '다음 수업'·스티커판이 공휴일을 수업일로 보지 않게, lib/classCalendar와 같은 규칙)
    return [`${appCohort}:${klass}`, {
      days: schoolDaysFor(rawDays, appCohort, klass).filter((d) => !holidays[d]),
      holidays,
    }] as const;
  })));

  // 문풀반·속성반 데일리 테스트 (이번 달 납부 완료 신청)
  const testApp = paid.find((a) => a.cohort === cohort && takesTests(a));
  const myTests = testApp ? await safe("studentTests", () => studentTests(testApp, today), null) : null;

  // 맨 위 탭 [☀️ 오전반 | 🌙 저녁반]: 본인 시간대가 먼저 선택되고, 교차 수강을 위해 다른 시간대로 바꿔 볼 수 있어요.
  // 열람 기간: 공식 '종강일까지', 실제 '다음 달 개강 전날까지' (lib/viewWindow.ts). 지난 신청은 기록(스티커판 등)만 보여요.
  // 계산에 실패하면 막지 않고 모두 열어 둬요 (지난 강의·라이브가 반드시 보이게)
  const view = await safe("viewInfo", () => viewInfo(paid), new Map(paid.map((a) => [a.id, { end: "9999-12-31", until: "9999-12-31", openAt: null as string | null }])));
  // inWindow = 열람 마감 전(개강 전 예비수강생 포함: 라이브 '다음 수업' 안내·스티커판), viewable = 개강일 9시가 지나 강의를 볼 수 있음
  const inWindow = (a: (typeof paid)[number]) => viewOpen(view.get(a.id)?.until ?? "", today);
  const viewable = (a: (typeof paid)[number]) => canViewNow(view.get(a.id), today);
  // 개강 전(9시 전) 납부 완료 신청: 맨 위에 '○월 강의실은 ○/○(○) 오전 9시에 열려요'
  const notOpened = paid.filter((a) => inWindow(a) && !viewable(a) && view.get(a.id)?.openAt).sort((x, y) => x.cohort.localeCompare(y.cohort));
  // 강의는 열람 가능한 신청의 기수만 읽어요 (연장 기간 포함, 끝난 기수는 읽지 않아요)
  const lectureCohorts = viewableCohorts(paid, view, today);
  const lectures = lectureCohorts.length ? await listLectures(lectureCohorts) : [];
  const nextMonth = nextMonthOf(today);
  // 그 신청의 다음 달 신청이 있는지 (연장 안내에서 '다음 달 수업도 함께해요' 버튼을 띄울지)
  const hasNextOf = (a: (typeof paid)[number]) => apps.some((x) => x.cohort === shiftMonth(a.cohort, 1));
  const signupMonth = (await safe("signupMonths", () => signupMonths(), []))[0] ?? null;
  // 열람 가능한 신청이 없고 이번 달·다음 달 신청도 없으면 맨 위에 '열람 기간이 끝났어요'
  const allClosed = paid.length > 0 && !paid.some(inWindow) && !apps.some((x) => x.cohort === today.slice(0, 7) || x.cohort === nextMonth);
  const lastClosed = [...paid].sort((x, y) => y.cohort.localeCompare(x.cohort))[0];
  const liveApp = paid.find((a) => a.cohort === cohort && inWindow(a));
  const { t, expired } = await searchParams;
  // 시작반 격일반 이어듣기: 개강 3일 전 ~ 첫 수업일까지 '지난달 교재 챙겨 오기' 카드 (첫 수업일이 지나면 숨김)
  const bringBooks = await safe("bringBooks", async () => {
    for (const a of apps.filter((x) => x.continuing && x.course === "start" && x.status !== "refunded" && x.status !== "cancelled")) {
      const [days, holidays] = await Promise.all([classDaysOf(a), holidaysOf(a.cohort)]);
      const first = days.filter((d) => !holidays[d]).sort()[0];
      if (!first) continue;
      const from = new Date(Date.parse(`${first}T00:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10);
      if (today < from || today > first) continue;
      const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
      return today === first ? "오늘" : first === tomorrow ? "내일" : `${dayLabelKo(first)} 첫`;
    }
    return null;
  }, null);
  // 개강 전 학생: 맨 위 '○월 수업 준비 중' 카드 · 단톡방은 달마다 새 방, 그 반 개강 전날부터 (lib/preCourse.ts)
  const [pre, chat] = await Promise.all([
    safe("preCourse", () => preCourseFor(apps, today), null),
    safe("chatRoom", () => chatRoomFor(apps, today), null as ChatRoom),
  ]);
  const ownSlot: TimeSlot = liveApp?.slot ?? paid[0]?.slot ?? "am";
  const tab: TimeSlot = t === "am" || t === "pm" ? t : ownSlot;

  // 맨 위 "🔴 라이브 입장": 고른 시간대 수업 10분 전 ~ 종료까지 빨간색, 그 외엔 다음 라이브 안내
  // 다가오는 특강 신청 (취소 제외) → 라이브 버튼 아래 작은 카드
  const [mySpecialRegs, specialEvents] = await safe("mySpecials", () => Promise.all([getSpecialRegistrationsFor(apps.map((x) => x.id)), listSpecialLectures().then(publicSpecials)]), [[], []] as [Awaited<ReturnType<typeof getSpecialRegistrationsFor>>, Awaited<ReturnType<typeof listSpecialLectures>>]);
  const mySpecials = mySpecialRegs
    .filter((r) => r.deposit !== "cancelled")
    .map((r) => ({ r, e: specialEvents.find((e) => e.id === r.special_lecture_id) }))
    .filter((x): x is { r: typeof x.r; e: NonNullable<typeof x.e> } => !!x.e && x.e.event_date >= today)
    .sort((x, y) => x.e.event_date.localeCompare(y.e.event_date));
  const liveButton = (() => {
    if (!liveApp) return null;
    const schedule = schedulesByClass.get(`${liveApp.cohort}:${scheduleClassFor(liveApp.course, liveApp.track)}`);
    const state = liveState({ ...liveApp, slot: tab }, schedule?.days ?? []);
    if (!state.open) {
      return (
        <div className="flex items-center gap-3 rounded-[22px] border border-sky-deep/10 bg-white px-5 py-4 text-slate-500 shadow-[0_6px_22px_rgba(18,64,92,0.07)]">
          <Icon name="live" size={36} />
          <div className="flex-1">
          <p className="font-jua text-xl text-sky-ink">라이브 입장</p>
          <p className="text-sm">{state.next ? `다음 라이브: ${state.next}` : "이번 달 라이브가 모두 끝났어요"}</p>
          </div>
        </div>
      );
    }
    const link = liveLinkFor(liveApp, lectures, state.slot);
    return link ? (
      <a href={`https://youtu.be/${link.youtube_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[22px] bg-gradient-to-br from-[#ff7a7f] to-[#e5484d] px-5 py-4 text-white shadow-[0_6px_0_#b8383c,0_12px_30px_rgba(229,72,77,0.3)] active:translate-y-1 active:shadow-[0_3px_0_#b8383c]">
        <Icon name="livedot" size={34} className="vt-pulse" />
        <div className="flex-1">
        <p className="font-jua text-2xl">라이브 입장</p>
        <p className="text-sm opacity-90">{state.label} · 눌러서 입장해요</p>
        </div>
      </a>
    ) : (
      <div className="rounded-[22px] border border-red-200 bg-[#fff1f1] px-5 py-4 text-center text-red-600">
        <p className="flex items-center justify-center gap-2 font-jua text-2xl"><Icon name="livedot" size={28} className="vt-pulse" />라이브 곧 시작</p>
        <p className="mt-1 text-sm">{state.label} · 라이브 링크가 올라오면 여기서 바로 입장해요. 잠시 후 새로고침해 주세요.</p>
      </div>
    );
  })();

  return (
    <div className="stagger wide space-y-6 pt-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-slate-500">{name}님의</p>
          <h1 className="font-jua text-4xl text-sky-ink">강의실</h1>
        </div>
        <form action={studentLogout}>
          <button className="text-sm text-slate-500 underline">로그아웃</button>
        </form>
      </div>



      {expired && <p className="card !bg-slate-100 flex items-center justify-center gap-2 font-bold text-slate-600"><Icon name="book" size={24} />열람 기간이 끝났어요</p>}

      {bringBooks && (
        <div className="rounded-3xl border-2 border-yellow-300 bg-yellow-100 p-5 text-center">
          <p className="font-jua text-xl text-yellow-900"><Icon name="book" size={24} className="mr-1" />{bringBooks} 수업에 지난달 개념집 + 시작반 RC 교재를 챙겨 오세요</p>
          <p className="mt-1 text-sm text-yellow-800">이번 달은 LC 교재만 새로 받아요 (격일반 이어듣기)</p>
        </div>
      )}

      {allClosed && lastClosed && (
        <div className="rounded-3xl border-2 border-sky-main bg-white p-5 text-center">
          <p className="font-jua text-xl text-sky-ink"><Icon name="book" size={24} className="mr-1" />{Number(lastClosed.cohort.slice(5, 7))}월 강의 열람 기간이 끝났어요.</p>
          {signupMonth && (
            <>
              <p className="mt-1 text-sm text-slate-600">{signupMonth.label}은 수강 신청 후 들을 수 있어요.</p>
              <a href={`/guide/${lastClosed.kind}`} className="btn mt-3 inline-block">{signupMonth.label.replace(" 수업", "")} 수강 신청하기</a>
            </>
          )}
        </div>
      )}

      {/* '○월 수업 준비 중' 카드(PreCourseCard)가 같은 달을 보여주면 겹치지 않게 숨겨요 (수업 중인 학생의 다음 달 · 개강일 0~9시에 보여요) */}
      {[...new Map(notOpened.filter((a) => pre?.app.cohort !== a.cohort).map((a) => [a.cohort, a])).values()].map((a) => (
        <div key={`open-${a.cohort}`} className="rounded-3xl border-2 border-sky-main bg-white p-5 text-center">
          <p className="flex items-center justify-center gap-2 font-jua text-2xl text-sky-ink"><Icon name="calendar" size={30} />{Number(a.cohort.slice(5, 7))}월 강의실은 {openLabel(view.get(a.id)!.openAt!)}에 열려요</p>
          <p className="mt-1 text-sm text-slate-600">개강일 오전 9시부터 라이브 입장·지난 강의·LC 음원이 자동으로 열려요.</p>
        </div>
      ))}

      {pending.map((a) => (
        <div key={a.id} className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 text-center">
          <p className="flex items-center justify-center gap-2 font-jua text-2xl text-amber-700"><Icon name="hourglass" size={30} />입금 확인 중이에요</p>
          <p className="mt-1 text-slate-700">확인되면 라이브 입장 버튼이 열려요.</p>
          <p className="font-jua mt-3 text-3xl text-sky-ink">{won(a.amount)}</p>
          <p className="mt-2 rounded-2xl bg-white p-3 font-bold text-sky-ink">{account || "계좌 안내 준비 중이에요"}</p>
          <p className="mt-2 text-sm text-slate-600">입금자명: <b>{a.depositor}</b> · {COURSES[a.course].label} {TRACKS[a.track]}</p>
        </div>
      ))}

      {pre && <PreCourseCard pre={pre} chat={chat} />}

      {/* 컴퓨터(1024px 이상): 왼쪽 탭·라이브·특강·오늘의 테스트 / 오른쪽 미션·안내·연결·단톡방 (휴대폰은 위아래 같은 순서) */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-6">
      {paid.length > 0 && (
        <div>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-[0_2px_0_#d5ecf9]">
            {(["am", "pm"] as const).map((s) => (
              <Link key={s} href={`/class?t=${s}`} scroll={false} className={`rounded-xl py-2.5 text-center font-jua text-lg ${tab === s ? "bg-sky-deep text-white" : "text-sky-ink"}`}>
                <span className="inline-flex items-center gap-1.5"><Icon name={s === "am" ? "sun" : "moon"} size={20} />{s === "am" ? "오전반" : "저녁반"}</span>
              </Link>
            ))}
          </div>
          {tab !== ownSlot && <p className="mt-1.5 text-center text-xs text-slate-500">내 수강 시간은 {TIME_SLOTS[ownSlot]}이에요. 같은 반 수업은 교차 수강할 수 있어요.</p>}
        </div>
      )}

      {liveButton}

      {audioNow && (
        <>
          <AudioBanner cohort={audioNow.a.cohort} ids={audioNow.box!.list.map((x) => x.id)} end={audioNow.box!.period!.end} left={dayDiff(today, audioNow.box!.period!.end)} today={today} />
          <AudioPopup cohort={audioNow.a.cohort} end={audioNow.box!.period!.end} />
        </>
      )}

      {mySpecials.map(({ r, e }) => {
        const ok = specialConfirmed(r, e.event_date);
        return (
          <Link key={r.id} href="/special" className={`flex items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3 text-sm ${ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <span className="inline-flex flex-wrap items-center gap-1 font-bold text-slate-700"><Icon name="mic" size={20} />{specialDay(e.event_date)} 특강 · <span className={`inline-flex items-center gap-1 ${ok ? "text-emerald-700" : "text-amber-700"}`}><Icon name={ok ? "check" : "hourglass"} size={18} />{ok ? "신청 확정" : "보증금 입금 대기"}</span></span>
            <span className="shrink-0 text-sky-deep">특강 페이지로 →</span>
          </Link>
        );
      })}

      {testApp && myTests && (myTests.today.length > 0 || myTests.missed.length > 0 || myTests.next.length > 0) && (
        <section className="space-y-2 rounded-3xl border-2 border-[#ffd23f] bg-[#fffbea] p-4">
          {myTests.today.length > 0 && (
            // 눌러서 접고 펼 수 있어요. 아직 안 낸 테스트가 있으면 펼친 채로 시작해요.
            <details open={myTests.today.some((t) => !t.result)} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between font-jua text-xl text-sky-ink">
                <span className="inline-flex items-center gap-1.5"><Icon name="stopwatch" size={26} />오늘의 테스트 <span className="text-sm text-slate-500">· 제출 {myTests.today.filter((t) => t.result).length}/{myTests.today.length}</span></span>
                <span className="text-sm text-slate-400 group-open:hidden">펼치기 ▾</span>
                <span className="hidden text-sm text-slate-400 group-open:inline">접기 ▴</span>
              </summary>
              <div className="mt-2 space-y-2">
                {myTests.today.map((t) => (
                  <TestForm key={`${t.spec.kind}${t.spec.no}`} appId={testApp.id} day={t.day} kind={t.spec.kind} no={t.spec.no} label={`${TEST_LABEL[t.spec.kind]} ${t.spec.no}`} questions={t.spec.questions}
                    existing={t.result ? { score: t.result.score, wrong: t.result.wrong, late: t.result.late } : null} />
                ))}
                <p className="text-xs text-slate-500">오늘 23:59까지 제출하고 고칠 수 있어요.</p>
              </div>
            </details>
          )}
          {myTests.next.length > 0 && (
            // 다음 수업일 테스트 미리 내기 (접어 두고 필요할 때 펼쳐요)
            <details className="group rounded-2xl bg-white/60 px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between font-jua text-lg text-sky-ink">
                <span className="inline-flex flex-wrap items-center gap-1.5"><Icon name="arrowRight" size={20} />다음 수업 테스트 미리 내기 <span className="text-sm text-slate-500">· {specialDay(myTests.next[0].day)} · 제출 {myTests.next.filter((t) => t.result).length}/{myTests.next.length}</span></span>
                <span className="text-sm text-slate-400 group-open:hidden">펼치기 ▾</span>
                <span className="hidden text-sm text-slate-400 group-open:inline">접기 ▴</span>
              </summary>
              <div className="mt-2 space-y-2">
                {myTests.next.map((t) => (
                  <TestForm key={`${t.spec.kind}${t.spec.no}`} appId={testApp.id} day={t.day} kind={t.spec.kind} no={t.spec.no} label={`${TEST_LABEL[t.spec.kind]} ${t.spec.no}`} questions={t.spec.questions}
                    existing={t.result ? { score: t.result.score, wrong: t.result.wrong, late: t.result.late } : null} />
                ))}
                <p className="text-xs text-slate-500">결석 예정이거나 미리 풀었다면 여기서 내 주세요. {specialDay(myTests.next[0].day)} 23:59까지 고칠 수 있어요.</p>
              </div>
            </details>
          )}
          <Link href="/class/tests" className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-bold text-sky-ink">
            <span className="inline-flex items-center gap-1.5">{myTests.missed.length > 0 && <><Icon name="clock" size={18} />밀린 테스트 {myTests.missed.length}개 · </>}<Icon name="chart" size={18} />내 점수 기록</span>
            <span className="text-sky-main">›</span>
          </Link>
        </section>
      )}

      {apps.filter((a) => a.kind === "online" && a.pickup === "classroom" && a.status === "paid").map((a) => (
        <BookReceived key={a.id} id={a.id} when={a.pickup_date ? `${specialDay(a.pickup_date)} ${a.pickup_time ?? ""}` : undefined} />
      ))}

      </div>
      <div className="space-y-6">
      {profileTodo && (
        <Link href="/welcome" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-sky-main bg-white px-4 py-3">
          <span className="inline-flex items-center gap-2 font-bold text-sky-ink"><Icon name="people" size={24} />내 정보 입력이 남았어요 <span className="text-sm font-normal text-slate-500">· 1분</span></span>
          <span className="text-sky-main">›</span>
        </Link>
      )}

      {/* 모의고사 개인번호 + 성적 (SQL 43) */}
      {(() => {
        const no = apps.map((a) => a.student_no).find((x) => !!x);
        return (
          <Link href="/class/scores" className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_2px_0_#d5ecf9]">
            <span className="inline-flex items-center gap-2 font-bold text-sky-ink"><Icon name="trophy" size={24} />모의고사 성적{no && <span className="text-sm font-normal text-slate-500">· 개인번호 <b className="tracking-widest text-sky-deep">{no}</b></span>}</span>
            <span className="text-sky-main">›</span>
          </Link>
        );
      })()}

      {latestMission < 4 && (
        <Link href="/mission" className="flex items-center gap-3 rounded-[20px] border-2 border-[#ffd23f] bg-white p-4 shadow-[0_3px_0_#cfe6f5]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e8f8ef]"><Icon name="clipboard" size={32} /></span>
          <span className="flex-1">
            <b className="block text-lg text-sky-ink">첫 수업 미션 {latestMission} / 4</b>
            <span className="text-sm text-slate-500">다 하면 스티커판에 웰컴 배지가 붙어요</span>
          </span>
          <span className="text-xl text-sky-main">›</span>
        </Link>
      )}

      <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-deep">강의 영상은 개강일 이후부터 열람할 수 있어요.</p>

      {/* 카카오·구글 연결 안내: 로그인 방식이 '둘 다'·'구글·카카오만'이고 아직 연결 안 한 학생에게만 */}
      {loginInfo.providers.length > 0 && !apps.some((a) => a.account_id) && (
        <section className="card space-y-3">
          <p className="font-jua text-xl text-sky-ink">카카오·구글 계정 연결하기</p>
          <p className="text-sm text-slate-600">한 번 연결하면 다음부터 이름·비밀번호 없이 버튼 하나로 들어와요.</p>
          <SocialButtons providers={loginInfo.providers} next="/class" link />
        </section>
      )}

      {showGift && cohort && <GiftDraw initial={myDraw} month={Number(cohort.slice(5, 7))} channelUrl={kakaoChannel} />}

      {/* 그 달 단톡방: 달마다 새 방, 학생 수강 달 방만 · 개강 전날 ~ 열람 마감일 (lib/preCourse.ts) */}
      <ChatRoomCard chat={chat} />

      </div>
      </div>

      {paid.map((a) => {
        // 강의 목록은 고른 시간대(☀️/🌙) 강의만 보여요. 구분 없는 예전 강의는 둘 다에 보여요.
        // 열람 기간이 지난 신청은 강의 목록을 보여주지 않아요 (스티커판 등 기록은 보기만)
        const mine = viewable(a) ? lectures.filter((l) => covers(a, l) && (!l.slot || l.slot === tab)) : [];
        const w = view.get(a.id);
        const phase = w ? viewPhase(w.end, w.until, today) : "before";
        return (
          <section key={a.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-main px-3 py-1 text-sm font-bold text-sky-ink">{cohortLabel(a.cohort)}</span>
              <h2 className="font-jua text-2xl text-sky-ink">
                {COURSES[a.course].label} {TRACKS[a.track]}
              </h2>
            </div>
            {/* 컴퓨터: 왼쪽 스티커판(휴대폰 크기 그대로, 이미지 저장용) / 오른쪽 LC 음원·지난 강의. 휴대폰은 음원 → 스티커판 → 강의 순서 그대로 */}
            <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8">
            <div className="lg:col-start-2 lg:row-start-1">
            {(() => {
              const box = audioBoxes.get(a.id);
              if (!box?.period || today > box.period.end) return null;
              const [, m, d] = box.period.end.split("-").map(Number);
              const left = dayDiff(today, box.period.end);
              if (today < box.period.start || !opened(a.cohort)) {
                const [, sm, sd] = box.period.start.split("-").map(Number);
                const openAt = opensAt.get(a.cohort);
                const from = today < box.period.start || !openAt ? `${sm}/${sd}` : openLabel(openAt);
                return <p className="mt-4 rounded-2xl bg-sky-soft p-4 text-sm text-slate-600"><Icon name="headphones" size={20} className="mr-1" />LC 음원은 {from}부터 종강일({m}/{d})까지 받을 수 있어요.</p>;
              }
              return (
                // 다운로드 기간에는 항상 펼쳐 둬요. 누른 파일은 '받음 ✓' (이 기기에 기록)
                <div id="lc-audio" className="mt-4 scroll-mt-4 rounded-2xl bg-sky-soft p-4">
                  <p className="flex flex-wrap items-center gap-1.5 font-jua text-lg text-sky-ink"><Icon name="headphones" size={26} />LC 음원 <span className="text-sm text-slate-500">({audioBooksFor(a).map((b) => BOOKS[b]).join(", ")} 교재 · {box.list.length}개)</span></p>
                  <p className={`text-sm font-bold ${left <= 3 ? "text-red-500" : "text-sky-deep"}`}>{m}/{d}까지 다운로드 가능 ({left === 0 ? "D-DAY" : `D-${left}`}) · 종강일이 지나면 다시 받을 수 없어요</p>
                  {box.list.length === 0 ? <p className="mt-2 text-sm text-slate-500">음원이 올라오면 여기에 보여요.</p> : (
                    <AudioList cohort={a.cohort} items={box.list.map((x) => ({ id: x.id, title: x.title }))} />
                  )}
                  <p className="mt-2 text-xs text-slate-500">받은 파일 위치 · 아이폰: 파일 앱 → 다운로드 / 갤럭시: 내 파일 → 다운로드</p>
                </div>
              );
            })()}
            </div>
            <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2">
            <div id="sticker" className="scroll-mt-20" />
            {(() => {
              const klass = scheduleClassFor(a.course, a.track);
              const schedule = schedulesByClass.get(`${a.cohort}:${klass}`)!;
              return <StickerBoard
                appId={a.id}
                name={a.name}
                cohort={a.cohort}
                className={`${COURSES[a.course].label} ${TRACKS[a.track]}`}
                klass={klass}
                scheduleDays={studentDays(schedule.days, a.created_at)}
                holidays={schedule.holidays}
                attendance={stamps.attendance.filter((stamp) => stamp.app_id === a.id)}
                homework={stamps.homework.filter((stamp) => stamp.app_id === a.id).map(({ day, created_at }) => ({ day, created_at }))}
                cafeUrl={cafeUrl}
                today={today}
                welcome={missionCount(missionFor(a.id, missions)) === 4}
              />;
            })()}
            </div>
            <div className="lg:col-start-2 lg:row-start-2">
            {phase === "extended" && w && (
              <div className="mt-6 rounded-2xl bg-emerald-50 p-3 text-center text-sm">
                <p className="font-bold text-emerald-700"><Icon name="book" size={20} className="mr-1" />{Number(a.cohort.slice(5, 7))}월 강의는 {dayLabelKo(w.until)}까지 볼 수 있어요{!hasNextOf(a) && ` · ${Number(shiftMonth(a.cohort, 1).slice(5, 7))}월 수업도 함께해요!`}</p>
                {!hasNextOf(a) && <a href={`/guide/${a.kind}`} className="btn mt-2 inline-block !py-2 !text-sm">{Number(shiftMonth(a.cohort, 1).slice(5, 7))}월 수강 신청하기</a>}
              </div>
            )}
            {mine.length > 0 && <h3 className="font-jua mt-6 border-t border-sky-main/50 pt-5 flex items-center gap-2 text-2xl text-sky-ink"><Icon name="replay" size={30} />지난 강의</h3>}
            {TRACK_PARTS[a.track].map((part) => {
              const list = mine.filter((l) => l.part === part);
              if (list.length === 0) return null;
              return (
                <div key={part} className="mt-3">
                  <p className="font-jua mb-2 text-lg text-sky-deep">{PARTS[part]}</p>
                  <ol className="space-y-2">
                    {list.map((l, i) => (
                      <li key={l.id}>
                        <Link
                          href={`/class/${l.id}`}
                          className="flex items-center gap-3 rounded-2xl bg-sky-soft px-4 py-3 transition hover:bg-sky-main/40"
                        >
                          <span className="font-jua flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-white px-2 text-sm text-sky-deep">
                            {l.slot ? TIME_SLOTS[l.slot] : i + 1}
                          </span>
                          <span className="flex-1 text-slate-800"><IconText text={l.title} /></span>
                          <Icon name="play" size={26} />
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
            </div>
            </div>
          </section>
        );
      })}

      <AddToHome />
      <NoticePopupHost />
      <StudentTabBar tests={!!testApp} />
    </div>
  );
}
