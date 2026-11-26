import Link from "next/link";
import { redirect } from "next/navigation";
import { COURSES, KINDS, cohortLabel, classSlotLabel, type CourseId } from "@/lib/config";
import { currentCohort, isPreview, listApplications } from "@/lib/db";
import { getViewing, isAdmin } from "@/lib/auth";
import { canWatch, isActive } from "@/lib/access";
import { classCohortNow } from "@/lib/classCohort";
import { viewAsStudent } from "@/app/actions";
import Icon from "@/components/Icon";
import LoginForm from "../LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "학생 화면으로 보기 · vella_toeic", robots: { index: false } };

// 머리의 [학생 | 강사]에서 '학생'을 누르면 오는 곳 (2026-11-26 Vella: 강사 로그인 후 '학생'을 누르면 학생 모드로)
// 이미 어떤 학생 화면을 보고 있으면 바로 그 화면으로, 아니면 반별 빠른 보기 + 이름 검색으로 한 명을 골라요.
// 고르면 그 학생 화면을 보기 전용으로 열어요(vella_view, 학생 쪽 기록은 아무것도 안 바뀌어요).
export default async function ViewAsPage({ searchParams }: { searchParams: Promise<{ q?: string; pick?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { q = "", pick } = await searchParams;
  if (!pick && (await getViewing())) redirect("/go");

  const [classCohort, recruit] = await Promise.all([classCohortNow(), currentCohort()]);
  const cohorts = [...new Set([classCohort, recruit])].sort();
  // 강의실이 열린 학생(납부 완료·발송/수령 완료)만: 학생이 실제로 보는 화면과 같게
  const apps = (await listApplications())
    .filter((a) => cohorts.includes(a.cohort) && isActive(a) && canWatch(a))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const quick = (Object.keys(COURSES) as CourseId[]).map((course) => ({ course, app: apps.find((a) => a.cohort === classCohort && a.course === course) ?? apps.find((a) => a.course === course) ?? null }));
  const term = q.trim();
  const found = term ? apps.filter((a) => `${a.name} ${a.depositor}`.includes(term)) : apps.slice(0, 30);

  const ViewButton = ({ id, children, className }: { id: string; children: React.ReactNode; className: string }) => (
    <form action={viewAsStudent}>
      <input type="hidden" name="app_id" value={id} />
      <button className={className}>{children}</button>
    </form>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5 pt-8">
      <div>
        <h1 className="flex items-center gap-2 font-jua text-3xl text-sky-ink"><Icon name="people" size={34} />학생 화면으로 보기</h1>
        <p className="mt-1 text-sm text-slate-600">고른 학생이 보는 첫 화면·강의실을 그대로 봐요. <b>보기만 되고</b> 출석·숙제·테스트 같은 기록은 아무것도 바뀌지 않아요. 위쪽 띠의 [끝내기]나 [강사]로 돌아와요.</p>
      </div>

      <section className="card space-y-3">
        <p className="font-jua text-lg text-sky-ink">반별로 바로 보기 <span className="font-body text-sm font-normal text-slate-400">· {cohortLabel(classCohort)} 납부 완료 학생 중 최근 신청</span></p>
        <div className="grid gap-2 sm:grid-cols-3">
          {quick.map(({ course, app }) =>
            app ? (
              <ViewButton key={course} id={app.id} className="btn w-full flex-col !items-start !py-3 text-left">
                <span className="block font-jua text-lg">{COURSES[course].label} 학생으로</span>
                <span className="block text-xs font-normal opacity-90">{app.name} · {KINDS[app.kind].short}</span>
              </ViewButton>
            ) : (
              <p key={course} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-400">{COURSES[course].label} · 납부 완료 학생 없음</p>
            ),
          )}
        </div>
      </section>

      <section className="card space-y-3">
        <form className="flex gap-2">
          <input name="q" defaultValue={term} placeholder="학생 이름·입금자로 찾기" className="input flex-1 !py-2" />
          <button className="btn-ghost !py-2">찾기</button>
          {term && <Link href="/admin/view-as?pick=1" className="self-center text-sm text-slate-400 underline">지우기</Link>}
        </form>
        <p className="text-xs text-slate-500">{term ? `'${term}' ${found.length}명` : `최근 신청 ${found.length}명`} · {cohorts.map(cohortLabel).join(" · ")} 납부 완료</p>
        {found.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">보여줄 학생이 없어요. (납부 완료된 학생만 강의실이 열려요)</p>
        ) : (
          <ul className="divide-y divide-sky-soft">
            {found.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <b className="text-sky-ink">{a.name}</b>
                  <span className="ml-1.5 text-xs text-slate-400">{cohortLabel(a.cohort)} · {KINDS[a.kind].short}</span>
                  <span className="block truncate text-sm text-slate-600">{classSlotLabel(a)}</span>
                </span>
                <ViewButton id={a.id} className="btn-ghost shrink-0 !px-4 !py-2 text-sm">이 학생으로 보기</ViewButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
