import Link from "next/link";

export default function Guide() {
  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <h1 className="font-jua text-4xl text-sky-ink">필독 사항 확인</h1>
        <p className="mt-3 text-slate-600">수강 형태를 선택해 주세요.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/guide/onsite" className="card group block transition hover:-translate-y-1">
          <p className="text-4xl">🏫</p>
          <h2 className="font-jua mt-3 text-2xl text-sky-ink">현장 수강생</h2>
          <p className="mt-2 text-slate-600">서면 강의실에서 수업 들어요.</p>
          <p className="mt-4 font-bold text-sky-deep group-hover:underline">필독 사항 읽기 →</p>
        </Link>
        <Link href="/guide/online" className="card group block transition hover:-translate-y-1">
          <p className="text-4xl">💻</p>
          <h2 className="font-jua mt-3 text-2xl text-sky-ink">불라방 수강생</h2>
          <p className="mt-2 text-slate-600">온라인 라이브로 수업 들어요.</p>
          <p className="mt-4 font-bold text-sky-deep group-hover:underline">필독 사항 읽기 →</p>
        </Link>
      </div>
    </div>
  );
}
