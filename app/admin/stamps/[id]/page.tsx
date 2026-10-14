import Link from "next/link";
import { notFound } from "next/navigation";
import { COURSES, KINDS, TIME_SLOTS, TRACKS, cohortLabel, todayKST } from "@/lib/config";
import { getApplication, isPreview, listStamps, listTestResults } from "@/lib/db";
import { TEST_LABEL } from "@/lib/tests";
import { watchSummary } from "@/lib/watchlist";
import { isAdmin } from "@/lib/auth";
import { classDaysOf, holidaysOf } from "@/lib/classCalendar";
import { isHomeworkStickerEligible } from "@/lib/schedule";
import { specialDay } from "@/lib/special";
import { cancelHomeworkSticker, cycleAttendance } from "@/app/actions";
import AdminTabs from "../../AdminTabs";
import LoginForm from "../../LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "학생별 출결 · vella_toeic", robots: { index: false } };

// 학생 한 명의 이번 달 수업일별 출석·숙제 (하나씩 보고 고치는 화면)
export default async function StudentStamps({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { id } = await params;
  const a = await getApplication(id);
  if (!a) notFound();
  const today = todayKST();
  const [days, holidays, { attendance, homework }, tests] = await Promise.all([classDaysOf(a), holidaysOf(a.cohort), listStamps([a.id]), listTestResults({ cohort: a.cohort, appIds: [a.id] })]);
  const classDays = days.filter((d) => !holidays[d]);
  const offDays = attendance.map((x) => x.day).filter((d) => !classDays.includes(d));
  const all = [...new Set([...classDays, ...offDays])].sort();
  const s = watchSummary(classDays, attendance, homework.map((h) => h.day), today);
  const testsOf = (d: string) => tests.filter((t) => t.day === d).sort((x, y) => x.kind.localeCompare(y.kind));
  const pct = (kind: "word" | "rc") => {
    const list = tests.filter((t) => t.kind === kind);
    return list.length ? Math.round((list.reduce((sum, t) => sum + t.score / t.questions, 0) / list.length) * 100) : null;
  };

  return (
    <div className="space-y-5 pt-8">
      <AdminTabs active="stamps" />
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/admin/stamps" className="text-sky-deep underline">← 출석·숙제로</Link>
        <form action="/admin/stamps" className="flex items-center gap-2">
          <input name="q" placeholder="다른 학생 찾기" className="input !w-36 !py-1.5 text-sm" autoComplete="off" />
          <button className="btn-ghost !py-1.5 text-sm">검색</button>
        </form>
      </div>
      <div className="card">
        <p className="text-sm text-slate-500">{cohortLabel(a.cohort)} · {COURSES[a.course].label} {TRACKS[a.track]} · {KINDS[a.kind].short}{a.slot ? ` · ${TIME_SLOTS[a.slot]}` : ""}</p>
        <h2 className="font-jua text-3xl text-sky-ink">{a.name}</h2>
        {a.phone && <p className="text-sm text-slate-500">📞 {a.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3")}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[
            { label: "출석", value: `${s.attended}/${s.past}`, sub: s.late ? `지각 ${s.late}` : "지난 수업 기준" },
            { label: "결석", value: `${s.absent}회`, sub: s.streak ? `최근 ${s.streak}회 연속` : "연속 결석 없음", warn: s.absent >= 3 || s.streak >= 2 },
            { label: "숙제", value: `${s.hwDue - s.hwMissing}/${s.hwDue}`, sub: `⭐ 별 ${homework.filter((h) => isHomeworkStickerEligible(h.day, h.created_at)).length}개`, warn: s.hwMissing >= 3 },
            { label: "테스트 평균", value: tests.length ? `${pct("rc") ?? "-"}%` : "-", sub: tests.length ? `RC · 단어 ${pct("word") ?? "-"}% · ${tests.length}회 제출` : "제출 기록 없음" },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl bg-sky-soft p-2.5">
              <p className="text-xs text-slate-500">{x.label}</p>
              <p className={`font-jua text-2xl ${x.warn ? "text-red-500" : "text-sky-ink"}`}>{x.value}</p>
              <p className="text-[11px] text-slate-400">{x.sub}</p>
            </div>
          ))}
        </div>
        {s.reasons.length > 0 && <p className="mt-2 flex flex-wrap gap-1">{s.reasons.map((r) => <span key={r} className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">🚨 {r}</span>)}</p>}
      </div>
      <ul className="card divide-y divide-sky-soft !p-4">
        {all.map((d) => {
          const att = attendance.find((x) => x.day === d);
          const hw = homework.find((x) => x.day === d);
          const star = !!hw && isHomeworkStickerEligible(d, hw.created_at);
          const off = !classDays.includes(d);
          return (
            <li key={d} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className={`w-24 font-bold ${off ? "text-amber-600" : "text-sky-ink"}`}>{specialDay(d)}{off ? " · 수업 없음" : ""}</span>
              {d > today ? <span className="text-slate-300">아직</span> : (
                <form action={cycleAttendance}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="day" value={d} />
                  <button className="rounded-full bg-sky-soft px-3 py-1 font-bold" title="누르면 출석 → 지각 → 결석 순서로 바뀌어요">
                    {att ? (att.late ? "◐ 지각" : "● 출석") : d === today ? "○ 아직" : "· 결석"}
                  </button>
                </form>
              )}
              {hw ? (
                <form action={cancelHomeworkSticker}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="day" value={d} />
                  <button className="rounded-full bg-amber-50 px-3 py-1" title="누르면 숙제 기록을 취소해요">{star ? "⭐ 숙제" : "✓ 숙제(늦음, 별 없음)"} · 취소</button>
                </form>
              ) : <span className="text-slate-300">숙제 없음</span>}
              {testsOf(d).map((t) => (
                <span key={t.id} className="rounded-full bg-white px-3 py-1 ring-1 ring-sky-main">📝 {TEST_LABEL[t.kind]} {t.test_no} · <b className="text-sky-ink">{t.score}/{t.questions}</b></span>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
