import Link from "next/link";
import Cloud from "@/components/Cloud";
import NoticePopupHost from "@/components/notices/NoticePopupHost";
import { listSpecialLectures } from "@/lib/db";
import { specialDay, specialRegistrationOpen } from "@/lib/special";

// 특강 모집 여부를 매번 확인해요.
export const dynamic = "force-dynamic";

const KIND_BUTTONS = [
  { href: "/guide/onsite", icon: "🏫", label: "현장 수강생", sub: "703호 수업" },
  { href: "/guide/online", icon: "💻", label: "불라방 수강생", sub: "온라인 라이브" },
];

// 배경에 떠 있는 구름 (위치 · 크기 · 색)
const CLOUDS = [
  "-left-8 top-6 w-28 fill-white cloud-a",
  "-right-6 top-2 w-24 fill-white cloud-b",
  "-right-4 top-64 w-20 fill-[#d9f0fd] cloud-a",
  "-left-6 top-[30rem] w-24 fill-[#d9f0fd] cloud-b",
  "-right-2 top-[36rem] w-16 fill-white cloud-a",
];

function MenuItem({ href, icon, bg, title, sub }: { href: string; icon: string; bg: string; title: string; sub: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-[20px] bg-white p-4 shadow-[0_3px_0_#cfe6f5] transition active:translate-y-0.5">
      <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[14px] text-[22px]" style={{ background: bg }}>{icon}</span>
      <span className="font-jua text-lg text-sky-ink">
        {title}
        <small className="block font-body text-xs text-[#7aa3bd]">{sub}</small>
      </span>
      <span className="ml-auto text-xl text-[#a9c9dd]">›</span>
    </Link>
  );
}

export default async function Home() {
  const open = (await listSpecialLectures()).filter((event) => specialRegistrationOpen(event.event_date, event.starts_at));

  return (
    // 휴대폰·태블릿: 한 줄로 쌓아요(태블릿은 조금 넓게). 컴퓨터: 왼쪽에 인사·수강 형태, 오른쪽에 메뉴를 나란히 놓아요.
    <>
    <NoticePopupHost />
    <div className="relative -mx-4 overflow-hidden px-4 pb-6 lg:mx-[calc(50%-min(32rem,50vw-1rem))] lg:pb-12">
      {CLOUDS.map((c) => <Cloud key={c} className={`pointer-events-none absolute opacity-85 ${c}`} />)}

      <div className="relative mx-auto max-w-md sm:max-w-lg lg:grid lg:min-h-[calc(100dvh-14rem)] lg:max-w-none lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-24">
        <div>
          <div className="pb-5 pt-10 text-center lg:pt-0 lg:text-left">
            <h1 className="font-jua text-[40px] text-sky-ink lg:text-6xl">반가워요:)</h1>
            <p className="mt-2 text-[15px] text-[#5b88a6] lg:text-lg">수강 신청을 마치셨나요?</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:gap-4">
            {KIND_BUTTONS.map((k) => (
              <Link key={k.href} href={k.href} className="rounded-[22px] bg-sky-deep px-2.5 pb-[18px] pt-[22px] text-center font-jua text-[19px] text-white shadow-[0_5px_0_#1f6f9d] transition hover:bg-[#4fb0e6] active:translate-y-1 active:shadow-[0_1px_0_#1f6f9d] lg:py-8 lg:text-2xl">
                <span className="mb-1.5 block text-[30px] lg:text-4xl">{k.icon}</span>
                {k.label}
                <small className="mt-1 block font-body text-[11.5px] opacity-90 lg:text-sm">{k.sub}</small>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-[18px] grid gap-2.5 lg:mt-0 lg:gap-3">
          <MenuItem href="/class" icon="☁️" bg="#e3f4fd" title="강의실" sub="출석 · 스티커판 · 강의 영상" />
          <MenuItem href="/mission" icon="✅" bg="#e8f8ef" title="첫 수업 미션" sub="첫 수업 시간에 다 같이 해요" />
          <MenuItem href="/faq" icon="❓" bg="#f3efff" title="자주 묻는 질문" sub="교재비 · 강의실 · 라이브 · 출석 · 숙제" />
          {open.length > 0 && (
            <MenuItem href="/special" icon="🎤" bg="#fff5cc" title="특강 신청" sub={open.map((e) => specialDay(e.event_date)).join(" · ")} />
          )}
        </div>
      </div>
    </div>
    </>
  );
}
