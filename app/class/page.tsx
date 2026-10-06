import Link from "next/link";
import { BOOKS, COURSES, PARTS, TIME_SLOTS, TRACKS, TRACK_PARTS, cohortLabel, dayLabel, todayKST, won } from "@/lib/config";
import { liveState } from "@/lib/live";
import AddToHome from "@/components/AddToHome";
import { getApplications, listAudios, listLectures, listMissions, listStamps, currentCohort, getSetting } from "@/lib/db";
import { missionCount, missionFor } from "@/lib/mission";
import { audioBooksFor, dayDiff, studentAudioWindow } from "@/lib/audio";
import { getStudentIds } from "@/lib/auth";
import { canWatch, covers } from "@/lib/access";
import { studentLogout } from "@/app/actions";
import StudentLogin from "./StudentLogin";
import StickerBoard from "./StickerBoard";
import { defaultHolidays, holidayKey, parseHolidays, schoolDaysFor, scheduleClassFor, scheduleKey } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "강의실 · vella_toeic", robots: { index: false } };

export default async function ClassRoom() {
  const apps = await getApplications(await getStudentIds());
  if (apps.length === 0) return <StudentLogin />;

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

  // 맨 위 "🔴 라이브 입장": 이번 달 납부 완료 반의 수업 30분 전 ~ 종료까지 빨간색, 그 외엔 다음 라이브 안내
  const liveApp = paid.find((a) => a.cohort === cohort);
  const liveButton = (() => {
    if (!liveApp) return null;
    const schedule = schedulesByClass.get(`${liveApp.cohort}:${scheduleClassFor(liveApp.course, liveApp.track)}`);
    const state = liveState(liveApp, schedule?.days ?? []);
    if (!state.open) {
      return (
        <div className="rounded-3xl bg-slate-200 px-5 py-4 text-center text-slate-500">
          <p className="font-jua text-2xl">🔴 라이브 입장</p>
          <p className="mt-1 text-sm">{state.next ? `다음 라이브: ${state.next}` : "이번 달 라이브가 모두 끝났어요"}</p>
        </div>
      );
    }
    const slot = state.slot;
    const link = lectures
      .filter((l) => covers(liveApp, l) && (!l.slot || l.slot === slot))
      .sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
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
        const mine = lectures.filter((l) => covers(a, l));
        // 라이브 바로가기: 내 반·내 수강 시간에 가장 최근 올라온 강의 링크 (반·RC/LC·오전/저녁별 하나씩)
        const latest = new Map(mine.filter((l) => !a.slot || !l.slot || l.slot === a.slot).map((l) => [`${l.course}-${l.part}-${l.slot ?? ""}`, l]));
        const live = [...latest.values()].sort((x, y) => y.created_at.localeCompare(x.created_at));
        return (
          <section key={a.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-main px-3 py-1 text-sm font-bold text-sky-ink">{cohortLabel(a.cohort)}</span>
              <h2 className="font-jua text-2xl text-sky-ink">
                {COURSES[a.course].label} {TRACKS[a.track]}
              </h2>
            </div>
            {a.cohort === cohort && (
              <div className="mt-4 rounded-2xl bg-sky-soft p-4">
                <p className="font-jua text-lg text-sky-ink">📺 라이브 바로가기 {a.slot && <span className="text-sm text-slate-500">({TIME_SLOTS[a.slot]})</span>}</p>
                {live.length === 0 ? <p className="mt-2 text-sm text-slate-600">수업이 시작되면 여기에 올라와요</p> : (
                  <div className="mt-2 grid gap-2">
                    {live.map((l) => (
                      <a key={l.id} href={`https://youtu.be/${l.youtube_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5">
                        <span className="flex-1">
                          <b className="block text-sky-ink">{COURSES[l.course].label} {PARTS[l.part]}{l.slot ? ` · ${TIME_SLOTS[l.slot]}` : ""}</b>
                          <span className="text-xs text-slate-500">{l.title} · {dayLabel(new Date(Date.parse(l.created_at) + 9 * 3600 * 1000).toISOString().slice(0, 10))} 업로드</span>
                        </span>
                        <span className="text-sky-deep">보기 ↗</span>
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-500">가장 최근에 올라온 수업 링크예요 (종강일까지 시청 가능)</p>
              </div>
            )}
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
            {TRACK_PARTS[a.track].map((part) => {
              const list = mine.filter((l) => l.part === part);
              if (list.length === 0) return null;
              return (
                <div key={part} className="mt-5">
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
