"use client";

import { useState } from "react";
import { bulkMarkBooksDone } from "@/app/actions";

type Row = { id: string; name: string; phone: string; address: string; books: string; status: "pending" | "paid" | "shipped" };

const STATUS = { pending: "미납", paid: "발송 대기", shipped: "발송 완료" };

export default function DeliveryList({ rows }: { rows: Row[] }) {
  const [copied, setCopied] = useState("");
  const waiting = rows.filter((r) => r.status === "paid");

  async function copy() {
    const text = waiting.map((r) => `${r.name}\t${r.phone}\t${r.address}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`발송 대기 ${waiting.length}명을 복사했어요.`);
    } catch {
      setCopied("복사하지 못했어요. CSV 받기를 이용해 주세요.");
    }
  }

  return (
    <form action={bulkMarkBooksDone} className="mt-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" onClick={copy} disabled={waiting.length === 0} className="btn-ghost !py-2 text-sm">
          발송 대기 {waiting.length}명 이름·연락처·주소 복사
        </button>
        <a href="/admin/delivery/csv" className="btn-ghost !py-2 text-sm">CSV 받기</a>
        <button className="btn !py-2 !text-sm">체크한 학생 발송 완료</button>
      </div>
      {copied && <p className="mt-2 text-sm text-sky-deep">{copied}</p>}
      <p className="mt-1 text-xs text-slate-500 print:hidden">납부 완료(발송 대기) 학생만 발송 완료로 바뀌어요. 되돌리기는 [신청 관리]에서 할 수 있어요.</p>
      <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[15px]">
        <thead>
          <tr className="border-b border-sky-main text-sm text-slate-500">
            <th className="w-8 py-2">✓</th>
            <th className="py-2">이름</th>
            <th className="py-2">연락처</th>
            <th className="py-2">주소</th>
            <th className="py-2">교재</th>
            <th className="py-2 text-right">상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`border-b border-sky-soft ${r.status === "pending" ? "bg-amber-50" : r.status === "shipped" ? "text-slate-400" : ""}`}>
              <td className="py-2">
                {r.status === "paid" && <input type="checkbox" name="ids" value={r.id} aria-label={`${r.name} 선택`} className="h-4 w-4 accent-sky-deep" />}
              </td>
              <td className="whitespace-nowrap py-2 font-bold">{r.name}</td>
              <td className="whitespace-nowrap py-2">{r.phone}</td>
              <td className="py-2">{r.address}</td>
              <td className="py-2 text-sm">{r.books}</td>
              <td className={`py-2 text-right font-bold ${r.status === "pending" ? "text-amber-600" : r.status === "paid" ? "text-sky-deep" : ""}`}>{STATUS[r.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </form>
  );
}
