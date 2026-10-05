import Link from "next/link";
import { COURSES, PARTS, TRACKS, TRACK_PARTS, cohortLabel, klassOf, todayKST, dayLabel } from "@/lib/config";
import { getApplications, listLectures, listApplications, listStamps, currentCohort, getSetting, type Application } from "@/lib/db";
import { getStudentIds } from "@/lib/auth";
import { canWatch, covers } from "@/lib/access";
import { studentLogout } from "@/app/actions";
import StudentLogin from "./StudentLogin";
import HomeworkUpload from "./HomeworkUpload";
import Cloud from "@/components/Cloud";

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
  const [liveStartAm, liveStartPm, liveSolveAm, liveSolvePm] = await Promise.all([
    getSetting("live_start_am"),
    getSetting("live_start_pm"),
    getSetting("live_solve_am"),
    getSetting("live_solve_pm"),
  ]);
  const liveLinks = {
    start: [{ label: "시작반 오전 라이브", id: liveStartAm }, { label: "시작반 저녁 라이브", id: liveStartPm }],
    solve: [{ label: "문풀반 오전 라이브", id: liveSolveAm }, { label: "문풀반 저녁 라이브", id: liveSolvePm }],
  };
  const today = todayKST();
  const everyone = paid.length ? await listApplications() : [];
  const peers = (a: Application) => everyone.filter((x) => x.cohort === a.cohort && klassOf(x) === klassOf(a)).map((x) => x.id);
  const peerIds = [...new Set(paid.flatMap(peers))];
  const stamps = await listStamps(peerIds);
  const board = (a: Application) => {
    const ids = new Set(peers(a));
    const att = new Set(stamps.attendance.filter((x) => x.app_id === a.id).map((x) => x.day));
    const late = new Set(stamps.attendance.filter((x) => x.app_id === a.id && x.late).map((x) => x.day));
    const hw = new Set(stamps.homework.filter((x) => x.app_id === a.id).map((x) => x.day));
    const days = [...new Set([...stamps.attendance.filter((x) => ids.has(x.app_id)).map((x) => x.day), ...hw])].sort();
    return { days, att, hw, late };
  };

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
                    <p className="text-sm text-slate-600">라이브 링크가 등록되면 여기에 안내해요.</p>
                  )}
                </div>
              </div>
            )}
            {(() => {
              const { days, att, hw, late } = board(a);
              return (
                <div className="mt-4 rounded-2xl bg-sky-soft p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-jua text-lg text-sky-ink">내 스티커판</p>
                    <p className="text-sm text-slate-600">
                      출석 ☁️ <b className="text-sky-deep">{att.size}</b>/{days.length} · 숙제 ⭐ <b className="text-sky-deep">{hw.size}</b>/{days.length}
                    </p>
                  </div>
                  {days.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">수업 시작하면 QR 출석과 숙제 인증으로 스티커가 모여요!</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8">
                      {days.map((d) => (
                        <div key={d} className={`flex flex-col items-center rounded-xl bg-white p-1.5 ${d === today ? "ring-2 ring-sky-deep" : ""}`}>
                          <span className="relative">
                            <Cloud className={`h-6 w-auto ${att.has(d) ? "fill-sky-main" : "fill-slate-200"}`} />
                            {late.has(d) && <span title="지각" className="absolute -right-2 -top-2 text-xs">⏰</span>}
                          </span>
                          <span className={`-mt-1 text-sm leading-none ${hw.has(d) ? "text-amber-400" : "text-slate-200"}`}>★</span>
                          <span className="mt-0.5 text-[11px] text-slate-500">{dayLabel(d)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {a.cohort === cohort && <HomeworkUpload appId={a.id} doneToday={hw.has(today)} />}
                </div>
              );
            })()}
            {mine.length === 0 && <p className="mt-4 text-slate-500">아직 올라온 강의가 없어요. 수업이 시작되면 여기에 올라와요!</p>}
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
