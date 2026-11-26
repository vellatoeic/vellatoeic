"use client";

import Link from "next/link";
import { bulkMarkBooksDone } from "@/app/actions";

// 불라방 현장 수령(데스크) 명단: 수령 희망 날짜·시간 순 (예전 [현장 명단] 아래 표를 옮겨 왔어요)
// 납부 완료(준비) 학생만 체크해서 [수령 완료] 일괄 처리 — 학생이 강의실에서 [교재 받았어요]를 누르는 방식도 그대로예요.
export type DeskRow = { id: string; name: string; depositor: string; klass: string; when: string | null; books: string; status: "pending" | "paid" | "shipped"; bringOld: boolean };

const STATUS = { pending: "미납", paid: "준비", shipped: "수령 완료" } as const;

export default function DeskList({ rows, desk }: { rows: DeskRow[]; desk: string }) {
  const ready = rows.filter((r) => r.status === "paid").length;
  return (
    <form action={bulkMarkBooksDone}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-bold text-sky-ink">
          <input
            type="checkbox"
            className="h-5 w-5 accent-sky-deep"
            disabled={ready === 0}
            onChange={(e) => {
              const on = e.currentTarget.checked;
              e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((box) => { box.checked = on; });
            }}
          />
          준비 {ready}명 전체 선택
        </label>
        <button className="btn !py-2 !text-sm" disabled={ready === 0}>체크한 학생 수령 완료</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">학생이 고른 수령 희망 날짜·시간 순서예요. {desk}에 미리 준비해 두세요. 미납 학생은 체크에서 빠져요.</p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-[15px]">
          <thead>
            <tr className="border-b border-sky-main text-sm text-slate-500">
              <th className="w-8 py-2" />
              <th className="py-2">수령 희망</th>
              <th className="py-2">이름</th>
              <th className="py-2">반</th>
              <th className="py-2">교재</th>
              <th className="py-2 text-right">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-sky-soft ${r.status === "pending" ? "bg-amber-50" : r.status === "shipped" ? "text-slate-400" : ""}`}>
                <td className="py-2">
                  {r.status === "paid" ? <input type="checkbox" name="ids" value={r.id} className="h-5 w-5 accent-sky-deep" aria-label={`${r.name} 수령 완료`} /> : null}
                </td>
                <td className="whitespace-nowrap py-2 font-bold text-sky-ink">{r.when ?? <span className="font-normal text-slate-400">미정</span>}</td>
                <td className="py-2">
                  <Link href={`/admin/students/${r.id}`} className="font-bold text-sky-ink underline decoration-sky-main underline-offset-2">{r.name}</Link>
                  {r.depositor !== r.name && <span className="ml-1 text-xs text-slate-400">({r.depositor})</span>}
                  {r.bringOld && <span className="ml-1.5 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">지난달 교재 지참</span>}
                </td>
                <td className="py-2 text-sm text-slate-600">{r.klass}</td>
                <td className="py-2 text-sm text-slate-600">{r.books}</td>
                <td className={`whitespace-nowrap py-2 text-right font-bold ${r.status === "pending" ? "text-amber-600" : r.status === "shipped" ? "text-slate-400" : "text-sky-deep"}`}>{STATUS[r.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
