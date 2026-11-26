"use client";

import { DESK } from "@/lib/config";
import Icon from "@/components/Icon";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { previewApplication, submitApplication, type FormState } from "@/app/actions";
import type { ReceiptResult } from "@/app/receiptActions";
import { classTextWithLevel, type ReceiptClass } from "@/lib/receipt/classes";
import ReceiptStep from "./ReceiptStep";
import { BRING_BOOKS_TEXT, lateDeliveryWarning, LATE_DELIVERY_TEXT } from "@/lib/altContinue";
import { scheduleClassFor } from "@/lib/schedule";
import {
  BOOKS, COURSES, KINDS, TRACKS, PICKUPS, SHIPPING_FEE, TIME_SLOTS, booksFor, isAlt, calcAmount, slotLabel, todayKST, won,
  type CourseId, type Kind, type Pickup, type TimeSlot, type Track,
} from "@/lib/config";

// 반·과정을 헷갈리지 않게 짧은 설명을 붙여요.
const COURSE_DESC: Record<CourseId, string> = {
  start: "개념 · 650 목표",
  solve: "실전 문제풀이 · 750 목표",
  intensive: "시작반 + 문풀반 함께",
};
const TRACK_DESC: Record<Track, string> = {
  all: "RC + LC · 월~목 주 4일",
  rc: "RC만 · 월~목 주 4일",
  lc: "LC만 · 월~목 주 4일",
  alt_mw: "RC + LC · 월·수 주 2일 · 두 달 완성",
  alt_tt: "RC + LC · 화·목 주 2일 · 두 달 완성",
  alt: "",
};

const formatPhone = (v: string) => {
  const d = v.replace(/[^0-9]/g, "").slice(0, 11);
  return d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
};

type Postcode = { open: () => void };
type PostcodeWindow = Window & { daum?: { Postcode: new (o: { oncomplete: (d: { zonecode: string; roadAddress: string; jibunAddress: string; buildingName: string }) => void }) => Postcode } };
const POSTCODE_SRC = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

const choice = (on: boolean) =>
  `rounded-2xl border-2 p-4 text-left transition ${on ? "border-sky-deep bg-sky-soft" : "border-sky-main/50 bg-white"}`;

type MonthOption = { cohort: string; label: string; range: string; round: 1 | 2; windows: Record<string, { first: string | null; last: string | null }> };

// account: 구글·카카오만 방식에서 로그인한 계정 이름 (있으면 비밀번호 칸이 없어요)
export default function ApplyForm({ kind, months, today, account = null, receiptMenu = null, notices = [] }: { kind: Kind; months: MonthOption[]; today: string; account?: string | null; receiptMenu?: string | null; notices?: string[] }) {
  const pinFields = !account;
  const [state, action, pending] = useActionState<FormState, FormData>(submitApplication, {});
  // 수강 월: 하나뿐이면 자동, 둘이면 기본 선택 없이 꼭 고르기
  const [month, setMonth] = useState<string | null>(months.length === 1 ? months[0].cohort : null);
  const chosen = months.find((m) => m.cohort === month) ?? null;
  const round = chosen?.round ?? months[0]?.round ?? 1;
  const [course, setCourse] = useState<CourseId | null>(null);
  const [track, setTrack] = useState<Track>("all");
  const [continuing, setContinuing] = useState<boolean | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [pickup, setPickup] = useState<Pickup>(kind === "onsite" ? "classroom" : "delivery");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [baseAddress, setBaseAddress] = useState("");
  const [manualAddress, setManualAddress] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [confirm, setConfirm] = useState<FormData | null>(null);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof previewApplication>> | null>(null);
  const [checking, setChecking] = useState(false);
  const detailRef = useRef<HTMLInputElement>(null);
  // YBM 수강증: 서버가 읽은 반으로 칸을 채워요. '바로 확인'이면 잠그고, '직접 고르기'(override)를 누르면 풀려요(선생님 확인).
  const [receipt, setReceipt] = useState<ReceiptResult | null>(null);
  const [override, setOverride] = useState(false);
  const receiptClasses = (receipt?.classes ?? []).filter((c) => months.some((m) => m.cohort === c.cohort));
  const locked = receipt?.status === "match" && !override && receiptClasses.length > 0;
  const wrongPage = receipt?.status === "match" && receipt.kind === "online" && kind === "onsite" && !override;
  const needOverride = receipt?.status === "reject" && !override;
  // 2단계(수강 월·반·과정·시간·이름·교재 받는 방법)는 수강증을 읽은 뒤에만 보여요 (학생이 반을 먼저 고르는 것처럼 보이지 않게)
  const ready = !!receipt?.id && (receipt.status !== "reject" || override);

  const applyClass = (c: ReceiptClass) => {
    setMonth(c.cohort);
    setCourse(c.course);
    setTrack(c.track);
    setSlot(c.slot);
    setContinuing(null);
  };
  function onReceipt(r: ReceiptResult | null) {
    setReceipt(r);
    setOverride(false);
    const usable = (r?.classes ?? []).filter((c) => months.some((m) => m.cohort === c.cohort));
    // 격일반 2개월 과정처럼 두 달이 다 열려 있으면 학생이 달을 고를 때 그 달 반으로 채워요
    const one = usable.find((c) => c.cohort === month) ?? (usable.length === 1 ? usable[0] : null);
    if (one) applyClass(one);
  }
  function chooseMonth(cohort: string) {
    setMonth(cohort);
    const c = !override ? receiptClasses.find((x) => x.cohort === cohort) : null;
    if (c) applyClass(c);
  }

  // 시작반 격일반만 지난달 이어듣기 여부를 확인해요
  const askContinuing = course === "start" && isAlt(track);
  const books = course ? booksFor(course, track, round, askContinuing && continuing === true) : [];
  const amount = calcAmount(books, pickup);
  const online = kind === "online";
  const blocked = !receipt?.id || wrongPage || needOverride || !month || !course || !slot || (askContinuing && continuing === null);

  // 카카오 우편번호 검색 (불러오지 못하면 직접 입력으로 바꿔요)
  function searchAddress() {
    const w = window as PostcodeWindow;
    const open = () => new w.daum!.Postcode({
      oncomplete: (d) => {
        setZip(d.zonecode);
        setBaseAddress((d.roadAddress || d.jibunAddress) + (d.buildingName ? ` (${d.buildingName})` : ""));
        setTimeout(() => detailRef.current?.focus(), 50);
      },
    }).open();
    if (w.daum?.Postcode) return open();
    const script = document.createElement("script");
    script.src = POSTCODE_SRC;
    script.onload = open;
    script.onerror = () => setManualAddress(true);
    document.head.appendChild(script);
  }

  // 제출 전에 한 번 더 확인해요. 잘못된 칸이 있으면 확인 화면 대신 안내를 보여줘요.
  async function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const name = get("name");
    let error = "";
    if (!/^[가-힣a-zA-Z ]{2,20}$/.test(name)) error = "이름을 한글 또는 영문으로 정확히 입력해 주세요.";
    else if (online && !/^01[0-9]{8,9}$/.test(phone.replace(/-/g, ""))) error = "연락처를 정확히 입력해 주세요. (예: 010-1234-5678)";
    else if (pickup === "delivery" && !manualAddress && !zip) error = "[주소 검색] 버튼으로 택배 받을 주소를 찾아 주세요.";
    else if (pickup === "delivery" && get("address_detail").length < 1) error = "동·호수 등 상세 주소를 입력해 주세요. (단독주택이면 '단독주택'이라고 적어 주세요)";
    else if (pickup === "delivery" && manualAddress && get("address_manual").length < 10) error = "택배 받을 주소를 정확히 입력해 주세요.";
    else if (pinFields && !/^\d{4}$/.test(get("pin"))) error = "강의실 비밀번호를 숫자 4자리로 정해 주세요.";
    else if (!month) error = "몇 월 수업인지 골라 주세요.";
    else if (pinFields && get("pin") !== get("pin2")) error = "비밀번호 확인이 맞지 않아요. 같은 숫자 4자리를 두 번 입력해 주세요.";
    else if (!fd.get("ybm_registered")) error = "YBM 학원 수강 등록을 먼저 마쳐 주세요. (등록했다면 체크)";
    else if (!fd.get("agree")) error = "필독 사항 확인에 체크해 주세요.";
    setCheckError(error);
    if (error) return;
    if (pickup === "delivery") {
      fd.set("address", manualAddress ? `${get("address_manual")} ${get("address_detail")}` : `[${zip}] ${baseAddress}, ${get("address_detail")}`);
    }
    // 서버가 지난달 기록으로 이어듣기·두 달째 요일을 판단해 교재·금액을 알려줘요
    setChecking(true);
    const r = await previewApplication(fd).catch(() => ({ error: "잠시 후 다시 눌러 주세요." }) as Awaited<ReturnType<typeof previewApplication>>);
    setChecking(false);
    if (r.error) { setCheckError(r.error); return; }
    setPlan(r);
    setConfirm(fd);
  }

  function submit() {
    if (!confirm) return;
    const fd = confirm;
    setConfirm(null);
    startTransition(() => action(fd));
  }

  const pickCourse = (c: CourseId) => {
    setCourse(c);
    setContinuing(null);
    if (!COURSES[c].tracks.includes(track)) setTrack(COURSES[c].tracks[0]);
  };

  return (
    <form onSubmit={review} id="apply" className="card scroll-mt-24 space-y-6">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="pickup" value={pickup} />
      <input type="hidden" name="track" value={track} />
      {course && <input type="hidden" name="course" value={course} />}
      {askContinuing && continuing === true && <input type="hidden" name="continuing" value="1" />}
      {slot && <input type="hidden" name="slot" value={slot} />}
      {month && <input type="hidden" name="cohort" value={month} />}
      {receipt?.id && <input type="hidden" name="receipt_id" value={receipt.id} />}
      {override && <input type="hidden" name="receipt_override" value="1" />}

      <ReceiptStep kind={kind} result={receipt} onResult={onReceipt} menu={receiptMenu} />
      {(locked || wrongPage || needOverride) && (
        <button type="button" onClick={() => setOverride(true)} className="-mt-3 block text-left text-xs text-slate-500 underline underline-offset-2">
          {needOverride ? "수강증이 맞는데 계속 안 되나요? 반을 직접 고를게요" : "수강증과 다른 반이 나왔나요? 반을 직접 고를게요"}
        </button>
      )}
      {override && <p className="-mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">직접 고른 반은 선생님이 수강증과 비교해서 확인해요. 학원에 등록한 반과 같은지 꼭 확인해 주세요.</p>}

      {ready ? (
        <>
      {locked && course && slot && month ? (
        <div className="space-y-3">
          <div className="rounded-3xl bg-gradient-to-br from-[#4fb3e8] via-sky-deep to-[#1f78ad] p-5 text-white shadow-[0_10px_26px_rgba(43,143,199,0.3)]">
            <p className="text-sm opacity-85">수강증으로 확인한 내 반</p>
            <p className="mt-1 font-jua text-2xl leading-snug">{classTextWithLevel({ cohort: month, course, track, slot })}</p>
            <p className="text-sm opacity-90">{KINDS[kind].label} · {slotLabel({ course, track }, slot)}</p>
            <div className="mt-4 flex items-end justify-between gap-3 rounded-2xl bg-white/15 p-4">
              <span className="min-w-0">
                <b className="block font-jua text-lg">교재 {books.length}권{askContinuing && continuing === true ? " · 이어듣기" : ""}</b>
                <small className="block text-xs opacity-90">{books.map((b) => BOOKS[b]).join(" · ")}{pickup === "delivery" ? ` + 택배비 ${won(SHIPPING_FEE)}` : ""}</small>
              </span>
              <span className="shrink-0 text-right"><small className="block text-xs opacity-80">교재비</small><b className="font-jua text-3xl">{won(amount)}</b></span>
            </div>
          </div>
          {months.length > 1 && receiptClasses.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              {months.filter((m) => receiptClasses.some((c) => c.cohort === m.cohort)).map((m) => (
                <button type="button" key={m.cohort} onClick={() => chooseMonth(m.cohort)} aria-pressed={month === m.cohort} className={`${choice(month === m.cohort)} text-center`}>
                  <span className="block font-jua text-lg text-sky-ink">{m.label}</span>
                  <span className="text-xs text-slate-500">{m.range}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
      <div className="border-t-2 border-dashed border-sky-main pt-5">
        <p className="flex items-center gap-2 font-jua text-xl text-sky-ink"><span className="grid h-7 w-7 place-items-center rounded-full bg-sky-deep text-sm text-white">2</span>{locked ? "수강증대로 정해진 반을 확인해요" : "학원에 등록한 반을 골라요"}</p>
        <p className="mt-1 text-sm text-slate-500">{locked ? "수강 월·반·과정·시간은 수강증대로 채워져서 바꿀 수 없어요. 이름과 교재 받는 방법만 적어 주세요." : "수강증에서 반을 다 읽지 못했어요. 학원에 등록한 반과 똑같이 골라 주세요. 선생님이 수강증과 비교해서 확인해요."}</p>
      </div>
      <div>
        <p className="label">수강 월</p>
        {months.length === 1 ? (
          <p className="rounded-2xl border-2 border-sky-deep bg-sky-soft p-4 font-jua text-xl text-sky-ink">{months[0].label} <span className="font-body text-sm text-slate-500">· {months[0].range}</span></p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {months.map((m) => (
              <button type="button" key={m.cohort} onClick={() => chooseMonth(m.cohort)} disabled={locked && !receiptClasses.some((c) => c.cohort === m.cohort)} aria-pressed={month === m.cohort} className={`${choice(month === m.cohort)} text-center disabled:opacity-40`}>
                <span className="block font-jua text-xl text-sky-ink">{m.label}</span>
                <span className="text-xs text-slate-500">{m.range}</span>
              </button>
            ))}
          </div>
        )}
        {months.length > 1 && !month && <p className="mt-1 text-xs text-amber-700">수강할 달을 꼭 골라 주세요.</p>}
      </div>

      <div>
        <p className="label">1. 수강 신청한 반 {locked && <span className="font-normal text-emerald-700">(수강증대로 정해졌어요)</span>}</p>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(COURSES) as CourseId[]).map((c) => (
            <button type="button" key={c} onClick={() => pickCourse(c)} disabled={locked && course !== c} className={`${choice(course === c)} text-center disabled:opacity-40`}>
              <p className="font-jua text-xl text-sky-ink">{COURSES[c].label}</p>
              <p className="mt-1 text-xs text-slate-500">{COURSE_DESC[c]}</p>
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
                disabled={locked && track !== t}
                className={`${choice(track === t)} block w-full disabled:opacity-40`}
              >
                <span className="font-jua text-lg text-sky-ink">
                  {COURSES[course].label} {TRACKS[t]}
                </span>
                <span className="ml-2 text-sm text-slate-500">{TRACK_DESC[t]}</span>
              </button>
            ))}
          </div>
          {COURSES[course].tracks.some((t) => isAlt(t)) && (
            <p className="mt-2 text-xs text-slate-500">두 달째 수강생: 지난달 월·수반 → 이번 달 화·목반 / 지난달 화·목반 → 이번 달 월·수반</p>
          )}
        </div>
      )}

      {course && (
        <div>
          <p className="label">3. 수강 시간</p>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(TIME_SLOTS) as TimeSlot[]).map((s) => {
              const [name, time] = slotLabel({ course, track }, s).split(" ");
              return (
                <button type="button" key={s} onClick={() => setSlot(s)} disabled={locked && slot !== s} className={`${choice(slot === s)} text-center disabled:opacity-40`}>
                  <span className="font-jua block text-lg text-sky-ink">{name}</span>
                  <span className="mt-1 block text-sm text-slate-600">{time}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

        </>
      )}

      {askContinuing && (
        <div>
          <p className="label">지난달에도 시작반 격일반을 들었어요? <span className="font-normal text-slate-400">(지난달 기록으로 자동 확인돼요)</span></p>
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
          {/* 개강 직전(학생 반 첫 수업일 3일 전 ~ 마지막 수업일)에 택배를 고르면 안내만 (막지는 않아요) */}
          {pickup === "delivery" && chosen && course && (() => {
            const w = chosen.windows[scheduleClassFor(course, track)];
            return w && lateDeliveryWarning(today, w.first, w.last) ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800"><Icon name="parcel" size={18} className="mr-1" />{LATE_DELIVERY_TEXT}</p> : null;
          })()}
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
            <input name="phone" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className="input" placeholder="010-1234-5678" inputMode="numeric" autoComplete="tel" />
          </label>
        )}
        <label className="sm:col-span-2">
          <span className="label">입금자명 <span className="font-normal text-slate-400">(이름과 같으면 비워두세요)</span></span>
          <span className="mb-1 block text-xs font-bold text-red-600">다른 이름으로 입금하면 꼭 적어 주세요 (안 적으면 자동 확인이 안 돼요)</span>
          <input name="depositor" className="input" placeholder="예: 홍길동(엄마)" />
        </label>
        {account && (
          <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-ink sm:col-span-2">
            <b>{account}</b> 계정으로 신청해요. 강의실·특강도 이 계정으로 들어와요.
          </p>
        )}
        {pinFields && <label className="sm:col-span-2">
          <span className="label">강의실 비밀번호 <span className="font-normal text-slate-400">(숫자 4자리 · 강의 볼 때 사용)</span></span>
          <div className="grid grid-cols-2 gap-2">
            <input name="pin" className="input tracking-[0.4em]" placeholder="숫자 4자리" inputMode="numeric" maxLength={4} type="password" />
            <input name="pin2" className="input tracking-[0.4em]" placeholder="한 번 더" inputMode="numeric" maxLength={4} type="password" />
          </div>
          <span className="mt-1 block text-xs text-slate-500">강의실·특강 신청에 계속 쓰니 꼭 기억해 주세요. <b className="text-sky-deep">지난달에 신청했다면 같은 비밀번호를 써 주세요.</b></span>
        </label>}
        {online && pickup === "classroom" && (
          <div className="space-y-2 sm:col-span-2">
            <span className="label">{DESK} 교재 수령 희망 날짜·시간</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="pickup_date" min={todayKST()} required className="input" aria-label="수령 희망 날짜" />
              <input type="time" name="pickup_time" step={1800} required className="input" aria-label="수령 희망 시간" />
            </div>
            <span className="block text-xs text-slate-500">미리 교재를 준비해 둘게요. 납부가 확인된 뒤 고른 날짜에 {DESK}에서 받아 가세요.</span>
          </div>
        )}
        {pickup === "delivery" && (
          <div className="space-y-2 sm:col-span-2">
            <span className="label">택배 받을 주소</span>
            {manualAddress ? (
              <input name="address_manual" className="input" placeholder="도로명 주소 (예: 부산 부산진구 중앙대로 000)" autoComplete="street-address" />
            ) : (
              <div className="flex gap-2">
                <input readOnly value={zip ? `[${zip}] ${baseAddress}` : ""} placeholder="주소 검색을 눌러 주세요" onClick={searchAddress} className="input flex-1 bg-slate-50" />
                <button type="button" onClick={searchAddress} className="btn-ghost shrink-0 !py-2">주소 검색</button>
              </div>
            )}
            <input ref={detailRef} name="address_detail" className="input" placeholder="상세 주소 (예: 101동 1001호)" />
            <span className="block text-sm font-bold text-red-600">* 교재를 받을 수 있도록 동·호수까지 정확한 주소를 입력해 주세요.</span>
          </div>
        )}
      </div>

      <input type="hidden" name="ybm_registered" value="1" />
      {notices.length > 0 && (
        <details className="group rounded-2xl bg-sky-soft p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-sky-ink">
            필독 사항 {notices.length}가지
            <span className="text-sm font-normal text-sky-deep group-open:hidden">눌러서 읽기</span>
          </summary>
          <ul className="mt-3 space-y-2">
            {notices.map((n) => (
              <li key={n} className="flex gap-2 text-[15px] leading-relaxed text-slate-700"><Icon name="check" size={16} className="mt-1 shrink-0 text-sky-deep" />{n}</li>
            ))}
          </ul>
        </details>
      )}
      <label className="flex items-start gap-3 rounded-2xl border-2 border-sky-main/60 bg-white p-4">
        <input type="checkbox" name="agree" className="mt-1 h-5 w-5 accent-sky-deep" />
        <span className="text-[15px] text-slate-700">필독 사항을 읽었어요.</span>
      </label>

      {!locked && <div className="rounded-2xl border-2 border-dashed border-sky-main p-5 text-center">
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
      </div>}

      {(checkError || state.error) && <p className="rounded-xl bg-red-50 p-3 text-center font-bold text-red-600">{checkError || state.error}</p>}

      <button className="btn w-full" disabled={pending || blocked || checking}>
        {pending ? "제출 중…" : checking ? "확인 중…" : amount > 0 && course ? `교재비 ${won(amount)} 입금 안내 받기` : "입력 내용 확인하기"}
      </button>
      <p className="text-center text-sm text-slate-600">제출하면 바로 입금 계좌가 나와요. <b className="text-red-600">30분 안에 입금</b>하면 끝!<br />입금이 확인되면 강의실이 열려요.</p>

        </>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center">
          <p className="font-jua text-lg text-slate-400">2단계 · 반 확인하고 교재 받는 방법 고르기</p>
          <p className="mt-1 text-sm text-slate-500">위에서 YBM 수강증을 올리면 <b>수강 월 · 반 · 과정 · 수강 시간</b>이 자동으로 채워지고, 이어서 이름과 교재 받는 방법을 적어요.</p>
        </div>
      )}

      {confirm && course && slot && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <p className="font-jua text-center text-2xl text-sky-ink">입력한 내용이 맞나요?</p>
            {chosen && <p className="rounded-2xl bg-sky-deep py-2 text-center font-jua text-3xl text-white">{chosen.label} <span className="text-base opacity-90">· {chosen.range}</span></p>}
            <div className="rounded-2xl bg-sky-soft p-4 text-center">
              <p className="text-sm text-slate-500">{KINDS[kind].label}</p>
              <p className="font-jua text-2xl text-sky-ink">{COURSES[course].label} {TRACKS[track]}</p>
              <p className="font-jua text-xl text-sky-deep">{slotLabel({ course, track }, slot)}</p>
              {plan?.continuing && <p className="text-sm text-slate-600">이어듣기 (지난달 기록 확인 · LC 교재만)</p>}
            </div>
            <p className={`rounded-xl p-3 text-center text-sm font-bold ${locked ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {locked ? "YBM 수강증과 같은 반이에요" : "선생님이 수강증을 보고 반을 확인해요"}
            </p>
            {plan?.notice && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">{plan.notice}</p>}
            <dl className="grid grid-cols-[5.5rem_1fr] gap-y-2 text-[15px]">
              <dt className="text-slate-500">이름</dt><dd className="font-bold">{String(confirm.get("name")).trim()}</dd>
              {online && (<><dt className="text-slate-500">연락처</dt><dd className="font-bold">{phone}</dd></>)}
              <dt className="text-slate-500">입금자명</dt><dd>{String(confirm.get("depositor") ?? "").trim() || String(confirm.get("name")).trim()}</dd>
              {online && (<><dt className="text-slate-500">교재 수령</dt><dd>{PICKUPS[pickup].label}</dd></>)}
              {online && pickup === "classroom" && (<><dt className="text-slate-500">수령 희망</dt><dd className="font-bold">{String(confirm.get("pickup_date"))} {String(confirm.get("pickup_time"))} · {DESK}</dd></>)}
              {pickup === "delivery" && (<><dt className="text-slate-500">택배 주소</dt><dd className="font-bold">{String(confirm.get("address"))}</dd></>)}
              <dt className="text-slate-500">교재</dt><dd>{(plan?.books ?? books.map((b) => BOOKS[b])).join(", ")}</dd>
              <dt className="text-slate-500">교재비</dt><dd className="font-jua text-xl text-sky-ink">{won(plan?.amount ?? amount)}</dd>
            </dl>
            {plan?.continuing && <p className="rounded-xl bg-yellow-100 p-3 text-sm font-bold text-yellow-900"><Icon name="book" size={18} className="mr-1" />{BRING_BOOKS_TEXT}</p>}
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">반·시간을 잘못 고르면 다른 교재가 준비돼요.<br />학원에 등록한 반과 같은지 꼭 확인해 주세요.</p>
            <p className="rounded-xl bg-red-50 p-3 text-center text-sm font-bold text-red-600"><Icon name="clock" size={18} className="mr-1" />제출 후 30분 안에 입금해 주세요</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="btn-ghost">수정하기</button>
              <button type="button" onClick={submit} className="btn">맞아요, 제출</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
