"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { uploadHomework, type FormState } from "@/app/actions";

// 휴대폰 사진을 긴 변 1280px JPEG로 줄여서 올려요 (보통 200KB 안팎)
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("변환 실패"))), "image/jpeg", 0.72));
}

export default function HomeworkUpload({ appId, doneToday }: { appId: string; doneToday: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadHomework, {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const done = doneToday || !!state.ok;

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr("");
    setBusy(true);
    try {
      const blob = await shrink(f);
      const fd = new FormData();
      fd.set("app_id", appId);
      fd.set("photo", new File([blob], "homework.jpg", { type: "image/jpeg" }));
      startTransition(() => action(fd));
    } catch {
      setErr("사진을 읽지 못했어요. 다른 사진으로 다시 시도해 주세요.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="mt-4">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy || pending}
        className={done ? "btn-ghost w-full" : "btn w-full"}
      >
        {busy || pending ? "올리는 중…" : done ? "⭐ 오늘 숙제 인증 완료 (다시 올리기)" : "📷 오늘 숙제 인증하기"}
      </button>
      {(err || state.error) && <p className="mt-2 text-center text-sm font-bold text-red-600">{err || state.error}</p>}
      {state.ok && <p className="mt-2 text-center text-sm font-bold text-sky-deep">{state.ok}</p>}
    </div>
  );
}
