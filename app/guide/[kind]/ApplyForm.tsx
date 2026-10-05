"use client";

import { keep } from "@/lib/keep";
import { useActionState, useState } from "react";
import { submitApplication, type FormState } from "@/app/actions";
import {
  BOOKS, COURSES, KINDS, TRACKS, PICKUPS, SHIPPING_FEE, TIME_SLOTS, booksFor, isAlt, calcAmount, slotLabel, won,
  type CourseId, type Kind, type Pickup, type TimeSlot, type Track,
} from "@/lib/config";

const choice = (on: boolean) =>
  `rounded-2xl border-2 p-4 text-left transition ${on ? "border-sky-deep bg-sky-soft" : "border-sky-main/50 bg-white"}`;

export default function ApplyForm({ kind, round }: { kind: Kind; round: 1 | 2 }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitApplication, {});
  const [course, setCourse] = useState<CourseId | null>(null);
  const [track, setTrack] = useState<Track>("all");
  const [continuing, setContinuing] = useState<boolean | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [pickup, setPickup] = useState<Pickup>(kind === "onsite" ? "classroom" : "delivery");

  // 시작반 격일반만 지난달 이어듣기 여부를 확인해요
  const askContinuing = course === "start" && isAlt(track);
  const books = course ? booksFor(course, track, round, askContinuing && continuing === true) : [];
  const amount = calcAmount(books, pickup);
  const online = kind === "online";
  const blocked = !course || !slot || (askContinuing && continuing === null);

  const pickCourse = (c: CourseId) => {
    setCourse(c);
    setContinuing(null);
    if (!COURSES[c].tracks.includes(track)) setTrack(COURSES[c].tracks[0]);
  };

  return (
    <form onSubmit={keep(action)} className="card space-y-6">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="pickup" value={pickup} />
      <input type="hidden" name="track" value={track} />
      {course && <input type="hidden" name="course" value={course} />}
      {askContinuing && continuing === true && <input type="hidden" name="continuing" value="1" />}
      {slot && <input type="hidden" name="slot" value={slot} />}

      <div>
        <p className="label">1. 수강 신청한 반</p>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(COURSES) as CourseId[]).map((c) => (
            <button type="button" key={c} onClick={() => pickCourse(c)} className={`${choice(course === c)} text-center`}>
              <p className="font-jua text-xl text-sky-ink">{COURSES[c].label}</p>
            </button>
          ))}
        </div>
      </div>

      {course && (
        <div>
          <p className="label">2. 수강 과정</p>
          <div className="space-y-2">
            {COURSES[course].tracks.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => {
                  setTrack(t);
                  setContinuing(null);
                }}
                className={`${choice(track === t)} block w-full`}
              >
                <span className="font-jua text-lg text-sky-ink">
                  {COURSES[course].label} {TRACKS[t]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {askContinuing && (
        <div>
          <p className="label">지난달에도 시작반 격일반을 들었어요?</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setContinuing(true)} className={`${choice(continuing === true)} text-center`}>
              <span className="font-jua text-lg text-sky-ink">예</span>
              <span className="mt-1 block text-sm text-slate-600">LC 교재만 받아요</span>
            </button>
            <button type="button" onClick={() => setContinuing(false)} className={`${choice(continuing === false)} text-center`}>
              <span className="font-jua text-lg text-sky-ink">아니요</span>
              <span className="mt-1 block text-sm text-slate-600">처음 듣는 과정이에요</span>
            </button>
          </div>
        </div>
      )}

      {course && (
        <div>
          <p className="label">3. 수강 시간</p>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(TIME_SLOTS) as TimeSlot[]).map((s) => {
              const [name, time] = slotLabel({ course, track }, s).split(" ");
              return (
                <button type="button" key={s} onClick={() => setSlot(s)} className={`${choice(slot === s)} text-center`}>
                  <span className="font-jua block text-lg text-sky-ink">{name}</span>
                  <span className="mt-1 block text-sm text-slate-600">{time}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {online && (
        <div>
          <p className="label">4. 교재 수령 방법</p>
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
            <span className="mt-1 block text-sm font-bold text-red-600">* 교재를 받을 수 있도록 동·호수까지 정확한 주소를 입력해 주세요.</span>
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
            {slot && ` · ${TIME_SLOTS[slot]}`}
            {askContinuing && continuing === true && " · 이어듣기"}
          </p>
        )}
        {books.length > 0 ? (
          <>
            <p className="font-jua text-2xl text-sky-ink">교재 {books.length}권</p>
            <p className="font-jua mt-1 text-4xl text-sky-ink">{won(amount)}</p>
            <p className="mt-2 text-xs text-slate-500">
              {books.map((b) => BOOKS[b]).join(" · ")}
              {pickup === "delivery" && ` + 택배비 ${won(SHIPPING_FEE)}`}
            </p>
          </>
        ) : (
          <p className="text-slate-500">반과 과정을 고르면 교재와 금액이 자동으로 나와요.</p>
        )}
      </div>

      {state.error && <p className="rounded-xl bg-red-50 p-3 text-center font-bold text-red-600">{state.error}</p>}

      <button className="btn w-full" disabled={pending || blocked}>
        {pending ? "제출 중…" : "신청서 제출하기 (입금은 다음 단계)"}
      </button>
      <p className="text-center text-sm text-slate-600">제출 후 나오는 계좌로 <b className="text-red-600">입금까지 해야</b> 신청이 완료돼요.<br />신청서는 한 번만 제출해 주세요.</p>
    </form>
  );
}
