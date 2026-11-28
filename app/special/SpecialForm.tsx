"use client";

import Icon from "@/components/Icon";
import IconText from "@/components/IconText";
import { keep } from "@/lib/keep";
import { CLASSROOM } from "@/lib/config";
import { useActionState, useState } from "react";
import { registerSpecialLecture, type FormState } from "@/app/actions";

// full = 현장 정원(90명)이 다 참 · deposit = 보증금이 있는 특강(11월까지)
type Option = { id: string; title: string; when: string; closed: boolean; badge: string | null; full?: boolean; deposit?: boolean };

// needPin=false: 구글·카카오만 방식 (로그인한 학생 신청으로 확인해서 3번 칸이 없어요)
export default function SpecialForm({ events, needPin = true }: { events: Option[]; needPin?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerSpecialLecture, {});
  const [mode, setMode] = useState(""); // 신청 직후 제목: 불라방·보증금 없는 현장은 바로 확정, 보증금 있는 현장은 입금 후 확정
  const [eventId, setEventId] = useState("");
  const picked = events.find((e) => e.id === eventId);
  const waitDeposit = mode === "onsite" && !!picked?.deposit;

  if (state.ok) {
    return (
      <div className="card space-y-3 text-center">
        <p className={`font-jua text-2xl ${waitDeposit ? "text-amber-600" : "text-emerald-600"}`}><span className="inline-flex items-center gap-2"><Icon name={waitDeposit ? "hourglass" : "check"} size={30} />{waitDeposit ? "보증금 입금 후 확정돼요" : "신청이 확정됐어요"}</span></p>
        <p className="text-slate-700">{state.ok.split(". ").map((line, i, all) => <span key={i} className="block">{line}{i < all.length - 1 ? "." : ""}</span>)}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-ghost !py-2 text-sm">다른 특강도 신청하기</button>
      </div>
    );
  }

  return (
    <form onSubmit={keep(action)} className="card space-y-5">
      <div>
        <p className="label">1. 특강 선택</p>
        <div className="space-y-2">
          {events.map((event) => (
            <label key={event.id} className={`flex items-start gap-3 rounded-xl p-3 ${event.closed ? "bg-slate-100 opacity-70" : "bg-sky-soft"}`}>
              <input type="radio" name="event_id" value={event.id} required disabled={event.closed} onChange={() => setEventId(event.id)} className="mt-1 accent-sky-deep" />
              <span>
                <b className="block text-sky-ink"><IconText text={event.title} /></b>
                <span className="text-sm text-slate-600">{event.when}</span>
                {event.closed
                  ? <span className="mt-1 block text-sm font-bold text-slate-500">신청이 마감됐어요</span>
                  : event.badge && <span className="mt-1 inline-block rounded-full bg-red-500 px-2 py-0.5 font-jua text-xs text-white">{event.badge}</span>}
                {!event.closed && event.full && <span className="mt-1 block text-sm font-bold text-amber-700">현장 자리가 다 찼어요 · 불라방으로 신청할 수 있어요</span>}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="label">2. 참여 방법</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`flex items-start gap-3 rounded-xl p-3 ${picked?.full ? "bg-slate-100 opacity-70" : "bg-sky-soft"}`}>
            <input type="radio" name="mode" value="onsite" required disabled={!!picked?.full} onChange={() => setMode("onsite")} className="mt-1 accent-sky-deep" />
            <span><b className="block text-sky-ink">현장</b><span className="text-sm text-slate-600">{CLASSROOM}에서 들어요.<br />{picked?.full ? "현장 자리가 다 찼어요" : picked?.deposit ? "보증금 1만원 · 특강 당일 현장에서 100% 환급" : "신청하면 바로 확정돼요"}</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-xl bg-sky-soft p-3">
            <input type="radio" name="mode" value="online" required onChange={() => setMode("online")} className="mt-1 accent-sky-deep" />
            <span><b className="block text-sky-ink">불라방</b><span className="text-sm text-slate-600">유튜브 라이브로 들어요.</span></span>
          </label>
        </div>
      </div>

      {needPin && <div className="space-y-3">
        <p className="label">3. 강의실 로그인 정보</p>
        <input name="name" className="input" placeholder="이름" autoComplete="name" />
        <input name="pin" className="input tracking-[0.3em]" placeholder="강의실 비밀번호 4자리" inputMode="numeric" maxLength={4} type="password" />
        <p className="text-xs text-slate-500">교재 신청할 때 정한 이름과 강의실 비밀번호를 입력해 주세요.</p>
      </div>}

      {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
      <button className="btn w-full" disabled={pending || events.every((e) => e.closed)}>{pending ? "신청 중…" : events.every((e) => e.closed) ? "신청이 마감됐어요" : "특강 신청하기"}</button>
    </form>
  );
}
