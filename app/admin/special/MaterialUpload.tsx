"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MaterialUpload({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/special-material", { method: "POST", body: new FormData(form) });
      const result = await response.json() as { error?: string; ok?: string };
      if (!response.ok) throw new Error(result.error || "자료를 올리지 못했어요.");
      setMessage(result.ok || "자료를 올렸어요.");
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "자료를 올리지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="file" name="file" required className="min-w-0 flex-1 text-sm" />
      <button className="btn-ghost !py-2" disabled={busy}>{busy ? "올리는 중…" : "자료 올리기"}</button>
      <p className="w-full text-xs text-slate-500">PDF·문서·이미지 파일, 파일당 4MB까지 올릴 수 있어요.</p>
      {message && <p className="w-full text-sm text-sky-deep">{message}</p>}
    </form>
  );
}
