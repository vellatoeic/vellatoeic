import Link from "next/link";
import { COURSES, KINDS, TIME_SLOTS, TRACKS, cohortLabel, dayLabel, todayKST, type CourseId, type Track } from "@/lib/config";
import { listApplications, listStamps, currentCohort, isPreview, type Application, type Attendance } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { canWatch } from "@/lib/access";
import { classDaysOf, holidaysOf } from "@/lib/classCalendar";
import { specialDay } from "@/lib/special";
import { bulkStamp, cleanupPhotos, cycleAttendance } from "@/app/actions";
import SelectAll from "../SelectAll";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "출결 · vella_toeic", robots: { index: false } };

const SLOT_FILTERS = [["am", "오전반"], ["pm", "저녁반"], ["all", "전체"]] as const;
type SlotKey = "am" | "pm" | null;
const SLOT_NAME = (s: SlotKey) => (s === "am" ? "☀️ 오전반" : s === "pm" ? "🌙 저녁반" : "시간 미정");

// 칸 표시: ● 출석 / ◐ 지각 / · 결석 / 빈칸 = 아직 안 온 날(오늘 이후, 오늘 아직 기록 없음)
function mark(rec: Attendance | undefined, day: string, today: string) {
  if (rec) return rec.late ? { t: "◐", cls: "text-amber-500", label: "지각" } : { t: "●", cls: "text-sky-deep", label: "출석" };
  if (day >= today) return { t: "", cls: "", label: "아직" };
  return { t: "·", cls: "text-red-400", label: "결석" };
}

export default async function Stamps({ searchParams }: { searchParams: Promise<{ b?: string; d?: string; t?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const sp = await searchParams;
  const cohort = await currentCohort();
  const today = todayKST();
  const t = sp.t ?? "am";

  const everyone = (await listApplications()).filter((a) => a.cohort === cohort && canWatch(a));
  const holidays = await holidaysOf(cohort);
  const { attendance, homework } = await listStamps(everyone.map((a) => a.id));
  const rec = (id: string, day: string) => attendance.find((x) => x.app_id === id && x.day === day);
  const hw = (id: string, day: string) => homework.find((x) => x.app_id === id && x.day === day);

  // 반(신청한 반) 목록과 반별 수업일 (공휴일 제외)
  const classTabs = await Promise.all((Object.keys(COURSES) as CourseId[]).flatMap((co) =>
    (Object.keys(TRACKS) as Track[]).map((tr) => ({ key: `${co}-${tr}`, title: `${COURSES[co].label} ${TRACKS[tr]}`, course: co, track: tr })),
  ).filter((c) => everyone.some((a) => a.course === c.course && a.track === c.track)).map(async (c) => {
    const days = (await classDaysOf({ cohort, course: c.course, track: c.track })).filter((x) => !holidays[x]);
    const students = everyone.filter((a) => a.course === c.course && a.track === c.track).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return { ...c, days, students };
  }));
  const current = classTabs.find((c) => c.key === sp.b) ?? classTabs[0];
  // 날짜는 수업이 있는 날만 골라요 (어느 반이든 수업이 있는 날). 기본: 오늘, 오늘 수업이 없으면 가장 최근 수업일
  const allDays = [...new Set(classTabs.flatMap((c) => c.days))].sort();
  const d = allDays.includes(sp.d ?? "") ? sp.d! : allDays.filter((x) => x <= today).at(-1) ?? allDays[0] ?? today;
  const prev = allDays.filter((x) => x < d).at(-1);
  const next = allDays.filter((x) => x > d && x <= today).at(0);
  const slotsOf = (students: Application[]): SlotKey[] => [...(["am", "pm"] as const), ...(students.some((a) => !a.slot) ? [null] : [])];

  // 일괄 붙이기 (기존 기능)
  const bulkApps = everyone.filter((a) => (t === "all" ? true : a.slot === t)).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const bulkGroups = classTabs.map((c) => ({ key: c.key, title: c.title, items: bulkApps.filter((a) => a.course === c.course && a.track === c.track) })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="stamps" />

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-jua text-xl text-sky-ink">출석 QR</p>
          <p className="text-sm text-slate-500">QR 하나를 강의실에 붙이고 라이브에 띄워 주세요.<br />수업이 있는 날 찍으면 그날 출석으로 남아요(하루 한 번).</p>
        </div>
        <Link href="/admin/qr" target="_blank" className="btn !py-3">출석 QR 인쇄하기</Link>
      </div>

      {/* ── 그날 수업 보드: 반·시간대마다 누가 왔고 누가 숙제를 냈는지 ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {prev ? <a href={`/admin/stamps?d=${prev}&b=${current?.key ?? ""}`} className="btn-ghost !px-3 !py-2 text-sm">◀ {dayLabel(prev)}</a> : <span className="w-16" />}
            <h2 className="font-jua text-2xl text-sky-ink">{specialDay(d)} 수업 {d === today && <span className="text-base text-sky-deep">· 오늘</span>}</h2>
            {next ? <a href={`/admin/stamps?d=${next}&b=${current?.key ?? ""}`} className="btn-ghost !px-3 !py-2 text-sm">{dayLabel(next)} ▶</a> : null}
          </div>
          {d !== allDays.filter((x) => x <= today).at(-1) && <a href="/admin/stamps" className="text-sm text-sky-deep underline">최근 수업일로</a>}
        </div>
        <p className="text-xs text-slate-500">이름을 누르면 출석 처리돼요 (한 번 더 누르면 ◐ 지각, 또 누르면 결석으로 돌아가요).</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {classTabs.filter((c) => c.days.includes(d)).flatMap((c) => slotsOf(c.students).map((sl) => {
            const group = c.students.filter((a) => (a.slot ?? null) === sl);
            if (group.length === 0) return null;
            const came = group.filter((a) => rec(a.id, d));
            const notYet = group.filter((a) => !rec(a.id, d));
            const did = group.filter((a) => hw(a.id, d));
            const notDid = group.filter((a) => !hw(a.id, d));
            const chip = (a: Application, kind: "in" | "out") => {
              const r = rec(a.id, d);
              return (
                <form key={a.id} action={cycleAttendance} className="inline">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="day" value={d} />
                  <button title={kind === "in" ? "누르면 지각/결석으로 바꿔요" : "누르면 출석 처리돼요"}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold ${kind === "out" ? "bg-white text-slate-500 ring-1 ring-slate-200" : r?.late ? "bg-amber-100 text-amber-700" : "bg-sky-deep text-white"}`}>
                    {kind === "in" && (r?.late ? "◐ " : "● ")}{a.name}<span className="ml-1 text-[10px] font-normal opacity-70">{KINDS[a.kind].short}</span>
                  </button>
                </form>
              );
            };
            return (
              <article key={c.key + sl} className="card space-y-3 !p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-jua text-lg text-sky-ink">{c.title} · {SLOT_NAME(sl)}</p>
                  <p className="shrink-0 text-sm text-slate-500">{group.length}명</p>
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-bold text-sky-ink">☁️ 출석 {came.length} / {group.length}{came.some((a) => rec(a.id, d)?.late) ? ` · 지각 ${came.filter((a) => rec(a.id, d)?.late).length}` : ""}</p>
                  <div className="flex flex-wrap gap-1.5">{came.map((a) => chip(a, "in"))}</div>
                  {notYet.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-2 text-sm font-bold text-red-500">{d < today ? "결석" : "아직 안 옴"} {notYet.length}</p>
                      <div className="flex flex-wrap gap-1.5">{notYet.map((a) => chip(a, "out"))}</div>
                    </>
                  )}
                </div>
                <div className="border-t border-sky-soft pt-2">
                  <p className="mb-1.5 text-sm font-bold text-amber-600">⭐ 숙제 {did.length} / {group.length}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {did.map((a) => <span key={a.id} className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700">{a.name}</span>)}
                  </div>
                  {notDid.length > 0 && <p className="mt-2 text-sm text-slate-500">미제출 {notDid.length}: {notDid.map((a) => a.name).join(", ")}</p>}
                </div>
              </article>
            );
          }))}
        </div>
        {classTabs.every((c) => !c.days.includes(d)) && <p className="card text-center text-slate-500">이 날은 수업이 없어요.</p>}
      </section>

      {/* ── 월간 출결표 (필요할 때만 펼쳐요) ── */}
      <details className="card !p-4">
        <summary className="font-jua cursor-pointer text-lg text-sky-ink">📅 반별 월간 출결표 · 학생별 기록</summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {classTabs.map((c) => (
              <a key={c.key} href={`/admin/stamps?b=${c.key}&d=${d}&t=${t}#month`} className={`rounded-full px-4 py-2 text-sm font-bold ${c.key === current?.key ? "bg-sky-deep text-white" : "bg-sky-soft text-sky-ink"}`}>{c.title}</a>
            ))}
          </div>
          <div id="month">
      {!current ? <p className="card text-center text-slate-500">납부 완료된 수강생이 아직 없어요.</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {slotsOf(current.students).map((sl) => {
            const group = current.students.filter((a) => (a.slot ?? null) === sl);
            return (
              <section key={String(sl)} className="card overflow-x-auto !p-4">
                <h3 className="font-jua text-xl text-sky-ink">{cohortLabel(cohort)} {current.title} · {SLOT_NAME(sl)} <span className="text-sm text-slate-400">· {group.length}명 · 수업 {current.days.length}회</span></h3>
                <p className="mt-1 text-xs text-slate-500">● 출석 · ◐ 지각 · <span className="text-red-400">·</span> 결석 · 빈칸 = 아직 안 온 날 · 칸을 누르면 출석 → 지각 → 결석 순서로 바뀌어요 · 이름을 누르면 학생별 기록</p>
                {group.length === 0 ? <p className="mt-3 text-sm text-slate-400">학생이 없어요.</p> : (
                  <table className="mt-3 min-w-full text-center text-sm">
                    <thead>
                      <tr className="border-b border-sky-main text-slate-500">
                        <th className="sticky left-0 bg-white py-1.5 pr-2 text-left">이름</th>
                        {current.days.map((day) => <th key={day} className={`px-0.5 py-1.5 text-[11px] font-normal ${day === d ? "rounded bg-sky-main/50 text-sky-ink" : ""}`}>{dayLabel(day)}</th>)}
                        <th className="px-1 py-1.5 text-xs">출석</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((a) => {
                        const cnt = current.days.filter((day) => rec(a.id, day)).length;
                        const absentCnt = current.days.filter((day) => day < today && !rec(a.id, day)).length;
                        return (
                          <tr key={a.id} className="border-b border-sky-soft">
                            <td className={`sticky left-0 whitespace-nowrap bg-white py-1 pr-2 text-left ${absentCnt >= 3 ? "font-bold text-red-500" : ""}`}>
                              <Link href={`/admin/stamps/${a.id}`} className="underline decoration-sky-main underline-offset-2">{a.name}</Link>
                              <span className="ml-1 text-[11px] text-slate-400">{KINDS[a.kind].short}</span>
                            </td>
                            {current.days.map((day) => {
                              const m = mark(rec(a.id, day), day, today);
                              return (
                                <td key={day} className={`px-0.5 ${day === d ? "bg-sky-soft" : ""}`}>
                                  {day > today ? <span className="inline-block h-7 w-6" /> : (
                                    <form action={cycleAttendance}>
                                      <input type="hidden" name="id" value={a.id} />
                                      <input type="hidden" name="day" value={day} />
                                      <button title={`${a.name} ${dayLabel(day)} ${m.label} — 누르면 바뀌어요`} className={`h-7 w-6 rounded font-bold hover:bg-sky-soft ${m.t ? m.cls : "text-slate-200"}`}>{m.t || "○"}</button>
                                    </form>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-1 font-bold text-sky-deep">{cnt}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}
        </div>
      )}

          </div>
        </div>
      </details>

      <details className="card !p-4">
        <summary className="font-jua cursor-pointer text-lg text-sky-ink">🧷 스티커 일괄 붙이기 (QR이 안 됐던 날)</summary>
      <form action={bulkStamp} className="mt-3 space-y-3">
        <div>
          <p className="font-jua text-xl text-sky-ink">스티커 일괄 붙이기</p>
          <p className="text-sm text-slate-500">QR이 안 됐던 날처럼 여러 학생에게 한 번에 출석(+숙제) 스티커를 붙여요. 이미 붙은 스티커는 그대로예요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-slate-500">수강 시간</span>
          {SLOT_FILTERS.map(([v, label]) => (
            <a key={v} href={`/admin/stamps?b=${current?.key ?? ""}&d=${d}&t=${v}`} className={`rounded-full px-3 py-1.5 font-bold ${t === v ? "bg-sky-deep text-white" : "bg-sky-soft text-sky-ink"}`}>{label}</a>
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

      </details>

      <form action={cleanupPhotos} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">예전 기수 숙제 사진 정리 (새 숙제 인증은 카페 링크를 사용해요)</p>
        <button className="btn-ghost !py-2">지난 기수 사진 지우기</button>
      </form>
    </div>
  );
}
