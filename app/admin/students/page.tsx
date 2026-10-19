import Link from "next/link";
import { redirect } from "next/navigation";
import { COURSES, KINDS, TIME_SLOTS, TRACKS, cohortLabel } from "@/lib/config";
import { isPreview, listApplications } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { summariesFor } from "@/lib/studentSummary";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "학생 찾기 · vella_toeic", robots: { index: false } };

const STATUS = { pending: "미납", paid: "납부 완료", shipped: "납부 완료", refunded: "환불" } as const;

// 관리 화면 어디서나 쓰는 학생 검색: 이름·입금자·연락처 → 한 명이면 바로 통합 화면
export default async function StudentSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const raw = ((await searchParams).q ?? "").trim();
  const q = raw.replace(/[\s-]/g, "");
  const found = q
    ? (await listApplications())
        .filter((a) => `${a.name}${a.depositor}${a.phone ?? ""}`.replace(/\s/g, "").includes(q))
        .sort((a, b) => b.cohort.localeCompare(a.cohort) || b.created_at.localeCompare(a.created_at))
    : [];
  if (found.length === 1) redirect(`/admin/students/${found[0].id}`);
  const summary = await summariesFor(found);

  return (
    <div className="space-y-5 pt-8">
      <AdminTabs active="apps" />
      <h2 className="font-jua text-2xl text-sky-ink">🔍 &apos;{raw}&apos; 찾기 <span className="text-base text-slate-500">· {found.length}건 (최근 달이 위)</span></h2>
      {!q ? <p className="card text-center text-slate-500">위 검색창에 이름을 입력해 주세요.</p> : found.length === 0 ? <p className="card text-center text-slate-500">찾는 학생이 없어요.</p> : (
        <div className="card overflow-x-auto !p-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sky-main text-left text-xs text-slate-500">
                <th className="py-2 pr-3">이름</th><th className="pr-3">기수 · 반 · 시간</th><th className="pr-3">납부</th><th className="pr-3 text-center">출석</th><th className="pr-3 text-center">결석</th><th className="pr-3 text-center">숙제</th><th className="pr-3">연락처</th>
              </tr>
            </thead>
            <tbody>
              {found.map((a) => {
                const s = summary.get(a.id);
                return (
                  <tr key={a.id} className="border-b border-sky-soft">
                    <td className="whitespace-nowrap py-2 pr-3"><Link href={`/admin/students/${a.id}`} className="font-bold text-sky-ink underline decoration-sky-main underline-offset-2">{a.name}</Link></td>
                    <td className="whitespace-nowrap pr-3 text-slate-600">{cohortLabel(a.cohort)} · {COURSES[a.course].label} {TRACKS[a.track]} · {a.slot ? TIME_SLOTS[a.slot] : "미정"} <span className="text-xs text-slate-400">{KINDS[a.kind].short}</span></td>
                    <td className={`whitespace-nowrap pr-3 font-bold ${a.status === "pending" ? "text-amber-600" : a.status === "refunded" ? "text-slate-400" : "text-emerald-600"}`}>{STATUS[a.status]}</td>
                    <td className="pr-3 text-center text-sky-deep">{s ? `${s.attended}/${s.past}` : "-"}</td>
                    <td className={`pr-3 text-center ${s && s.absent >= 3 ? "font-bold text-red-500" : "text-slate-500"}`}>{s ? s.absent : "-"}</td>
                    <td className={`pr-3 text-center ${s && s.hwMissing >= 3 ? "font-bold text-amber-600" : "text-slate-500"}`}>{s ? `${s.hwDue - s.hwMissing}/${s.hwDue}` : "-"}</td>
                    <td className="whitespace-nowrap pr-3 text-slate-500">{a.phone ? a.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3") : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
