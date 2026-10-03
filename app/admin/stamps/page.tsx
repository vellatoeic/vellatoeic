import Link from "next/link";
import { KINDS, KLASSES, TRACKS, cohortLabel, dayLabel, klassOf, type Klass } from "@/lib/config";
import { listApplications, listStamps, currentCohort, isPreview } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { canWatch } from "@/lib/access";
import { cleanupPhotos } from "@/app/actions";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function Stamps({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { k = "start-daily" } = await searchParams;
  const klass = (Object.hasOwn(KLASSES, k) ? k : "start-daily") as Klass;
  const cohort = await currentCohort();

  const apps = (await listApplications())
    .filter((a) => a.cohort === cohort && canWatch(a) && klassOf(a) === klass)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const { attendance, homework } = await listStamps(apps.map((a) => a.id));
  const days = [...new Set([...attendance.map((x) => x.day), ...homework.map((x) => x.day)])].sort();
  const has = (list: { app_id: string; day: string }[], id: string, d: string) => list.find((x) => x.app_id === id && x.day === d);

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="stamps" />

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-jua text-xl text-sky-ink">출석 QR</p>
          <p className="text-sm text-slate-500">반별로 한 장씩 출력해 강의실에 붙여 두면 끝. 수업 시간에만 출석이 열려요.</p>
        </div>
        <Link href="/admin/qr" target="_blank" className="btn !py-3">출석 QR 인쇄하기</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(KLASSES) as Klass[]).map((x) => (
          <a key={x} href={`/admin/stamps?k=${x}`} className={`rounded-full px-4 py-2 text-sm font-bold ${x === klass ? "bg-sky-deep text-white" : "bg-white text-sky-ink"}`}>
            {KLASSES[x]}
          </a>
        ))}
      </div>

      <section className="card overflow-x-auto">
        <h2 className="font-jua text-2xl text-sky-ink">
          {cohortLabel(cohort)} {KLASSES[klass]} <span className="text-base text-slate-400">· {apps.length}명 · 수업 {days.length}회</span>
        </h2>
        <p className="mt-1 text-xs text-slate-500">☁️ 출석 · ⭐ 숙제(누르면 사진) · 빨간 이름 = 결석 3회 이상</p>
        {apps.length === 0 ? (
          <p className="mt-4 text-slate-500">납부 완료된 수강생이 아직 없어요.</p>
        ) : (
          <table className="mt-4 min-w-full text-center text-sm">
            <thead>
              <tr className="border-b border-sky-main text-slate-500">
                <th className="sticky left-0 bg-white py-2 pr-3 text-left">이름</th>
                {days.map((d) => <th key={d} className="px-1 py-2 font-normal">{dayLabel(d)}</th>)}
                <th className="px-2 py-2">출석</th>
                <th className="px-2 py-2">숙제</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const att = days.filter((d) => has(attendance, a.id, d)).length;
                const hw = days.filter((d) => has(homework, a.id, d)).length;
                return (
                  <tr key={a.id} className="border-b border-sky-soft">
                    <td className={`sticky left-0 bg-white py-2 pr-3 text-left ${days.length - att >= 3 ? "font-bold text-red-500" : ""}`}>
                      {a.name}
                      <span className="ml-1 text-[11px] text-slate-400">{KINDS[a.kind].short}{a.track === "rc" || a.track === "lc" ? ` ${TRACKS[a.track]}` : ""}</span>
                    </td>
                    {days.map((d) => {
                      const h = has(homework, a.id, d) as { photo_path?: string } | undefined;
                      return (
                        <td key={d} className="px-1 py-2 whitespace-nowrap">
                          <span className={has(attendance, a.id, d) ? "" : "opacity-20"}>☁️</span>
                          {h?.photo_path ? (
                            <a href={`/admin/photo?p=${encodeURIComponent(h.photo_path)}`} target="_blank" rel="noreferrer">⭐</a>
                          ) : (
                            <span className="opacity-20">⭐</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 font-bold text-sky-deep">{att}</td>
                    <td className="px-2 py-2 font-bold text-amber-500">{hw}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <form action={cleanupPhotos} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">지난 기수 숙제 사진 정리 (스티커 기록은 남아요 · 저장 공간 확보)</p>
        <button className="btn-ghost !py-2">지난 기수 사진 지우기</button>
      </form>
    </div>
  );
}
