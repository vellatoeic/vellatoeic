"use client";

// 신청서 맨 위 'YBM 수강증 올리기': 사진을 휴대폰에서 줄여 보내고, 서버가 읽은 반을 신청서에 알려줘요.
import { useEffect, useRef, useState } from "react";
import { readReceiptAction, type ReceiptResult } from "@/app/receiptActions";
import { KINDS, type Kind } from "@/lib/config";
import { classTextWithLevel } from "@/lib/receipt/classes";
import ReceiptHowTo from "./ReceiptHowTo";

// 휴대폰 캡처를 가로 1600px 이하 JPEG로 줄여요 (Vercel 업로드 한도 4.5MB 안, 글자는 또렷하게)
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / bmp.width, 3400 / bmp.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (blob) return blob;
  } catch {
    // 줄이지 못하면 원본을 보내요 (JPG·PNG만)
  }
  return file;
}

export default function ReceiptStep({ kind, result, onResult, menu }: { kind: Kind; result: ReceiptResult | null; onResult: (r: ReceiptResult | null) => void; menu?: string | null }) {
  const [reading, setReading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(file: File | undefined) {
    if (!file) return;
    onResult(null);
    setPreview(URL.createObjectURL(file));
    setReading(true);
    const slowTimer = setTimeout(() => setSlow(true), 10_000);
    try {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.set("receipt", new File([blob], blob.type === "image/jpeg" ? "receipt.jpg" : file.name, { type: blob.type || file.type }));
      onResult(await readReceiptAction(fd));
    } catch {
      onResult({ status: "error", message: "수강증을 보내지 못했어요. 잠시 뒤 다시 올려 주세요.", classes: [], kind: null });
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const other: Kind = kind === "onsite" ? "online" : "onsite";
  const wrongPage = result?.status === "match" && result.kind === "online" && kind === "onsite";
  const tone = !result ? "" : result.status === "match" && !wrongPage ? "border-emerald-300 bg-emerald-50" : result.status === "reject" || result.status === "error" || wrongPage ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50";

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 font-jua text-xl text-sky-ink"><span className="grid h-7 w-7 place-items-center rounded-full bg-sky-deep text-sm text-white">1</span>YBM 수강증 올리기 <span className="font-body text-sm font-normal text-slate-400">(필수)</span></p>
      <p className="text-[15px] leading-relaxed text-slate-600">
        YBM 앱·홈페이지의 <b className="text-sky-ink">수강증 화면(파란 카드)</b>을 캡처해서 올려 주세요. 반·과정·시간·수강 월이 자동으로 채워져요.
      </p>
      <ReceiptHowTo menu={menu} open={!(result?.status === "match")} />

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-sky-main p-4">
        {preview && <img src={preview} alt="올린 수강증" className="h-20 w-14 shrink-0 rounded-lg object-cover object-top" />}
        <div className="flex-1">
          {reading ? (
            <p className="text-sm font-bold text-sky-ink" aria-live="polite">
              수강증을 읽고 있어요… 보통 5초쯤 걸려요.
              {slow && <span className="mt-1 block font-normal text-slate-500">여러 명이 한꺼번에 올리면 차례대로 읽어요. 길어도 1분 안에 끝나요.</span>}
            </p>
          ) : (
            <button type="button" onClick={() => inputRef.current?.click()} className="btn-ghost w-full !py-2">
              {result ? "다른 사진 다시 올리기" : "수강증 사진 고르기"}
            </button>
          )}
        </div>
      </div>

      {result && !reading && (
        <div className={`space-y-2 rounded-2xl border-2 p-4 ${tone}`} aria-live="polite">
          {result.status === "match" && !wrongPage ? (
            <>
              <p className="font-jua text-lg text-emerald-800">수강증을 확인했어요</p>
              {result.classes.map((c) => (
                <p key={c.cohort} className="font-bold text-slate-800">{classTextWithLevel(c)}{result.kind ? ` · ${KINDS[result.kind].short}` : ""}</p>
              ))}
              <p className="text-xs text-slate-600">아래 반·과정·시간이 수강증대로 채워졌어요.</p>
            </>
          ) : wrongPage ? (
            <>
              <p className="font-bold text-red-700">이 수강증은 {KINDS.online.short} 수강증이에요. {KINDS.online.short} 신청서에서 신청해 주세요.</p>
              <a href={`/guide/${other}`} className="btn inline-block !py-2 text-center">{KINDS.online.short} 신청서로 가기</a>
            </>
          ) : (
            <p className={`text-sm font-bold ${result.status === "reject" || result.status === "error" ? "text-red-700" : "text-amber-800"}`}>{result.message}</p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">수강증 사진은 반 확인에만 써요. 자동으로 확인되면 제출할 때 바로 지우고, 선생님 확인이 필요한 사진도 확인 7일 뒤 지워요.</p>
    </div>
  );
}
