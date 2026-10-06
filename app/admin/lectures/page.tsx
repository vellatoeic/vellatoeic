import { COURSES, PARTS, LECTURE_COURSES, TIME_SLOTS, cohortLabel, type Part } from "@/lib/config";
import { listLectures, currentCohort, isPreview } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { editLecture, removeLecture } from "@/app/actions";
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
        <p>2. 영상 링크를 복사해서 아래에 붙여넣고 반·RC/LC·오전반/저녁반·제목을 고르면 끝!</p>
        <p>3. 해당 기수에서 그 반을 신청하고 납부가 확인된 학생에게만 보여요.</p>
        <p>4. 가장 최근에 올린 링크가 학생 강의실 &apos;라이브 바로가기&apos;에 바로 연결돼요. (오전반 학생은 오전반 링크, 저녁반 학생은 저녁반 링크)</p>
      </div>

      <UploadForm defaultCohort={now} />

      {cohorts.map((c) => {
        const ls = all.filter((l) => l.cohort === c);
        if (ls.length === 0) return null;
        return (
          <section key={c} className="card">
            <h2 className="font-jua text-2xl text-sky-ink">{cohortLabel(c)}</h2>
            {LECTURE_COURSES.map((course) =>
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
                        <li key={l.id} className="rounded-2xl bg-sky-soft px-4 py-2">
                          <details className="group">
                            <summary className="flex list-none items-center gap-3">
                              <span className={`font-jua shrink-0 rounded-full px-2 py-0.5 text-xs ${l.slot ? "bg-white text-sky-deep" : "bg-amber-100 text-amber-700"}`}>{l.slot ? TIME_SLOTS[l.slot] : `${i + 1} · 구분 없음`}</span>
                              <a
                                href={`https://youtu.be/${l.youtube_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 text-slate-800 hover:underline"
                              >
                                {l.title}
                              </a>
                              <span className="cursor-pointer text-xs text-slate-500 hover:text-sky-deep group-open:text-sky-deep">수정</span>
                              <form action={removeLecture}>
                                <input type="hidden" name="id" value={l.id} />
                                <button className="text-xs text-slate-400 hover:text-red-500">삭제</button>
                              </form>
                            </summary>
                            <form action={editLecture} className="mt-3 grid gap-2 rounded-xl bg-white p-3 text-sm">
                              <input type="hidden" name="id" value={l.id} />
                              <label><span className="text-xs text-slate-500">강의 제목</span><input name="title" defaultValue={l.title} required className="input !py-2" /></label>
                              <label><span className="text-xs text-slate-500">유튜브 링크</span><input name="url" defaultValue={`https://youtu.be/${l.youtube_id}`} required className="input !py-2" /></label>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <label><span className="text-xs text-slate-500">기수</span><input type="month" name="cohort" defaultValue={l.cohort} required className="input !py-2" /></label>
                                <label><span className="text-xs text-slate-500">반</span>
                                  <select name="course" defaultValue={l.course} className="input !py-2">
                                    {LECTURE_COURSES.map((co) => <option key={co} value={co}>{COURSES[co].label}</option>)}
                                  </select>
                                </label>
                                <label><span className="text-xs text-slate-500">오전/저녁</span>
                                  <select name="slot" defaultValue={l.slot ?? ""} className="input !py-2">
                                    <option value="">구분 없음</option>
                                    <option value="am">오전반</option>
                                    <option value="pm">저녁반</option>
                                  </select>
                                </label>
                                <label><span className="text-xs text-slate-500">RC/LC</span>
                                  <select name="part" defaultValue={l.part} className="input !py-2">
                                    {(Object.keys(PARTS) as Part[]).map((p) => <option key={p} value={p}>{PARTS[p]}</option>)}
                                  </select>
                                </label>
                              </div>
                              <button className="btn !py-2 !text-sm">수정 저장</button>
                            </form>
                          </details>
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
