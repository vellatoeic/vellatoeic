"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { finishAudioUpload, prepareAudioUpload } from "@/app/actions";

type Item = { name: string; size: number; progress: number; status: "waiting" | "uploading" | "done" | "error"; message?: string };

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;

// 진행률을 보여주려고 fetch 대신 XMLHttpRequest로 올려요.
function put(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", "audio/mpeg");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`업로드 실패 (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("인터넷 연결을 확인해 주세요."));
    xhr.send(file);
  });
}

export default function AudioUploader({ cohort, course }: { cohort: string; course: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function upload(files: File[]) {
    const mp3s = files.filter((f) => /\.mp3$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
    if (mp3s.length === 0) return;
    setBusy(true);
    setItems(mp3s.map((f) => ({ name: f.name, size: f.size, progress: 0, status: "waiting" })));
    const update = (i: number, patch: Partial<Item>) => setItems((list) => list.map((it, n) => (n === i ? { ...it, ...patch } : it)));
    // 순서가 지켜지도록 한 개씩 차례로 올려요.
    for (const [i, file] of mp3s.entries()) {
      update(i, { status: "uploading" });
      try {
        const prepared = await prepareAudioUpload({ cohort, course, fileName: file.name, size: file.size });
        if (prepared.error || !prepared.path) throw new Error(prepared.error ?? "업로드를 준비하지 못했어요.");
        if (prepared.url) await put(prepared.url, file, (p) => update(i, { progress: p }));
        const done = await finishAudioUpload({ cohort, course, path: prepared.path, fileName: file.name, size: file.size });
        if (done.error) throw new Error(done.error);
        update(i, { status: "done", progress: 100 });
      } catch (e) {
        update(i, { status: "error", message: e instanceof Error ? e.message : "업로드하지 못했어요." });
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) upload([...e.dataTransfer.files]); }}
        onClick={() => !busy && input.current?.click()}
        className={`cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition ${over ? "border-sky-deep bg-sky-soft" : "border-sky-main bg-white"} ${busy ? "opacity-60" : ""}`}
      >
        <p className="text-3xl">🎧</p>
        <p className="font-jua mt-2 text-lg text-sky-ink">{busy ? "올리는 중이에요… 창을 닫지 마세요" : "mp3 파일을 여기로 끌어오거나 눌러서 고르세요"}</p>
        <p className="mt-1 text-sm text-slate-500">여러 개를 한 번에 올릴 수 있어요 · 파일 하나 50MB까지 · 제목은 파일 이름으로 정해져요</p>
        <input ref={input} type="file" accept=".mp3,audio/mpeg" multiple hidden onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {items.map((it) => (
            <li key={it.name} className="rounded-xl bg-white px-3 py-2">
              <div className="flex justify-between gap-2">
                <span className="truncate">{it.name} <span className="text-slate-400">{mb(it.size)}</span></span>
                <span className={`shrink-0 font-bold ${it.status === "error" ? "text-red-600" : it.status === "done" ? "text-emerald-600" : "text-sky-deep"}`}>
                  {it.status === "waiting" ? "대기" : it.status === "uploading" ? `${it.progress}%` : it.status === "done" ? "완료" : "실패"}
                </span>
              </div>
              {it.status === "uploading" && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sky-soft"><i className="block h-full bg-sky-deep" style={{ width: `${it.progress}%` }} /></div>}
              {it.message && <p className="text-xs text-red-600">{it.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
