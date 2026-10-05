import Link from "next/link";
import { COURSES, PARTS, TRACKS, TRACK_PARTS, cohortLabel, todayKST } from "@/lib/config";
import { getApplications, listLectures, listStamps, currentCohort, getSetting } from "@/lib/db";
import { getStudentIds } from "@/lib/auth";
import { canWatch, covers } from "@/lib/access";
import { studentLogout } from "@/app/actions";
import StudentLogin from "./StudentLogin";
import StickerBoard from "./StickerBoard";
import { defaultHolidays, defaultSchoolDays, holidayKey, parseHolidays, parseSchoolDays, scheduleClassFor, scheduleKey } from "@/lib/schedule";

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
  const [liveStartAm, liveStartPm, liveSolveAm, liveSolvePm, cafeUrl] = await Promise.all([
    getSetting("live_start_am"),
    getSetting("live_start_pm"),
    getSetting("live_solve_am"),
    getSetting("live_solve_pm"),
    getSetting("cafe_homework_url"),
  ]);
  const liveLinks = {
    start: [{ label: "시작반 오전 라이브", id: liveStartAm }, { label: "시작반 저녁 라이브", id: liveStartPm }],
    solve: [{ label: "문풀반 오전 라이브", id: liveSolveAm }, { label: "문풀반 저녁 라이브", id: liveSolvePm }],
  };
  const today = todayKST();
  const stamps = await listStamps(paid.map((a) => a.id));
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
      days: rawDays ? parseSchoolDays(rawDays, appCohort) : defaultSchoolDays(appCohort, klass),
      holidays: rawHolidays ? parseHolidays(rawHolidays, appCohort) : defaultHolidays(appCohort),
    }] as const;
  })));

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

      <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-deep">강의 영상은 개강일 이후부터 열람할 수 있어요.</p>

      {paid.length === 0 && (
        <div className="card text-center">
          <p className="font-jua text-xl text-sky-ink">납부 확인 후 강의실이 열려요</p>
          <p className="mt-2 text-slate-600">입금이 확인되면 수강 신청한 반의 강의를 바로 볼 수 있어요.</p>
          <Link href={`/my/${apps[0].id}`} className="btn-ghost mt-4">납부 상태 확인하기</Link>
        </div>
      )}

      {paid.map((a) => {
        const mine = lectures.filter((l) => covers(a, l));
        return (
          <section key={a.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-main px-3 py-1 text-sm font-bold text-sky-ink">{cohortLabel(a.cohort)}</span>
              <h2 className="font-jua text-2xl text-sky-ink">
                {COURSES[a.course].label} {TRACKS[a.track]}
              </h2>
            </div>
            {a.cohort === cohort && a.status !== "pending" && (
              <div className="mt-4 rounded-2xl bg-sky-soft p-4">
                <p className="font-jua text-lg text-sky-ink">오늘 수업 라이브</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(a.course === "intensive" ? [...liveLinks.start, ...liveLinks.solve] : liveLinks[a.course]).filter((link) => link.id).map((link) => (
                    <a key={link.label} href={`https://youtu.be/${link.id}`} target="_blank" rel="noreferrer" className="btn-ghost !py-2">{link.label} 보기 ↗</a>
                  ))}
                  {(a.course === "intensive" ? [...liveLinks.start, ...liveLinks.solve] : liveLinks[a.course]).every((link) => !link.id) && (
                    <p className="text-sm text-slate-600">수업이 시작되면 여기에 올라와요</p>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">(종강일까지 시청 가능)</p>
              </div>
            )}
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
                          <span className="font-jua flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sky-deep">
                            {i + 1}
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
