import Icon from "@/components/Icon";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KINDS, classSlotLabel, cohortLabel } from "@/lib/config";
import { isPreview, listApplications, listProspects } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { summariesFor } from "@/lib/studentSummary";
import { todayKST } from "@/lib/config";
import { buildRoster } from "@/lib/rosterServer";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import RosterTable from "./RosterTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "학생 명단 · vella_toeic", robots: { index: false } };

const STATUS = { pending: "미납", paid: "납부 완료", shipped: "납부 완료", refunded: "환불", cancelled: "취소" } as const;

// 관리 [학생 명단] (검색어 없이 열면): 학생 한 명 = 한 줄, 등급(수강생·예비수강생·일반)·수강 월·레벨·로그인·최근 접속
// 관리 화면 어디서나 쓰는 학생 검색(?q=): 이름·입금자·연락처 → 한 명이면 바로 통합 화면 (예전 그대로)
export default async function StudentSearch({ searchParams }: { searchParams: Promise<{ q?: string; g?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const sp = await searchParams;
  const raw = (sp.q ?? "").trim();
  if (!raw) {
    const { rows, cohorts } = await buildRoster();
    const g = sp.g === "student" || sp.g === "pre" || sp.g === "general" || sp.g === "prospect" ? sp.g : "all";
    return (
      <div className="space-y-5 pt-8">
        <AdminTabs active="students" />
        <div>
          <h2 className="flex flex-wrap items-center gap-1.5 font-jua text-2xl text-sky-ink"><Icon name="people" size={28} />학생 명단 <span className="text-base text-slate-500">· {rows.length}명</span></h2>
          <p className="mt-1 text-sm text-slate-500">등급은 날짜로 자동으로 바뀌어요 · 예비수강생은 개강일 오전 9시에 수강생이 되고, 수강생은 다음 달 개강일 0시에 일반이 돼요. 잠재 고객 = 수강 신청 없이 특강(비수강생)으로 온 학생.</p>
        </div>
        <RosterTable rows={rows} cohorts={cohorts} today={todayKST()} initialGrade={g} />
      </div>
    );
  }
  const q = raw.replace(/[\s-]/g, "");
  const found = q
    ? (await listApplications())
        // 학생 검색에서는 30분 자동 취소 신청도 보여요 ('자동 취소됨', 7일 뒤 자동 삭제)
        .filter((a) => `${a.name}${a.depositor}${a.phone ?? ""}${a.student_no ?? ""}`.replace(/\s/g, "").includes(q))
        .sort((a, b) => b.cohort.localeCompare(a.cohort) || b.created_at.localeCompare(a.created_at))
    : [];
  // 수강 신청 없이 특강으로 온 비수강생(잠재 고객)도 찾아요
  const guests = (await listProspects().catch(() => [])).filter((x) => `${x.name}${x.phone ?? ""}${x.student_no ?? ""}`.replace(/\s/g, "").includes(q) && !found.some((a) => a.student_no && a.student_no === x.student_no));
  if (found.length === 1 && guests.length === 0) redirect(`/admin/students/${found[0].id}`);
  const summary = await summariesFor(found);

  return (
    <div className="space-y-5 pt-8">
      <AdminTabs active="students" />
      <h2 className="flex flex-wrap items-center gap-1.5 font-jua text-2xl text-sky-ink"><Icon name="search" size={26} />&apos;{raw}&apos; 찾기 <span className="text-base text-slate-500">· {found.length}건 (최근 달이 위)</span></h2>
      {guests.length > 0 && (
        <div className="card !p-4 text-sm">
          <p className="font-jua text-lg text-violet-700">잠재 고객(비수강생) {guests.length}명</p>
          <ul className="mt-1 divide-y divide-sky-soft">
            {guests.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
                <b className="text-sky-ink">{x.name}</b>
                {x.student_no && <span className="text-xs font-bold tracking-wider text-slate-400">#{x.student_no}</span>}
                <span className="text-slate-500">{x.phone ? x.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3") : "-"}</span>
                {x.news_opt_in && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">소식 동의</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!q ? <p className="card text-center text-slate-500">위 검색창에 이름을 입력해 주세요.</p> : found.length === 0 && guests.length > 0 ? null : found.length === 0 ? <p className="card text-center text-slate-500">찾는 학생이 없어요.</p> : (
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
                    <td className="whitespace-nowrap pr-3 text-slate-600">{cohortLabel(a.cohort)} · {classSlotLabel(a)} <span className="text-xs text-slate-400">{KINDS[a.kind].short}</span></td>
                    <td className={`whitespace-nowrap pr-3 font-bold ${a.status === "pending" ? "text-amber-600" : a.status === "refunded" || a.status === "cancelled" ? "text-slate-400" : "text-emerald-600"}`}>{a.status === "cancelled" && a.cancel_reason === "timeout" ? "자동 취소됨" : STATUS[a.status]}{a.books_adjusted ? " · 교재 조정" : ""}</td>
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
