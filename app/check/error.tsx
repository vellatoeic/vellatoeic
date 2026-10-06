"use client";

import Link from "next/link";

// 출석 화면에서 예상하지 못한 오류가 나면 보여줘요.
export default function CheckError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="pt-12">
      <div className="card mx-auto max-w-sm space-y-3 text-center">
        <p className="font-jua text-3xl text-sky-ink">출석 화면에 문제가 생겼어요</p>
        <p className="text-slate-600">다시 시도해 주세요.<br />계속 안 되면 이 화면을 캡처해서 Vella쌤에게 보내 주세요.</p>
        {error.digest && <p className="rounded-xl bg-slate-50 p-2 text-xs text-slate-400">오류 번호 {error.digest}</p>}
        <button onClick={() => retry()} className="btn w-full">다시 시도</button>
        <Link href="/class" className="btn-ghost w-full">강의실로 가기</Link>
      </div>
    </div>
  );
}
