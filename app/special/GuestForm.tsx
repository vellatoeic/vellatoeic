"use client";

import Icon from "@/components/Icon";
import IconText from "@/components/IconText";
import { keep } from "@/lib/keep";
import { CLASSROOM } from "@/lib/config";
import { useActionState, useState } from "react";
import { registerSpecialLecture, type FormState } from "@/app/actions";

// 비수강생 특강 신청서 (2026-11-28 Vella): 현장만 · 카카오·구글 로그인한 뒤 · 이름·휴대폰 · 개인정보 동의(필수) · '벨라토익 소식 받을게요'(선택)
// mine = 이미 신청한 특강 (다시 고를 수 없게 '신청 완료')
type Option = { id: string; title: string; when: string; closed: boolean; full: boolean; left: number; badge: string | null; mine?: boolean };

const hyphen = (v: string) => {
  const d = v.replace(/[^0-9]/g, "").slice(0, 11);
  return d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
};

export default function GuestForm({ events, name, phone, optIn }: { events: Option[]; name: string; phone: string; optIn: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerSpecialLecture, {});
  const [tel, setTel] = useState(hyphen(phone));

  if (state.ok) {
    const no = /개인번호 (\d{6})/.exec(state.ok)?.[1];
    const text = state.ok.replace(/\s*개인번호 \d{6}/, "").replace(/^신청이 확정됐어요\.\s*/, "");
    return (
      <div className="card space-y-3 text-center">
        <p className="font-jua text-2xl text-emerald-600"><span className="inline-flex items-center gap-2"><Icon name="check" size={30} />{text.startsWith("이미") ? "이미 신청했어요" : "신청이 확정됐어요"}</span></p>
        <p className="text-slate-700">{text}</p>
        {no && (
          <div className="rounded-2xl bg-sky-soft p-4">
            <p className="text-sm text-slate-600">내 개인번호</p>
            <p className="font-jua text-4xl tracking-[0.2em] text-sky-ink">{no}</p>
            <p className="mt-1 text-sm text-slate-600">모의고사 답안지 <b>&apos;수험번호&apos;</b> 칸에 적어 주세요. 채점이 끝나면 이 사이트에서 내 성적을 볼 수 있어요.</p>
          </div>
        )}
        <button type="button" onClick={() => window.location.reload()} className="btn-ghost !py-2 text-sm">신청 내용 보기</button>
      </div>
    );
  }

  const none = events.every((e) => e.closed || e.full || e.mine);
  return (
    <form onSubmit={keep(action)} className="card space-y-5">
      <input type="hidden" name="guest" value="1" />
      <input type="hidden" name="mode" value="onsite" />
      <div>
        <p className="label">1. 특강 선택 <span className="font-normal text-slate-500">· 현장({CLASSROOM})</span></p>
        <div className="space-y-2">
          {events.map((event) => {
            const off = event.closed || event.full || !!event.mine;
            return (
              <label key={event.id} className={`flex items-start gap-3 rounded-xl p-3 ${off ? "bg-slate-100 opacity-70" : "bg-sky-soft"}`}>
                <input type="radio" name="event_id" value={event.id} required disabled={off} className="mt-1 accent-sky-deep" />
                <span>
                  <b className="block text-sky-ink"><IconText text={event.title} /></b>
                  <span className="text-sm text-slate-600">{event.when}</span>
                  {event.mine ? <span className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-emerald-600"><Icon name="check" size={16} />신청 완료</span>
                    : event.closed ? <span className="mt-1 block text-sm font-bold text-slate-500">신청이 마감됐어요</span>
                    : event.full ? <span className="mt-1 block text-sm font-bold text-slate-500">현장 자리가 다 찼어요</span>
                    : (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {event.badge && <span className="rounded-full bg-red-500 px-2 py-0.5 font-jua text-xs text-white">{event.badge}</span>}
                        {event.left <= 20 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">남은 자리 {event.left}</span>}
                      </span>
                    )}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="label">2. 내 정보</p>
        <input name="guest_name" defaultValue={name} className="input" placeholder="이름" autoComplete="name" required />
        <input name="guest_phone" value={tel} onChange={(e) => setTel(hyphen(e.target.value))} className="input" placeholder="휴대폰 번호 (010-1234-5678)" inputMode="numeric" autoComplete="tel" required />
        <p className="text-xs text-slate-500">휴대폰 번호는 특강 당일 안내와 동명이인 구분에만 써요.</p>
      </div>

      <div className="space-y-2 rounded-2xl bg-slate-50 p-3 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="agree" value="1" required className="mt-1 h-4 w-4 accent-sky-deep" />
          <span><b>(필수) 개인정보 수집·이용 동의</b><br /><span className="text-slate-500">이름·휴대폰·카카오/구글 계정 정보 · 특강 신청 확인, 당일 안내, 모의고사 성적 확인에 써요. 지워 달라고 하시면 바로 지워요.</span></span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="news" value="1" defaultChecked={optIn} className="mt-1 h-4 w-4 accent-sky-deep" />
          <span><b>(선택) 벨라토익 소식 받을게요</b><br /><span className="text-slate-500">개강·특강 같은 벨라토익 소식을 문자·카톡으로 보내 드려요. 동의하지 않아도 특강은 들을 수 있어요.</span></span>
        </label>
      </div>

      {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
      <button className="btn w-full" disabled={pending || none}>{pending ? "신청 중…" : none ? (events.some((e) => e.mine) ? "신청한 특강은 아래에서 확인해요" : "신청할 수 있는 특강이 없어요") : "특강 신청하기"}</button>
    </form>
  );
}
