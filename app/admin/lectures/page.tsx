import { COURSES, PARTS, cohortLabel, type CourseId, type Part } from "@/lib/config";
import { listLectures, currentCohort, isPreview } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { removeLecture } from "@/app/actions";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";
import UploadForm from "./UploadForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function Lectures() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const now = await currentCohort();
  const all = await listLectures();
  const cohorts = [...new Set([now, ...all.map((l) => l.cohort)])].sort().reverse();

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="lectures" />

      <div className="card space-y-2 text-sm text-slate-600">
        <p className="font-jua text-lg text-sky-ink">유튜브 업로드 방법</p>
        <p>1. 유튜브에 강의를 올릴 때 공개 범위를 <b className="text-sky-deep">&apos;일부 공개&apos;</b>로 선택해요.</p>
        <p>2. 영상 링크를 복사해서 아래에 붙여넣고 반·RC/LC·제목을 고르면 끝!</p>
        <p>3. 해당 기수에서 그 반을 신청하고 납부가 확인된 학생에게만 보여요.</p>
      </div>

      <UploadForm defaultCohort={now} />

      {cohorts.map((c) => {
        const ls = all.filter((l) => l.cohort === c);
        if (ls.length === 0) return null;
        return (
          <section key={c} className="card">
            <h2 className="font-jua text-2xl text-sky-ink">{cohortLabel(c)}</h2>
            {(Object.keys(COURSES) as CourseId[]).map((course) =>
              (Object.keys(PARTS) as Part[]).map((part) => {
                const list = ls.filter((l) => l.course === course && l.part === part);
                if (list.length === 0) return null;
                return (
                  <div key={course + part} className="mt-4">
                    <p className="font-jua mb-2 text-sky-deep">
                      {COURSES[course].label} {PARTS[part]} · {list.length}개
                    </p>
                    <ol className="space-y-2">
                      {list.map((l, i) => (
                        <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-sky-soft px-4 py-2">
                          <span className="font-jua w-6 text-sky-deep">{i + 1}</span>
                          <a
                            href={`https://youtu.be/${l.youtube_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 text-slate-800 hover:underline"
                          >
                            {l.title}
                          </a>
                          <form action={removeLecture}>
                            <input type="hidden" name="id" value={l.id} />
                            <button className="text-xs text-slate-400 hover:text-red-500">삭제</button>
                          </form>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              }),
            )}
          </section>
        );
      })}
    </div>
  );
}
