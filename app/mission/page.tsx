import { BLOG_URL, INSTAGRAM_URL } from "@/lib/config";
import { getSetting, type Mission } from "@/lib/db";
import { markMission } from "@/app/actions";
import { missionCount, studentMission, type MissionStep } from "@/lib/mission";
import StudentLogin from "@/app/class/StudentLogin";
import IntroForm from "./IntroForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 수업 미션 · vella_toeic", robots: { index: false } };

function Num({ done, n }: { done: boolean; n: number }) {
  return (
    <span className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full font-jua ${done ? "bg-[#4cc38a] text-white" : "bg-[#e6f4fc] text-sky-deep"}`}>
      {done ? "✓" : n}
    </span>
  );
}

function Title({ title, sub }: { title: string; sub: string }) {
  return <p className="font-jua text-[17px] text-sky-ink">{title}<small className="block font-body text-xs text-[#7aa3bd]">{sub}</small></p>;
}

export default async function MissionPage() {
  const current = await studentMission();
  if (!current) return <StudentLogin next="/mission" note="강의실과 같은 이름·비밀번호로 들어와요." />;
  const { app, mission } = current;
  const [cafeUrl, cafeHomeworkUrl, blogUrl] = await Promise.all([getSetting("cafe_url"), getSetting("cafe_homework_url"), getSetting("blog_url")]);
  const count = missionCount(mission);
  const firstName = app.name.length > 1 ? app.name.slice(1) : app.name;

  const links: { step: MissionStep; n: number; title: string; sub: string; href: string; go: string; did: string }[] = [
    { step: "cafe_at", n: 2, title: "네이버 카페 가입", sub: "숙제는 카페에 올려요", href: cafeUrl || cafeHomeworkUrl, go: "카페 가기 ↗", did: "가입했어요 ✓" },
    { step: "blog_at", n: 3, title: "블로그 서로이웃 추가", sub: "수업 자료를 보려면 '서로이웃'이어야 해요. 이웃 말고 서로이웃으로 신청해 주세요", href: blogUrl || BLOG_URL, go: "블로그 가기 ↗", did: "서로이웃 신청했어요 ✓" },
    { step: "insta_at", n: 4, title: "인스타 팔로우", sub: "@vella_toeic · 쌤과 연락할 수 있는 비상 연락망이에요", href: INSTAGRAM_URL, go: "인스타 가기 ↗", did: "팔로우했어요 ✓" },
  ];
  const introDone = !!mission?.intro_at;

  return (
    <div className="mx-auto max-w-md space-y-2.5 pt-8">
      <h1 className="text-center font-jua text-[26px] text-sky-ink">첫 수업 미션 ✅</h1>
      <p className="text-center text-sm text-[#6b93ad]">{firstName}님, 4개만 하면 웰컴 배지를 받아요!<br />첫 수업 시간에 다 같이 해요 :)</p>

      <section className="mt-3 rounded-[20px] bg-white px-4 py-3.5 shadow-[0_2px_0_#d5ecf9]">
        <div className="flex items-center justify-between font-jua text-base text-sky-ink"><span>미션 진행</span><span>{count} / 4</span></div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#e6f4fc]">
          <i className="block h-full rounded-full bg-gradient-to-r from-[#79c6ef] to-[#b9a7ff]" style={{ width: `${count * 25}%` }} />
        </div>
        <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-[#f3efff] px-2.5 py-2 text-[12.5px] text-[#7a6aa8]">
          <span className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border-[3px] border-white bg-[#e8f8ef] text-lg shadow-[0_2px_6px_rgba(31,90,128,.2)] ${count === 4 ? "" : "opacity-70 grayscale-[.6]"}`}>👋</span>
          <span>{count === 4 ? <>미션 완료! 스티커판에 <b>웰컴 배지</b>가 붙었어요</> : <>4개 모두 완료하면 스티커판에 <b>웰컴 배지</b>가 붙어요</>}</span>
        </div>
      </section>

      <section className="rounded-[20px] bg-white px-4 py-3.5 shadow-[0_2px_0_#d5ecf9]">
        <div className="flex items-center gap-2.5">
          <Num done={introDone} n={1} />
          <Title title="나를 소개해요" sub="Vella가 수업에 참고해요" />
          {introDone && <span className="ml-auto font-jua text-xs text-[#4cc38a]">완료!</span>}
        </div>
        {introDone ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-[#7aa3bd]">소개 수정하기</summary>
            <IntroForm intro={introOf(mission)} />
          </details>
        ) : <IntroForm intro={introOf(mission)} />}
      </section>

      {links.map((m) => {
        const done = !!mission?.[m.step];
        return (
          <section key={m.step} className={`rounded-[20px] bg-white px-4 py-3.5 shadow-[0_2px_0_#d5ecf9] ${done ? "opacity-75" : ""}`}>
            <div className="flex items-center gap-2.5">
              <Num done={done} n={m.n} />
              <Title title={m.title} sub={m.sub} />
              {done && <span className="ml-auto font-jua text-xs text-[#4cc38a]">완료!</span>}
            </div>
            {!done && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {m.href
                  ? <a href={m.href} target="_blank" rel="noreferrer" className="grid place-items-center rounded-[14px] bg-[#eaf6fd] p-2.5 font-jua text-[14.5px] text-sky-ink">{m.go}</a>
                  : <span className="grid place-items-center rounded-[14px] bg-slate-50 p-2.5 text-center text-xs text-slate-400">링크 준비 중이에요</span>}
                <form action={markMission}>
                  <input type="hidden" name="step" value={m.step} />
                  <button className="w-full rounded-[14px] border-2 border-dashed border-sky-main bg-white p-2.5 font-jua text-[14.5px] text-sky-deep">{m.did}</button>
                </form>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function introOf(m: Mission | null) {
  return {
    prev_score: m?.prev_score ?? "",
    target_score: m?.target_score ?? "",
    exam_month: m?.exam_month ?? "",
    affiliation: m?.affiliation ?? "",
    instagram: m?.instagram ?? "",
    message: m?.message ?? "",
  };
}
