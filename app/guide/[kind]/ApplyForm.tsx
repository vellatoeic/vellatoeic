"use client";

import { keep } from "@/lib/keep";
import { useActionState, useState } from "react";
import { submitApplication, type FormState } from "@/app/actions";
import {
  BOOKS, COURSES, KINDS, TRACKS, PICKUPS, SHIPPING_FEE, BOOK_PRICE, calcAmount, won,
  type CourseId, type Kind, type Pickup, type Track,
} from "@/lib/config";

const choice = (on: boolean) =>
  `rounded-2xl border-2 p-4 text-left transition ${on ? "border-sky-deep bg-sky-soft" : "border-sky-main/50 bg-white"}`;

export default function ApplyForm({ kind }: { kind: Kind }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitApplication, {});
  const [course, setCourse] = useState<CourseId | null>(null);
  const [track, setTrack] = useState<Track>("all");
  const [pickup, setPickup] = useState<Pickup>(kind === "onsite" ? "classroom" : "delivery");

  const books = course ? COURSES[course].books[track] : [];
  const amount = calcAmount(books, pickup);
  const online = kind === "online";

  return (
    <form onSubmit={keep(action)} className="card space-y-6">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="pickup" value={pickup} />
      <input type="hidden" name="track" value={track} />
      {course && <input type="hidden" name="course" value={course} />}

      <div>
        <p className="label">1. 수강 신청한 반</p>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(COURSES) as CourseId[]).map((c) => (
            <button type="button" key={c} onClick={() => setCourse(c)} className={`${choice(course === c)} text-center`}>
              <p className="font-jua text-xl text-sky-ink">{COURSES[c].label}</p>
            </button>
          ))}
        </div>
      </div>

      {course && (
        <div>
          <p className="label">2. 수강 과목</p>
          <div className="space-y-2">
            {(Object.keys(TRACKS) as Track[]).map((t) => {
              const b = COURSES[course].books[t];
              return (
                <button type="button" key={t} onClick={() => setTrack(t)} className={`${choice(track === t)} flex w-full items-center justify-between gap-3`}>
                  <span>
                    <span className="font-jua block text-lg text-sky-ink">
                      {COURSES[course].label} {TRACKS[t]}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-600">
                      교재 {b.length}권 · {b.map((x) => BOOKS[x]).join(" + ")}
                    </span>
                  </span>
                  <span className="font-jua shrink-0 text-lg text-sky-deep">{won(b.length * BOOK_PRICE)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {online && (
        <div>
          <p className="label">3. 교재 수령 방법</p>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(PICKUPS) as Pickup[]).map((p) => (
              <button type="button" key={p} onClick={() => setPickup(p)} className={`${choice(pickup === p)} text-center`}>
                <span className="font-jua block text-lg text-sky-ink">{PICKUPS[p].label}</span>
                <span className="mt-1 block text-xs text-slate-500">{PICKUPS[p].desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={online ? "" : "sm:col-span-2"}>
          <span className="label">이름</span>
          <input name="name" className="input" placeholder="홍길동" autoComplete="name" />
        </label>
        {online && (
          <label>
            <span className="label">연락처</span>
            <input name="phone" className="input" placeholder="01012345678" inputMode="numeric" autoComplete="tel" />
          </label>
        )}
        <label className="sm:col-span-2">
          <span className="label">입금자명 <span className="font-normal text-slate-400">(이름과 같으면 비워두세요)</span></span>
          <input name="depositor" className="input" placeholder="예: 홍길동(엄마)" />
        </label>
        <label className="sm:col-span-2">
          <span className="label">강의실 비밀번호 <span className="font-normal text-slate-400">(숫자 4자리 · 강의 볼 때 사용)</span></span>
          <input name="pin" className="input tracking-[0.4em]" placeholder="예: 1234" inputMode="numeric" maxLength={4} type="password" />
        </label>
        {pickup === "delivery" && (
          <label className="sm:col-span-2">
            <span className="label">택배 받을 주소</span>
            <input name="address" className="input" placeholder="도로명 주소 + 상세 주소" autoComplete="street-address" />
          </label>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-sky-soft p-4">
        <input type="checkbox" name="agree" className="mt-1 h-5 w-5 accent-sky-deep" />
        <span className="text-[15px] text-slate-700">위 필독 사항을 모두 읽었어요.</span>
      </label>

      <div className="rounded-2xl border-2 border-dashed border-sky-main p-5 text-center">
        {course && (
          <p className="mb-2 rounded-full bg-sky-soft px-3 py-1 text-sm font-bold text-sky-ink">
            {KINDS[kind].label} · {COURSES[course].label} {TRACKS[track]}
          </p>
        )}
        <p className="text-sm text-slate-500">납부할 교재비</p>
        <p className="font-jua mt-1 text-4xl text-sky-ink">{won(amount)}</p>
        {books.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            교재 {books.length}권 {won(books.length * BOOK_PRICE)}
            {pickup === "delivery" && ` + 택배비 ${won(SHIPPING_FEE)}`}
          </p>
        )}
      </div>

      {state.error && <p className="rounded-xl bg-red-50 p-3 text-center font-bold text-red-600">{state.error}</p>}

      <button className="btn w-full" disabled={pending}>
        {pending ? "제출 중…" : "신청하고 계좌 확인하기"}
      </button>
    </form>
  );
}
