import Link from "next/link";
import { notFound } from "next/navigation";
import { COURSES, KINDS, TIME_SLOTS, TRACKS, cohortLabel, todayKST } from "@/lib/config";
import { getApplication, isPreview, listStamps } from "@/lib/db";
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
  const [days, holidays, { attendance, homework }] = await Promise.all([classDaysOf(a), holidaysOf(a.cohort), listStamps([a.id])]);
  const classDays = days.filter((d) => !holidays[d]);
  const offDays = attendance.map((x) => x.day).filter((d) => !classDays.includes(d));
  const all = [...new Set([...classDays, ...offDays])].sort();

  return (
    <div className="space-y-5 pt-8">
      <AdminTabs active="stamps" />
      <Link href={`/admin/stamps?b=${a.course}-${a.track}`} className="text-sm text-sky-deep underline">← 반 출결표로</Link>
      <div className="card">
        <p className="text-sm text-slate-500">{cohortLabel(a.cohort)} · {COURSES[a.course].label} {TRACKS[a.track]} · {KINDS[a.kind].short}{a.slot ? ` · ${TIME_SLOTS[a.slot]}` : ""}</p>
        <h2 className="font-jua text-3xl text-sky-ink">{a.name}</h2>
        <p className="mt-1 text-sm text-slate-600">출석 {classDays.filter((d) => attendance.some((x) => x.day === d)).length} / {classDays.length}회 · 숙제 ⭐ {homework.filter((h) => isHomeworkStickerEligible(h.day, h.created_at)).length}개</p>
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
                    {att ? (att.late ? "◐ 지각" : "● 출석") : "· 결석"}
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
