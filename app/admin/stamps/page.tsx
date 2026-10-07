import Link from "next/link";
import { COURSES, KINDS, KLASSES, TIME_SLOTS, TRACKS, cohortLabel, dayLabel, klassOf, takesSharedLc, todayKST, type CourseId, type Klass, type Track } from "@/lib/config";
import { listApplications, listStamps, currentCohort, isPreview } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { canWatch } from "@/lib/access";
import { isHomeworkStickerEligible } from "@/lib/schedule";
import { bulkStamp, cancelHomeworkSticker, cleanupPhotos, markAttendanceManual } from "@/app/actions";
import SelectAll from "../SelectAll";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const SLOT_FILTERS = [["am", "오전반"], ["pm", "저녁반"], ["all", "전체"]] as const;

export default async function Stamps({ searchParams }: { searchParams: Promise<{ k?: string; t?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { k = "start-daily", t = "am" } = await searchParams;
  const klass = (Object.hasOwn(KLASSES, k) ? k : "start-daily") as Klass;
  const cohort = await currentCohort();
  const today = todayKST();

  const everyone = (await listApplications()).filter((a) => a.cohort === cohort && canWatch(a));
  // 일괄 붙이기 대상: 수강 시간으로 걸러서 반별로 묶어요.
  const bulkApps = everyone
    .filter((a) => (t === "all" ? true : a.slot === t))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const bulkGroups = (Object.keys(COURSES) as CourseId[]).flatMap((co) =>
    (Object.keys(TRACKS) as Track[]).map((tr) => ({ key: `${co}-${tr}`, title: `${COURSES[co].label} ${TRACKS[tr]}`, items: bulkApps.filter((a) => a.course === co && a.track === tr) })),
  ).filter((g) => g.items.length > 0);

  const apps = everyone
    .filter((a) => (klass === "lc-common" ? takesSharedLc(a) : klassOf(a) === klass))
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
          <p className="text-sm text-slate-500">QR 하나를 강의실에 붙이고 라이브에 띄워 주세요.<br />찍으면 그날 출석으로 남아요.</p>
        </div>
        <Link href="/admin/qr" target="_blank" className="btn !py-3">출석 QR 인쇄하기</Link>
      </div>

      <form action={bulkStamp} className="card space-y-3">
        <div>
          <p className="font-jua text-xl text-sky-ink">스티커 일괄 붙이기</p>
          <p className="text-sm text-slate-500">QR이 안 됐던 날처럼 여러 학생에게 한 번에 출석(+숙제) 스티커를 붙여요. 이미 붙은 스티커는 그대로예요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-slate-500">수강 시간</span>
          {SLOT_FILTERS.map(([v, label]) => (
            <a key={v} href={`/admin/stamps?k=${klass}&t=${v}`} className={`rounded-full px-3 py-1.5 font-bold ${t === v ? "bg-sky-deep text-white" : "bg-sky-soft text-sky-ink"}`}>{label}</a>
          ))}
        </div>
        {bulkGroups.length === 0 ? <p className="text-sm text-slate-500">해당하는 납부 완료 학생이 없어요.</p> : (
          <>
            <label className="flex items-center gap-2 text-sm font-bold text-sky-ink"><SelectAll group="*" /> 아래 {bulkApps.length}명 전체 선택</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {bulkGroups.map((g) => (
                <div key={g.key} className="rounded-2xl bg-sky-soft p-3">
                  <label className="flex items-center gap-2 font-jua text-sky-ink"><SelectAll group={g.key} /> {g.title} · {g.items.length}명</label>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {g.items.map((a) => (
                      <label key={a.id} className="flex items-center gap-1">
                        <input type="checkbox" name="ids" value={a.id} data-group={g.key} className="h-4 w-4 accent-sky-deep" />
                        {a.name}<span className="text-[11px] text-slate-400">{KINDS[a.kind].short}{a.slot ? ` · ${TIME_SLOTS[a.slot]}` : ""}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label><span className="label">수업 날짜</span><input type="date" name="day" defaultValue={today} max={today} required className="input !py-2" /></label>
              <button name="what" value="attendance" className="btn-ghost !py-2.5">선택 학생 출석 ☁️</button>
              <button name="what" value="both" className="btn !py-2.5 !text-base">선택 학생 출석 ☁️ + 숙제 ⭐</button>
            </div>
          </>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(KLASSES) as Klass[]).map((x) => (
          <a key={x} href={`/admin/stamps?k=${x}&t=${t}`} className={`rounded-full px-4 py-2 text-sm font-bold ${x === klass ? "bg-sky-deep text-white" : "bg-white text-sky-ink"}`}>
            {KLASSES[x]}
          </a>
        ))}
      </div>

      <section className="card overflow-x-auto">
        <h2 className="font-jua text-2xl text-sky-ink">
          {cohortLabel(cohort)} {KLASSES[klass]} <span className="text-base text-slate-400">· {apps.length}명 · 수업 {days.length}회</span>
        </h2>
        <p className="mt-1 text-xs text-slate-500">☁️ 출석(빈 구름을 누르면 직접 처리) · ⭐ 숙제(누르면 사진) · 빨간 이름 = 결석 3회 이상</p>
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
                const hw = days.filter((d) => {
                  const stamp = has(homework, a.id, d) as { created_at?: string } | undefined;
                  return !!stamp && isHomeworkStickerEligible(d, stamp.created_at);
                }).length;
                return (
                  <tr key={a.id} className="border-b border-sky-soft">
                    <td className={`sticky left-0 bg-white py-2 pr-3 text-left ${days.length - att >= 3 ? "font-bold text-red-500" : ""}`}>
                      {a.name}
                      <span className="ml-1 text-[11px] text-slate-400">{KINDS[a.kind].short}{a.track === "rc" || a.track === "lc" ? ` ${TRACKS[a.track]}` : ""}</span>
                    </td>
                    {days.map((d) => {
                      const h = has(homework, a.id, d) as { photo_path?: string | null; created_at?: string } | undefined;
                      const hasStar = !!h && isHomeworkStickerEligible(d, h.created_at);
                      return (
                        <td key={d} className="px-1 py-2 whitespace-nowrap">
                          {has(attendance, a.id, d) ? (
                            <span title="출석">☁️</span>
                          ) : (
                            <form action={markAttendanceManual} className="inline">
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="day" value={d} />
                              <button className="opacity-25 hover:opacity-100" aria-label={`${a.name} ${dayLabel(d)} 출석 처리`}>☁️</button>
                            </form>
                          )}
                          {h ? (
                            <form action={cancelHomeworkSticker} className="inline">
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="day" value={d} />
                              <button className={hasStar ? "" : "opacity-35"} aria-label={`${a.name} ${dayLabel(d)} 숙제 제출 기록 취소`} title={hasStar ? "별 스티커가 있어요. 누르면 기록을 취소해요." : "제출 기록은 있지만 제출이 늦어 별은 없어요. 누르면 기록을 취소해요."}>{hasStar ? "⭐" : "✓"}</button>
                              {h.photo_path && <a className="ml-1 text-xs" href={`/admin/photo?p=${encodeURIComponent(h.photo_path)}`} target="_blank" rel="noreferrer" aria-label="기존 숙제 사진 보기">📷</a>}
                            </form>
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

      <form action={markAttendanceManual} className="card flex flex-wrap items-end gap-3">
        <div className="w-full">
          <p className="font-jua text-lg text-sky-ink">표에 없는 날짜 출석 보정</p>
          <p className="text-sm text-slate-500">그날 출석한 학생이 아무도 없어 표에 날짜가 없을 때 사용해요.</p>
        </div>
        <label className="min-w-48 flex-1">
          <span className="label">수강생</span>
          <select name="id" required className="input">
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name} · {KINDS[a.kind].short}</option>)}
          </select>
        </label>
        <label>
          <span className="label">수업 날짜</span>
          <input type="date" name="day" required className="input" />
        </label>
        <button className="btn !py-3" disabled={apps.length === 0}>출석 처리</button>
      </form>

      <form action={cleanupPhotos} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">예전 기수 숙제 사진 정리 (새 숙제 인증은 카페 링크를 사용해요)</p>
        <button className="btn-ghost !py-2">지난 기수 사진 지우기</button>
      </form>
    </div>
  );
}
