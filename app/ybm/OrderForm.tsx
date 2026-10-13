"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { createYbmOrderAction, type FormState } from "@/app/actions";

const formatPhone = (v: string) => {
  const d = v.replace(/[^0-9]/g, "").slice(0, 11);
  return d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
};

type PostcodeWindow = Window & { daum?: { Postcode: new (o: { oncomplete: (d: { zonecode: string; roadAddress: string; jibunAddress: string; buildingName: string }) => void }) => { open: () => void } } };

// 사진을 휴대폰에서 줄여서(긴 쪽 1600px, JPG) 올려요. 큰 사진도 빠르게 올라가요.
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "proof.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export default function OrderForm({ amountLabel }: { amountLabel: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createYbmOrderAction, {});
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [base, setBase] = useState("");
  const [manual, setManual] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<FormData | null>(null);
  const detailRef = useRef<HTMLInputElement>(null);

  function searchAddress() {
    const w = window as PostcodeWindow;
    const open = () => new w.daum!.Postcode({
      oncomplete: (d) => { setZip(d.zonecode); setBase((d.roadAddress || d.jibunAddress) + (d.buildingName ? ` (${d.buildingName})` : "")); setTimeout(() => detailRef.current?.focus(), 50); },
    }).open();
    if (w.daum?.Postcode) return open();
    const s = document.createElement("script");
    s.src = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    s.onload = open;
    s.onerror = () => setManual(true);
    document.head.appendChild(s);
  }

  async function pickProof(f: File | undefined) {
    if (!f) return;
    const small = await shrink(f);
    setProof(small);
    setPreview(URL.createObjectURL(small));
  }

  function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    let err = "";
    if (!/^[가-힣a-zA-Z ]{2,20}$/.test(get("name"))) err = "이름을 한글 또는 영문으로 정확히 입력해 주세요.";
    else if (!/^01[0-9]{8,9}$/.test(phone.replace(/-/g, ""))) err = "연락처를 정확히 입력해 주세요. (예: 010-1234-5678)";
    else if (!manual && !zip) err = "[주소 검색] 버튼으로 택배 받을 주소를 찾아 주세요.";
    else if (!get("address_detail")) err = "동·호수 등 상세 주소를 입력해 주세요. (단독주택이면 '단독주택'이라고 적어 주세요)";
    else if (manual && get("address_manual").length < 10) err = "택배 받을 주소를 정확히 입력해 주세요.";
    else if (!proof) err = "인강 수강증 캡처 사진을 올려 주세요.";
    else if (!fd.get("agree")) err = "개인정보 수집·이용에 동의해 주세요.";
    setError(err);
    if (err) return;
    fd.set("phone", phone);
    fd.set("address", manual ? `${get("address_manual")} ${get("address_detail")}` : `[${zip}] ${base}, ${get("address_detail")}`);
    fd.set("proof", proof!);
    setConfirm(fd);
  }

  return (
    <form onSubmit={review} className="space-y-3">
      <section className="card space-y-3">
        <p className="flex items-center gap-2 font-jua text-lg text-sky-ink"><span className="grid h-7 w-7 place-items-center rounded-full bg-sky-deep text-sm text-white">1</span>신청 교재</p>
        <div className="rounded-2xl bg-sky-soft p-3 text-[15px]">
          <p className="flex justify-between py-1"><span>📘 벨라토익 &apos;개념 zip&apos;</span><span>10,000원</span></p>
          <p className="flex justify-between py-1"><span>🚚 택배비</span><span>4,000원</span></p>
          <p className="mt-1.5 flex justify-between border-t-2 border-dashed border-sky-main pt-2 font-jua text-xl text-sky-ink"><span>총 금액</span><span>{amountLabel}</span></p>
        </div>
        <p className="text-sm text-slate-500">📦 인강 수강생은 <b>택배로만</b> 받아요. 입금 확인 후 순서대로 보내 드려요.</p>
      </section>

      <section className="card space-y-4">
        <p className="flex items-center gap-2 font-jua text-lg text-sky-ink"><span className="grid h-7 w-7 place-items-center rounded-full bg-sky-deep text-sm text-white">2</span>받는 분 정보</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="label">이름</span><input name="name" className="input" placeholder="홍길동" autoComplete="name" /></label>
          <label className="block"><span className="label">연락처</span><input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className="input" placeholder="010-1234-5678" inputMode="numeric" autoComplete="tel" /></label>
        </div>
        <div className="space-y-2">
          <span className="label">택배 받을 주소</span>
          {manual ? <input name="address_manual" className="input" placeholder="도로명 주소" /> : (
            <div className="flex gap-2">
              <input readOnly value={zip ? `[${zip}] ${base}` : ""} placeholder="주소 검색을 눌러 주세요" onClick={searchAddress} className="input flex-1 bg-slate-50" />
              <button type="button" onClick={searchAddress} className="btn-ghost shrink-0 !py-2">주소 검색</button>
            </div>
          )}
          <input ref={detailRef} name="address_detail" className="input" placeholder="상세 주소 (예: 101동 1001호)" />
          <span className="block text-sm font-bold text-red-600">* 교재를 받을 수 있도록 동·호수까지 정확한 주소를 입력해 주세요.</span>
        </div>
        <label className="block"><span className="label">입금자명 <span className="font-normal text-slate-400">(이름과 다르면 입력)</span></span><input name="depositor" className="input" placeholder="예: 홍길동(엄마)" /></label>
        <div className="space-y-2">
          <span className="label">YBM 인강 수강증 캡처</span>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-main bg-sky-soft p-4 text-sm font-bold text-sky-ink">
            📷 {proof ? "다른 사진으로 바꾸기" : "사진 올리기"}
            <input type="file" accept="image/*" hidden onChange={(e) => pickProof(e.target.files?.[0])} />
          </label>
          {preview && <img src={preview} alt="수강증 미리보기" className="max-h-56 rounded-xl border border-sky-main" />}
          <span className="block text-xs text-slate-500">수강 중인 강의가 보이는 화면을 캡처해 주세요. 사진은 확인에만 쓰고 발송 30일 뒤 지워져요.</span>
        </div>
        <label className="flex items-start gap-2 text-sm leading-relaxed">
          <input type="checkbox" name="agree" className="mt-0.5 h-5 w-5 shrink-0 accent-sky-deep" />
          <span><b>개인정보 수집·이용 동의 (필수)</b><br /><span className="text-slate-500">교재 발송을 위해 이름·연락처·주소를 받아요. 발송 3개월 뒤 자동 삭제돼요.</span></span>
        </label>
        {(error || state.error) && <p className="rounded-xl bg-red-50 p-3 text-center font-bold text-red-600">{error || state.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "신청 중…" : "교재 신청하기"}</button>
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <p className="font-jua text-center text-2xl text-sky-ink">입력한 내용이 맞나요?</p>
            <dl className="grid grid-cols-[5rem_1fr] gap-y-2 text-[15px]">
              <dt className="text-slate-500">이름</dt><dd className="font-bold">{String(confirm.get("name"))}</dd>
              <dt className="text-slate-500">연락처</dt><dd className="font-bold">{phone}</dd>
              <dt className="text-slate-500">주소</dt><dd className="font-bold">{String(confirm.get("address"))}</dd>
              <dt className="text-slate-500">입금자명</dt><dd>{String(confirm.get("depositor") ?? "").trim() || String(confirm.get("name"))}</dd>
              <dt className="text-slate-500">금액</dt><dd className="font-jua text-xl text-sky-ink">{amountLabel}</dd>
            </dl>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="btn-ghost">수정하기</button>
              <button type="button" onClick={() => { const fd = confirm; setConfirm(null); startTransition(() => action(fd)); }} className="btn">맞아요, 신청</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
