"use client";

import { useState } from "react";
import { adminCancelYbm, bulkMarkBooksDone, confirmYbmPayments } from "@/app/actions";
import type { AddressParts } from "@/lib/address";
import Icon from "@/components/Icon";

export type Row = { id: string; name: string; klass: string; phone: string; address: string; addr: AddressParts; books: string; status: "pending" | "paid" | "shipped"; proof?: string; ybm?: boolean; at: string };

const STATUS = { pending: "미납", paid: "발송 대기", shipped: "발송 완료" };
// 엑셀·택배 사이트용 한 줄: 이름 · 연락처 · 우편번호 · 기본주소 · 상세주소 · 수강반 (칸 사이는 탭)
const line = (r: Row) => [r.name, r.phone, r.addr.zip, r.addr.base, r.addr.detail, r.klass].join("\t");

export default function DeliveryList({ rows, csv }: { rows: Row[]; csv: string }) {
  const [copied, setCopied] = useState("");
  const [picked, setPicked] = useState<string>(""); // 방금 복사한 칸 (행id:칸)
  const [doneRows, setDoneRows] = useState<Set<string>>(new Set()); // 주소까지 복사한 학생 (이 화면에서만)
  const waiting = rows.filter((r) => r.status === "paid");
  const ybmPending = rows.filter((r) => r.ybm && r.status === "pending").length;

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(done);
    } catch {
      setCopied("복사하지 못했어요. CSV 받기를 이용해 주세요.");
    }
  }
  // 칸 하나 누르면 그 칸만 복사 (택배 사이트 칸에 하나씩 붙여 넣기)
  async function copyCell(r: Row, key: string, text: string, label: string) {
    if (!text) return;
    await copy(text, `${r.name} · ${label} 복사했어요: ${text}`);
    setPicked(`${r.id}:${key}`);
    if (key === "detail" || (key === "base" && !r.addr.detail)) setDoneRows((s) => new Set(s).add(r.id));
  }
  const Cell = ({ r, k, text, label, wide }: { r: Row; k: string; text: string; label: string; wide?: boolean }) => {
    const on = picked === `${r.id}:${k}`;
    return (
      <button
        type="button"
        onClick={() => copyCell(r, k, text, label)}
        disabled={!text}
        title={`${label} 복사`}
        className={`group flex min-w-0 items-start gap-1.5 rounded-xl border px-2.5 py-1.5 text-left transition ${wide ? "w-full" : ""} ${on ? "border-emerald-300 bg-emerald-50" : "border-sky-main/50 bg-white hover:border-sky-deep"} disabled:opacity-40`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold text-slate-400">{label}</span>
          <span className="block break-keep text-[15px] text-slate-800">{text || "없음"}</span>
        </span>
        <Icon name={on ? "check" : "doc"} size={14} className={`mt-1 shrink-0 ${on ? "text-emerald-600" : "text-slate-300 group-hover:text-sky-deep"}`} />
      </button>
    );
  };

  return (
    <form action={bulkMarkBooksDone}>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <label className="flex items-center gap-2 text-sm font-bold text-sky-ink">
          <input
            type="checkbox"
            className="h-5 w-5 accent-sky-deep"
            onChange={(e) => {
              const on = e.currentTarget.checked;
              e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="ids"][data-paid]').forEach((box) => { box.checked = on; });
            }}
          />
          발송 대기 전체 선택
        </label>
        <button className="btn !py-2 !text-sm">체크한 학생 발송 완료</button>
        <button type="button" onClick={() => copy(waiting.map(line).join("\n"), `발송 대기 ${waiting.length}명을 복사했어요.`)} disabled={waiting.length === 0} className="btn-ghost !py-2 text-sm">
          발송 대기 {waiting.length}명 전체 복사
        </button>
        <a href={csv} className="btn-ghost !py-2 text-sm">CSV 받기</a>
        {ybmPending > 0 && <button formAction={confirmYbmPayments} className="btn-ghost !py-2 text-sm">체크한 인강 주문 입금 확인</button>}
        {ybmPending > 0 && <button formAction={adminCancelYbm} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">체크한 인강 주문 취소 처리 (미입금)</button>}
      </div>
      {copied && <p className="mt-2 text-sm font-bold text-sky-deep">{copied}</p>}
      <p className="mt-1 text-xs text-slate-500 print:hidden">칸(이름·연락처·우편번호·기본주소·상세주소)을 누르면 그 칸만 복사돼요. 택배 사이트에 하나씩 붙여 넣으세요. [전체 복사]는 엑셀용으로 칸이 나뉘어요. 미납 학생은 체크·복사에서 빠져요.{ybmPending > 0 && " 입금 문자가 자동 확인되지 않은 YBM 인강 주문은 직접 체크해서 [입금 확인]을 눌러 주세요."}</p>

      <div className="mt-4 hidden grid-cols-[2rem_8rem_8.5rem_1fr_5.5rem] gap-3 border-b border-sky-main pb-2 text-sm font-bold text-slate-500 lg:grid">
        <span />
        <span>이름 · 수강반</span>
        <span>연락처</span>
        <span>주소 (누르면 복사)</span>
        <span className="text-right">상태</span>
      </div>
      <ul className="divide-y divide-sky-soft">
        {rows.map((r) => (
          <li
            key={r.id}
            className={`grid grid-cols-[2rem_1fr_auto] items-start gap-x-3 gap-y-2 py-3 lg:grid-cols-[2rem_8rem_8.5rem_1fr_5.5rem] ${r.status === "pending" ? "bg-amber-50" : r.status === "shipped" ? "opacity-50" : doneRows.has(r.id) ? "bg-emerald-50/40" : ""}`}
          >
            <span className="row-span-4 pt-1 lg:row-span-1">
              {(r.status === "paid" || (r.ybm && r.status === "pending")) && (
                <input type="checkbox" name="ids" value={r.id} data-paid={r.status === "paid" ? "" : undefined} aria-label={`${r.name} 선택`} className="h-5 w-5 accent-sky-deep" />
              )}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <Cell r={r} k="name" text={r.name} label="이름" />
                {!r.ybm && <a href={`/admin/students/${r.id}`} className="text-xs text-sky-deep underline" title="학생 통합 화면">정보</a>}
              </span>
              <span className="mt-1 block text-sm">
                {r.ybm ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">YBM 인강</span> : <span className="text-slate-600">{r.klass}</span>}
                {r.proof && <a href={r.proof} target="_blank" rel="noreferrer" className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-sky-soft px-2 py-0.5 text-xs font-bold text-sky-ink">수강증 보기</a>}
                <span className="block text-xs text-slate-400">{r.books} · {new Date(r.at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" })} 신청</span>
              </span>
            </span>
            <span className={`text-right text-sm font-bold lg:order-last ${r.status === "pending" ? "text-amber-600" : r.status === "paid" ? "text-sky-deep" : "text-slate-500"}`}>
              {STATUS[r.status]}
              {r.status === "paid" && (
                <button type="button" onClick={() => copy(line(r), `${r.name} 학생 한 줄을 복사했어요.`)} className="mt-1 block w-full rounded-full bg-sky-soft px-2 py-0.5 text-xs text-sky-ink">한 줄 복사</button>
              )}
              {doneRows.has(r.id) && <span className="mt-1 block text-xs text-emerald-600">주소 복사함</span>}
            </span>
            <span className="col-span-2 lg:col-span-1"><Cell r={r} k="phone" text={r.phone} label="연락처" wide /></span>
            <span className="col-span-2 grid gap-1.5 sm:grid-cols-[6rem_1fr_1fr] lg:col-span-1">
              <Cell r={r} k="zip" text={r.addr.zip} label="우편번호" wide />
              <Cell r={r} k="base" text={r.addr.base} label="기본주소" wide />
              <Cell r={r} k="detail" text={r.addr.detail} label="상세주소" wide />
            </span>
          </li>
        ))}
      </ul>
    </form>
  );
}
