"use client";

import { useActionState, useState } from "react";
import { keep } from "@/lib/keep";
import { saveProfilePhone, saveProfileReasons, saveProfileTarget, type FormState } from "@/app/actions";
import { REASONS, TARGET_CHIPS } from "@/lib/profile";
import Icon from "@/components/Icon";

const formatPhone = (v: string) => {
  const d = v.replace(/[^0-9]/g, "").slice(0, 11);
  return d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
};

function Submit({ pending, label = "확인" }: { pending: boolean; label?: string }) {
  return <button className="btn w-full !py-4 !text-lg" disabled={pending}>{pending ? "저장 중…" : label}</button>;
}
function Err({ state }: { state: FormState }) {
  return state.error ? <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-center text-sm font-bold text-red-600">{state.error}</p> : null;
}

export function PhoneStep({ initial, edit }: { initial: string; edit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfilePhone, {});
  const [phone, setPhone] = useState(formatPhone(initial));
  return (
    <form onSubmit={keep(action)} className="space-y-4">
      {edit && <input type="hidden" name="edit" value="1" />}
      <input name="phone" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className="input !py-4 text-center text-2xl tracking-wider" placeholder="010-1234-5678" inputMode="numeric" autoComplete="tel" autoFocus />
      <Err state={state} />
      <Submit pending={pending} />
    </form>
  );
}

export function TargetStep({ initial, edit }: { initial: number | null; edit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfileTarget, {});
  const [target, setTarget] = useState(initial ? String(initial) : "");
  return (
    <form onSubmit={keep(action)} className="space-y-4">
      {edit && <input type="hidden" name="edit" value="1" />}
      <div className="flex items-center justify-center gap-2">
        <input name="target" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} className="input !w-40 !py-4 text-center text-3xl font-bold" placeholder="750" inputMode="numeric" autoFocus />
        <span className="font-jua text-2xl text-sky-ink">점</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {TARGET_CHIPS.map((n) => (
          <button key={n} type="button" onClick={() => setTarget(String(n))} aria-pressed={target === String(n)} className={`rounded-full border-2 px-4 py-2 font-bold transition ${target === String(n) ? "border-sky-deep bg-sky-deep text-white" : "border-sky-main bg-white text-sky-ink"}`}>
            {n}{n === 900 ? "+" : ""}
          </button>
        ))}
      </div>
      <Err state={state} />
      <Submit pending={pending} />
    </form>
  );
}

export function ReasonStep({ initial, note, edit }: { initial: string[]; note: string | null; edit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfileReasons, {});
  const [picked, setPicked] = useState<string[]>(initial);
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  return (
    <form onSubmit={keep(action)} className="space-y-4">
      {edit && <input type="hidden" name="edit" value="1" />}
      {picked.map((id) => <input key={id} type="hidden" name="reason" value={id} />)}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {REASONS.map((r) => {
          const on = picked.includes(r.id);
          return (
            <button key={r.id} type="button" onClick={() => toggle(r.id)} aria-pressed={on} className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition ${on ? "border-sky-deep bg-sky-soft" : "border-sky-main/50 bg-white hover:border-sky-main"}`}>
              {on && <Icon name="check" size={18} className="absolute right-2 top-2 text-sky-deep" />}
              <Icon name={r.icon} size={40} />
              <b className="text-[15px] leading-tight text-sky-ink">{r.label}</b>
            </button>
          );
        })}
      </div>
      {picked.includes("etc") && <input name="note" defaultValue={note ?? ""} maxLength={100} className="input" placeholder="기타 이유를 짧게 적어 주세요 (선택)" />}
      <p className="text-center text-xs text-slate-500">여러 개 골라도 돼요.</p>
      <Err state={state} />
      <Submit pending={pending} label={edit ? "저장" : "확인"} />
    </form>
  );
}
