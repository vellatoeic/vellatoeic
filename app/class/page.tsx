import Link from "next/link";
import { BOOKS, COURSES, PARTS, TIME_SLOTS, TRACKS, TRACK_PARTS, cohortLabel, todayKST, won } from "@/lib/config";
import { liveState } from "@/lib/live";
import AddToHome from "@/components/AddToHome";
import { listAudios, listLectures, listMissions, listStamps, currentCohort, getSetting } from "@/lib/db";
import { missionCount, missionFor } from "@/lib/mission";
import { audioBooksFor, dayDiff, studentAudioWindow } from "@/lib/audio";
import { activeStudentApps } from "@/lib/student";
import { canWatch, covers, liveLinkFor } from "@/lib/access";
import type { TimeSlot } from "@/lib/config";
import { studentLogout } from "@/app/actions";
import StudentLogin from "./StudentLogin";
import StickerBoard from "./StickerBoard";
import { defaultHolidays, holidayKey, parseHolidays, schoolDaysFor, scheduleClassFor, scheduleKey } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "강의실 · vella_toeic", robots: { index: false } };

export default async function ClassRoom({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { loggedIn, apps } = await activeStudentApps();
  if (!loggedIn) return <StudentLogin />;
  // 환불·삭제된 수강생은 아무것도 볼 수 없어요.
  if (apps.length === 0) {
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
  const paid = apps.filter(canWatch).sort((a, b) => b.cohort.localeCompare(a.cohort));
  const lectures = paid.length ? await listLectures() : [];

  // 스티커판: 같은 기수·같은 수업 학생들의 출석 날짜 = 수업일
  const cohort = await currentCohort();
  const [cafeUrl, account] = await Promise.all([getSetting("cafe_homework_url"), getSetting("bank_account")]);
  const pending = apps.filter((a) => a.status === "pending");
  const today = todayKST();
  const stamps = await listStamps(paid.map((a) => a.id));
  const missions = await listMissions(apps.map((a) => a.id));
  // LC 음원: 본인 반 첫 수업일부터 14일 동안만 보여요.
  const audioBoxes = new Map(await Promise.all(paid.filter((a) => audioBooksFor(a).length > 0).map(async (a) => {
    const period = await studentAudioWindow(a);
    const books = audioBooksFor(a);
    const list = period && today >= period.start && today <= period.end
      ? (await listAudios(a.cohort)).filter((x) => books.includes(x.book))
      : [];
    return [a.id, { period, list }] as const;
  })));
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
    return [`${appCohort}:${klass}`, {
      days: schoolDaysFor(rawDays, appCohort, klass),
      holidays: rawHolidays ? parseHolidays(rawHolidays, appCohort) : defaultHolidays(appCohort),
    }] as const;
  })));

  // 맨 위 탭 [☀️ 오전반 | 🌙 저녁반]: 본인 시간대가 먼저 선택되고, 교차 수강을 위해 다른 시간대로 바꿔 볼 수 있어요.
  const liveApp = paid.find((a) => a.cohort === cohort);
  const { t } = await searchParams;
  const ownSlot: TimeSlot = liveApp?.slot ?? paid[0]?.slot ?? "am";
  const tab: TimeSlot = t === "am" || t === "pm" ? t : ownSlot;

  // 맨 위 "🔴 라이브 입장": 고른 시간대 수업 10분 전 ~ 종료까지 빨간색, 그 외엔 다음 라이브 안내
  const liveButton = (() => {
    if (!liveApp) return null;
    const schedule = schedulesByClass.get(`${liveApp.cohort}:${scheduleClassFor(liveApp.course, liveApp.track)}`);
    const state = liveState({ ...liveApp, slot: tab }, schedule?.days ?? []);
    if (!state.open) {
      return (
        <div className="rounded-3xl bg-slate-200 px-5 py-4 text-center text-slate-500">
          <p className="font-jua text-2xl">🔴 라이브 입장</p>
          <p className="mt-1 text-sm">{state.next ? `다음 라이브: ${state.next}` : "이번 달 라이브가 모두 끝났어요"}</p>
        </div>
      );
    }
    const link = liveLinkFor(liveApp, lectures, state.slot);
    return link ? (
      <a href={`https://youtu.be/${link.youtube_id}`} target="_blank" rel="noreferrer" className="block rounded-3xl bg-red-500 px-5 py-4 text-center text-white shadow-[0_5px_0_#b91c1c] active:translate-y-1 active:shadow-none">
        <p className="font-jua text-2xl">🔴 라이브 입장</p>
        <p className="mt-1 text-sm opacity-90">{state.label} · 눌러서 입장해요</p>
      </a>
    ) : (
      <div className="rounded-3xl bg-red-100 px-5 py-4 text-center text-red-600">
        <p className="font-jua text-2xl">🔴 라이브 곧 시작</p>
        <p className="mt-1 text-sm">{state.label} · 라이브 링크가 올라오면 여기서 바로 입장해요. 잠시 후 새로고침해 주세요.</p>
      </div>
    );
  })();

  return (
    <div className="space-y-6 pt-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-slate-500">{name}님의</p>
          <h1 className="font-jua text-4xl text-sky-ink">강의실</h1>
        </div>
        <form action={studentLogout}>
          <button className="text-sm text-slate-500 underline">로그아웃</button>
        </form>
      </div>


      {pending.map((a) => (
        <div key={a.id} className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 text-center">
          <p className="font-jua text-2xl text-amber-700">⏳ 입금 확인 중이에요</p>
          <p className="mt-1 text-slate-700">확인되면 라이브 입장 버튼이 열려요.</p>
          <p className="font-jua mt-3 text-3xl text-sky-ink">{won(a.amount)}</p>
          <p className="mt-2 rounded-2xl bg-white p-3 font-bold text-sky-ink">{account || "계좌 안내 준비 중이에요"}</p>
          <p className="mt-2 text-sm text-slate-600">입금자명: <b>{a.depositor}</b> · {COURSES[a.course].label} {TRACKS[a.track]}</p>
        </div>
      ))}

      {paid.length > 0 && (
        <div>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-[0_2px_0_#d5ecf9]">
            {(["am", "pm"] as const).map((s) => (
              <Link key={s} href={`/class?t=${s}`} scroll={false} className={`rounded-xl py-2.5 text-center font-jua text-lg ${tab === s ? "bg-sky-deep text-white" : "text-sky-ink"}`}>
                {s === "am" ? "☀️ 오전반" : "🌙 저녁반"}
              </Link>
            ))}
          </div>
          {tab !== ownSlot && <p className="mt-1.5 text-center text-xs text-slate-500">내 수강 시간은 {TIME_SLOTS[ownSlot]}이에요. 같은 반 수업은 교차 수강할 수 있어요.</p>}
        </div>
      )}

      {liveButton}

      {latestMission < 4 && (
        <Link href="/mission" className="flex items-center gap-3 rounded-[20px] border-2 border-[#ffd23f] bg-white p-4 shadow-[0_3px_0_#cfe6f5]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e8f8ef] text-2xl">✅</span>
          <span className="flex-1">
            <b className="block text-lg text-sky-ink">첫 수업 미션 {latestMission} / 4</b>
            <span className="text-sm text-slate-500">다 하면 스티커판에 웰컴 배지가 붙어요</span>
          </span>
          <span className="text-xl text-sky-main">›</span>
        </Link>
      )}

      <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-deep">강의 영상은 개강일 이후부터 열람할 수 있어요.</p>

      <AddToHome />

      {paid.map((a) => {
        // 강의 목록은 고른 시간대(☀️/🌙) 강의만 보여요. 구분 없는 예전 강의는 둘 다에 보여요.
        const mine = lectures.filter((l) => covers(a, l) && (!l.slot || l.slot === tab));
        return (
          <section key={a.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-main px-3 py-1 text-sm font-bold text-sky-ink">{cohortLabel(a.cohort)}</span>
              <h2 className="font-jua text-2xl text-sky-ink">
                {COURSES[a.course].label} {TRACKS[a.track]}
              </h2>
            </div>
            {(() => {
              const box = audioBoxes.get(a.id);
              if (!box?.period || today > box.period.end) return null;
              const [, m, d] = box.period.end.split("-").map(Number);
              const left = dayDiff(today, box.period.end);
              if (today < box.period.start) {
                const [, sm, sd] = box.period.start.split("-").map(Number);
                return <p className="mt-4 rounded-2xl bg-sky-soft p-4 text-sm text-slate-600">🎧 LC 음원은 첫 수업일({sm}/{sd})부터 14일 동안 받을 수 있어요.</p>;
              }
              return (
                <div className="mt-4 rounded-2xl bg-sky-soft p-4">
                  <p className="font-jua text-lg text-sky-ink">🎧 LC 음원 <span className="text-sm text-slate-500">({audioBooksFor(a).map((b) => BOOKS[b]).join(", ")} 교재)</span></p>
                  <p className="text-sm text-sky-deep">{m}/{d}까지 다운로드 가능 ({left === 0 ? "D-DAY" : `D-${left}`})</p>
                  {box.list.length === 0 ? <p className="mt-2 text-sm text-slate-500">음원이 올라오면 여기에 보여요.</p> : (
                    <ol className="mt-2 space-y-1.5">
                      {box.list.map((x) => (
                        <li key={x.id}>
                          <a href={`/class/audio/${x.id}`} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[15px] text-slate-800">
                            <span className="flex-1">{x.title}</span>
                            <span className="text-sm text-sky-deep">zip 받기 ↓</span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })()}
            {(() => {
              const klass = scheduleClassFor(a.course, a.track);
              const schedule = schedulesByClass.get(`${a.cohort}:${klass}`)!;
              return <StickerBoard
                appId={a.id}
                name={a.name}
                cohort={a.cohort}
                className={`${COURSES[a.course].label} ${TRACKS[a.track]}`}
                klass={klass}
                scheduleDays={schedule.days}
                holidays={schedule.holidays}
                attendance={stamps.attendance.filter((stamp) => stamp.app_id === a.id)}
                homework={stamps.homework.filter((stamp) => stamp.app_id === a.id).map(({ day, created_at }) => ({ day, created_at }))}
                cafeUrl={cafeUrl}
                today={today}
                welcome={missionCount(missionFor(a.id, missions)) === 4}
              />;
            })()}
            {mine.length > 0 && <h3 className="font-jua mt-6 border-t border-sky-main/50 pt-5 text-2xl text-sky-ink">📚 지난 강의</h3>}
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
                          <span className="flex-1 text-slate-800">{l.title}</span>
                          <span className="text-sky-deep">▶</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
