import Icon from "@/components/Icon";
import Link from "next/link";
import { BLOG_URL, CLASSROOM, INSTAGRAM_URL } from "@/lib/config";
import { getSetting } from "@/lib/db";
import { safe } from "@/lib/safe";
import { jsonLdHtml, pageMeta } from "@/lib/seo";
import Timetable from "@/components/Timetable";

export const metadata = pageMeta(
  "벨라토익 소개·반 구성·시간표 | 부산 서면 토익",
  "부산 서면 토익 벨라토익 소개. 시작반(650)·문풀반(750)·속성반 구성과 시간표, 현장·라이브 수강, 신청 방법을 안내해요.",
  "/about",
);

const YBM_SIGNUP_URL = "https://www.ybmedu.com/seomyon/vellatoeic";

const CLASSES = [
  { icon: "reading", name: "시작반", goal: "토익 650 목표", body: "토익을 처음 시작하거나 다시 기초부터 잡고 싶은 분을 위한 개념반이에요. 개념집과 RC·LC 교재로 문법·어휘·듣기의 뼈대를 차근차근 쌓아요." },
  { icon: "target", name: "문풀반", goal: "토익 750 목표", body: "개념을 아는 분을 위한 실전반이에요. 점수가 오르는 풀이 감각을 집중해서 끌어올려요." },
  { icon: "stopwatch", name: "속성반", goal: "한 달 집중", body: "한 달 동안 시작반과 문풀반을 함께 듣는 주 4일 집중 과정이에요. 짧은 기간에 개념과 실전을 한 번에 끝내고 싶은 분께 맞아요." },
  { icon: "calendar", name: "격일반", goal: "2달 완성", body: "월·수 또는 화·목, 주 2일씩 두 달 이어 들으면 한 과정이 완성돼요. 일정이 바쁜 직장인·대학생에게 좋아요." },
  { icon: "headphones", name: "단과", goal: "RC 또는 LC만", body: "RC만, 혹은 LC만 집중해서 듣고 싶을 때 골라요. LC는 시작반·문풀반 공통 수업이에요." },
];

const CARE = [
  { icon: "stopwatch", title: "데일리 테스트", body: "매 수업 짧은 테스트로 실력이 쌓이는 걸 직접 확인해요." },
  { icon: "star", title: "출석·숙제 스티커판", body: "QR로 출석하고 숙제를 내면 스티커판에 별이 쌓여요. 한 달 스티커판을 다 채우면 작은 선물도 준비돼 있어요." },
  { icon: "mic", title: "특강", body: "매달 두 번, 수강생만을 위한 특강이 열려요. 현장 또는 라이브로 참여할 수 있어요." },
  { icon: "replay", title: "강의 다시 보기", body: "놓친 수업은 강의실에서 종강일까지 다시 볼 수 있어요." },
];

export default async function AboutPage() {
  const [kakao, blogSetting] = await Promise.all([
    safe("about.kakao", () => getSetting("kakao_channel_url"), ""),
    safe("about.blog", () => getSetting("blog_url"), ""),
  ]);
  const links = [
    { href: blogSetting || BLOG_URL, label: "네이버 블로그", sub: "토익 자료·공지", bg: "#e8f8ef" },
    { href: INSTAGRAM_URL, label: "인스타그램 @vella_toeic", sub: "쌤과의 비상 연락망", bg: "#fdeef3" },
    ...(kakao ? [{ href: kakao, label: "카카오톡 채널", sub: "궁금한 점 문의", bg: "#fff5cc" }] : []),
  ];

  return (
    <article className="stagger space-y-6 pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml() }} />

      <header className="text-center">
        <span className="rounded-full bg-sky-main px-4 py-1.5 text-sm font-bold text-sky-ink">토익의 시작</span>
        <h1 className="font-jua mt-4 break-keep text-[32px] leading-tight text-sky-ink sm:text-4xl">부산 서면 토익<br />벨라토익(vella_toeic)</h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-slate-700">
          벨라토익은 <b>YBM 서면</b>에서 Vella쌤이 직접 가르치는 <b>부산 서면 토익</b> 수업이에요.
          토익을 처음 시작하는 분부터 <b>토익 650</b>, <b>토익 750</b>을 목표로 하는 분까지,
          서면 강의실 현장 수업과 집에서 듣는 <b>토익 인강 라이브(불라방)</b> 중 편한 방법으로 함께해요.
        </p>
      </header>

      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 font-jua text-2xl text-sky-ink"><Icon name="book" size={32} />반 구성</h2>
        <p className="text-[15px] text-slate-600">모든 과정은 <b>4주 16회</b>(주 4회, 월~목)이고 매달 첫째 주에 개강해요. 반마다 오전반·저녁반이 있어요.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {CLASSES.map((c) => (
            <li key={c.name} className="rounded-2xl bg-sky-soft p-4">
              <h3 className="flex flex-wrap items-center gap-1.5 font-jua text-xl text-sky-ink"><Icon name={c.icon} size={30} />{c.name} <span className="text-base text-sky-deep">· {c.goal}</span></h3>
              <p className="mt-1 text-[15px] leading-relaxed text-slate-700">{c.body}</p>
            </li>
          ))}
        </ul>
        <a href={YBM_SIGNUP_URL} target="_blank" rel="noreferrer" className="btn w-full gap-2"><Icon name="edit" size={24} />수강 신청하러 가기 ↗</a>
        <p className="text-center text-sm text-slate-500">YBM 서면에서 수강 등록 후, 이 홈페이지에서 교재비를 신청해요.</p>
      </section>

      <Timetable />

      <section className="card space-y-4">
        <h2 className="flex flex-wrap items-center gap-2 font-jua text-2xl text-sky-ink"><Icon name="school" size={32} />현장 수업 · <Icon name="laptop" size={32} />라이브 수업</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-sky-soft p-4">
            <h3 className="font-jua text-xl text-sky-ink">현장 수업 ({CLASSROOM})</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-700">YBM 서면 {CLASSROOM}에서 직접 수업을 들어요. 교재는 첫 수업 날 강의실에서 한꺼번에 나눠 드려요.</p>
          </div>
          <div className="rounded-2xl bg-sky-soft p-4">
            <h3 className="font-jua text-xl text-sky-ink">불라방 (토익 인강 라이브)</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-700">같은 수업을 유튜브 라이브로 실시간으로 들어요. 놓친 수업은 종강일까지 다시 볼 수 있고, 교재는 1층 데스크 수령이나 택배로 받아요.</p>
          </div>
        </div>
        <p className="text-sm text-slate-500">현장 학생도 사정이 생기면 라이브로 들을 수 있고, 오전반·저녁반 교차 수강도 돼요.</p>
      </section>

      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 font-jua text-2xl text-sky-ink"><Icon name="cloud" size={32} />끝까지 함께하는 수업 관리</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {CARE.map((c) => (
            <li key={c.title} className="rounded-2xl bg-sky-soft p-4">
              <h3 className="flex items-center gap-1.5 font-jua text-lg text-sky-ink"><Icon name={c.icon} size={28} />{c.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-slate-700">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 font-jua text-2xl text-sky-ink"><Icon name="people" size={32} />함께하는 스터디</h2>
        <div className="space-y-1 rounded-2xl bg-sky-soft p-4 text-[15px] leading-relaxed text-slate-700">
          <p className="font-jua text-lg text-sky-ink">혼자 하면 무너지는 토익, 스터디로 끝까지 함께 가요.</p>
          <p>현장 수강생은 수업 전에 함께, 불라방 수강생은 셀프 스터디로 참여해요.</p>
          <p className="text-slate-500">어떻게 진행하는지는 수업에서 함께 알려드릴게요 :)</p>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 font-jua text-2xl text-sky-ink"><Icon name="edit" size={30} />수강 신청 방법</h2>
        <ol className="space-y-3">
          {[
            <>YBM 서면 학원에서 벨라토익 수업 <b>수강 등록</b>을 해요. <a href={YBM_SIGNUP_URL} target="_blank" rel="noreferrer" className="text-sky-deep underline">YBM 서면 수강 등록 ↗</a></>,
            <>이 홈페이지에서 <b>현장</b> 또는 <b>불라방</b>을 골라 필독 사항을 읽고 <b>교재비 신청서</b>를 내요.</>,
            <>안내된 계좌로 교재비를 입금하면 확인 후 <b>납부 완료</b>로 바뀌어요.</>,
            <>신청한 뒤 <b>강의실</b>에 로그인해 라이브·출석·스티커판을 이용해요.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-slate-700">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-deep font-jua text-white">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/guide/onsite" className="btn gap-1.5 !px-3 !text-base"><Icon name="school" size={24} />현장 교재비 신청</Link>
          <Link href="/guide/online" className="btn gap-1.5 !px-3 !text-base"><Icon name="laptop" size={24} />불라방 교재비 신청</Link>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-jua text-2xl text-sky-ink"><Icon name="link" size={30} />벨라토익 채널</h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {links.map((l) => (
            <li key={l.label}>
              <a href={l.href} target="_blank" rel="noreferrer" className="block rounded-2xl p-4 font-jua text-lg text-sky-ink" style={{ background: l.bg }}>
                {l.label}
                <small className="block font-body text-xs text-slate-500">{l.sub}</small>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-500">궁금한 점은 <Link href="/faq" className="text-sky-deep underline">자주 묻는 질문</Link>에서 먼저 찾아보세요.</p>
      </section>
    </article>
  );
}
