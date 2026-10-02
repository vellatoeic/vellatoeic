import Link from "next/link";
import Cloud from "@/components/Cloud";

// 문구는 초안이에요. 자유롭게 바꿔 주세요.
const POINTS = [
  { t: "개념부터 탄탄하게", d: "토익이 처음이어도 괜찮아요. 시작반에서 개념집으로 기초를 잡고 갑니다." },
  { t: "문제로 점수를 완성", d: "문풀반에서 실전 문제를 풀며 점수로 이어지는 감각을 만들어요." },
  { t: "현장도, 라이브도", d: "서면 강의실 현장 수업과 온라인 불라방 중 편한 방식으로 들어요." },
];

function HeroCloud({ className }: { className: string }) {
  return <Cloud className={`pointer-events-none absolute fill-white ${className}`} />;
}

export default function Home() {
  return (
    <div className="space-y-8 pt-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-sky-main px-6 py-12 text-center">
        <HeroCloud className="cloud-a -left-6 top-4 w-36 opacity-80" />
        <HeroCloud className="cloud-b -right-8 top-24 w-28 opacity-60" />
        <HeroCloud className="cloud-a -bottom-4 left-10 w-24 opacity-50" />
        <HeroCloud className="cloud-b -bottom-6 -right-4 w-40 opacity-70" />

        <p className="font-jua relative text-lg tracking-wide text-sky-ink/70">vella_toeic</p>
        <h1 className="font-jua relative mt-1 text-5xl text-sky-ink sm:text-6xl">반가워요:)</h1>

        <div className="relative mx-auto mt-8 max-w-sm rounded-3xl bg-white/85 p-6 shadow-[0_4px_24px_rgba(43,143,199,0.15)] backdrop-blur">
          <p className="font-jua text-2xl text-sky-ink">수강 신청을 마치셨나요?</p>
          <p className="mt-2 text-slate-600">
            수업 전에 필독 사항을 확인하고
            <br />
            교재비 납부까지 완료해 주세요.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link href="/guide/onsite" className="btn !px-3 !text-base">현장 수강생</Link>
            <Link href="/guide/online" className="btn !px-3 !text-base">불라방 수강생</Link>
          </div>
        </div>
      </section>

      <section>
        <p className="font-jua mb-4 text-center text-2xl leading-snug text-sky-ink">
          토익 점수가 필요한 순간,
          <br />
          vella_toeic과 끝까지 함께해요.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.t} className="card">
              <h3 className="font-jua text-xl text-sky-ink">{p.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
