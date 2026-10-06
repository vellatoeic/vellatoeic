import Link from "next/link";

// 불라방 학생에게 보여주는 "수업 듣는 방법" 카드. 반 정보가 있으면 수업 요일·시간도 보여줘요.
export default function HowToWatch({ days, times }: { days?: string; times?: { label: string; from: string; to: string }[] }) {
  const steps = [
    "수업 10분 전, 홈페이지 → 강의실",
    "이름 + 비밀번호 4자리로 로그인",
    "맨 위 \"🔴 라이브 입장\" 버튼 누르기",
  ];
  return (
    <section className="rounded-3xl border-2 border-sky-main bg-white p-6 shadow-[0_4px_24px_rgba(43,143,199,0.12)]">
      <p className="font-jua text-2xl text-sky-ink">📺 수업 듣는 방법</p>
      {days && times && times.length > 0 && (
        <div className="mt-3 rounded-2xl bg-sky-soft px-4 py-3">
          <p className="text-sm text-slate-500">내 수업</p>
          {times.map((t) => (
            <p key={t.label} className="font-jua text-xl text-sky-deep">{days} {t.label} {t.from}~{t.to}</p>
          ))}
        </div>
      )}
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className="font-jua grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-deep text-lg text-white">{"①②③"[i]}</span>
            <span className="text-[17px] text-slate-800">{s}</span>
          </li>
        ))}
      </ol>
      <Link href="/class" className="btn mt-5 w-full">강의실 바로가기 →</Link>
    </section>
  );
}
