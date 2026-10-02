import Link from "next/link";
import { COURSES, PARTS, TRACKS, TRACK_PARTS, cohortLabel } from "@/lib/config";
import { getApplications, listLectures } from "@/lib/db";
import { getStudentIds } from "@/lib/auth";
import { canWatch, covers } from "@/lib/access";
import { studentLogout } from "@/app/actions";
import StudentLogin from "./StudentLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "강의실 · vella_toeic", robots: { index: false } };

export default async function ClassRoom() {
  const apps = await getApplications(await getStudentIds());
  if (apps.length === 0) return <StudentLogin />;

  const name = apps[0].name;
  const paid = apps.filter(canWatch).sort((a, b) => b.cohort.localeCompare(a.cohort));
  const lectures = paid.length ? await listLectures() : [];

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
