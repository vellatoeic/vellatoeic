"use client";

import { useState } from "react";
import { bulkMarkBooksDone } from "@/app/actions";

type Row = { id: string; name: string; klass: string; phone: string; address: string; books: string; status: "pending" | "paid" | "shipped" };

const STATUS = { pending: "미납", paid: "발송 대기", shipped: "발송 완료" };
const line = (r: Row) => `${r.name}\t${r.klass}\t${r.phone}\t${r.address}`;

export default function DeliveryList({ rows }: { rows: Row[] }) {
  const [copied, setCopied] = useState("");
  const waiting = rows.filter((r) => r.status === "paid");

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(done);
    } catch {
      setCopied("복사하지 못했어요. CSV 받기를 이용해 주세요.");
    }
  }

  return (
    <form action={bulkMarkBooksDone}>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <label className="flex items-center gap-2 text-sm font-bold text-sky-ink">
          <input
            type="checkbox"
            className="h-5 w-5 accent-sky-deep"
            onChange={(e) => {
              const on = e.currentTarget.checked;
              e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((box) => { box.checked = on; });
            }}
          />
          발송 대기 전체 선택
        </label>
        <button className="btn !py-2 !text-sm">체크한 학생 발송 완료</button>
        <button type="button" onClick={() => copy(waiting.map(line).join("\n"), `발송 대기 ${waiting.length}명을 복사했어요.`)} disabled={waiting.length === 0} className="btn-ghost !py-2 text-sm">
          발송 대기 {waiting.length}명 전체 복사
        </button>
        <a href="/admin/delivery/csv" className="btn-ghost !py-2 text-sm">CSV 받기</a>
      </div>
      {copied && <p className="mt-2 text-sm font-bold text-sky-deep">{copied}</p>}
      <p className="mt-1 text-xs text-slate-500 print:hidden">복사하면 이름·수강반·연락처·주소가 칸으로 나뉘어 엑셀이나 택배 사이트에 붙여넣을 수 있어요. 미납 학생은 체크·복사에서 빠져요.</p>

      <div className="mt-4 hidden grid-cols-[2rem_6rem_9rem_8.5rem_1fr_5.5rem] gap-3 border-b border-sky-main pb-2 text-sm font-bold text-slate-500 lg:grid">
        <span />
        <span>이름</span>
        <span>수강반</span>
        <span>연락처</span>
        <span>주소</span>
        <span className="text-right">상태</span>
      </div>
      <ul className="divide-y divide-sky-soft">
        {rows.map((r) => (
          <li
            key={r.id}
            className={`grid grid-cols-[2rem_1fr_auto] items-start gap-x-3 gap-y-1 py-3 lg:grid-cols-[2rem_6rem_9rem_8.5rem_1fr_5.5rem] lg:items-center ${r.status === "pending" ? "bg-amber-50" : r.status === "shipped" ? "opacity-50" : ""}`}
          >
            <span className="row-span-4 pt-0.5 lg:row-span-1 lg:pt-0">
              {r.status === "paid" && <input type="checkbox" name="ids" value={r.id} aria-label={`${r.name} 선택`} className="h-5 w-5 accent-sky-deep" />}
            </span>
            <b className="text-lg text-sky-ink">{r.name}</b>
            <span className={`text-right text-sm font-bold lg:order-last ${r.status === "pending" ? "text-amber-600" : r.status === "paid" ? "text-sky-deep" : "text-slate-500"}`}>
              {STATUS[r.status]}
              {r.status === "paid" && (
                <button type="button" onClick={() => copy(line(r), `${r.name} 학생 정보를 복사했어요.`)} className="ml-2 rounded-full bg-sky-soft px-2 py-0.5 text-xs text-sky-ink">복사</button>
              )}
            </span>
            <span className="col-span-2 text-[15px] lg:col-span-1">
              {r.klass}
              <span className="block text-xs text-slate-400">{r.books}</span>
            </span>
            <span className="col-span-2 font-bold lg:col-span-1">{r.phone}</span>
            <span className="col-span-2 break-keep text-[15px] lg:col-span-1">{r.address}</span>
          </li>
        ))}
      </ul>
    </form>
  );
}
