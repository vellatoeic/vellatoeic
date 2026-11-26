import Link from "next/link";
import "./home.css";
import { todayKST } from "@/lib/config";
import NoticePopupHost from "@/components/notices/NoticePopupHost";
import FaqList from "@/components/FaqList";
import Reveal from "@/components/home/Reveal";
import ClassFinder from "@/components/home/ClassFinder";
import Reviews from "@/components/home/Reviews";
import Courses from "@/components/home/Courses";
import { getSetting, listFaq, listSpecialLectures } from "@/lib/db";
import { safe } from "@/lib/safe";
import { publicSpecials } from "@/lib/specialPlan";
import { jsonLdHtml } from "@/lib/seo";
import { deadlineBadge, specialDay, specialRegistrationOpen } from "@/lib/special";
import { COURSE_CARDS, startLabel } from "@/lib/homeCourses";
import { homeCourseMonth } from "@/lib/homeCoursesServer";
import { studentDashboard } from "@/lib/dashboard";
import StudentDashboard from "./StudentDashboard";
import {
  BIG_QUOTE, BRAND, CAREER, CLASSES_INTRO, COURSE_EVENTS, COURSE_NOTE,
  PERKS, POINTS, PROOFS, REVIEWS, TRACKS_INTRO, type ClassIntro,
} from "@/lib/homeContent";

// 특강 모집 여부·강좌 개강일을 매번 확인해요.
export const dynamic = "force-dynamic";

// 첫 화면 (2026-11-26 정리): 시작 화면(두 갈래: 처음이에요 = 반 찾기·수강 신청(YBM) / 등록했어요 = 교재 신청 현장·불라방·강의실, 사진 없음)
// → 수강생 바로가기 → 반 찾기 → 강좌 시간표(수업일 설정의 개강일) → 성적·후기 → 벨라쌤 소개 → 16회 → 혜택 → 자주 묻는 질문(관리 [FAQ])

const icon = (name: string, cls = "") => <img className={`ic3d ${cls}`} src={`/img/icons/${name}.png`} alt="" loading="lazy" decoding="async" />;
const CHECK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
);
const out = { target: "_blank", rel: "noopener noreferrer" } as const;

function SecHead({ eyebrow, title, sub, small }: { eyebrow: string; title: React.ReactNode; sub?: string; small?: boolean }) {
  return (
    <div className={`sec-head rv${small ? " small" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {sub && <p className="sec-sub">{sub}</p>}
    </div>
  );
}

function QuickItem({ href, ic, title, sub, alert }: { href: string; ic: string; title: string; sub: string; alert?: string | null }) {
  return (
    <Link href={href} className="ql">
      {icon(ic, "md")}
      <span className="grow">
        <b>{title}</b>
        <small>{sub}</small>
        {alert && <em className="dl">{alert}</em>}
      </span>
      <span className="chev" aria-hidden="true">›</span>
    </Link>
  );
}

function ClassCard({ c }: { c: ClassIntro }) {
  const row = (k: string, v?: React.ReactNode) => v ? <div className="kv"><dt>{k}</dt><dd>{v}</dd></div> : null;
  return (
    <article className="h-card cls rv tilt">
      <header><h3>{c.name}</h3><span className="note">*{c.note}</span></header>
      {c.lead && <p className="lead">{c.lead}</p>}
      <dl>
        {row("대상", c.target?.map((t) => <span key={t} className="block">{t}</span>))}
        {row("기간", c.period)}
        {row("목표", c.goal && <b className="gold-t">{c.goal.join(" ")}</b>)}
        {row("특징", c.feature.map((t) => <span key={t} className="block">{t}</span>))}
      </dl>
    </article>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ home?: string }> }) {
  // 로그인한 이번 달 수강생(납부 완료 · 수업 기수 · 열람 기간 안)이면 첫 화면은 학생 대시보드예요. (?home=1 이면 소개 화면)
  if ((await searchParams).home !== "1") {
    const dash = await safe("home.dashboard", () => studentDashboard(), null);
    if (dash) return <StudentDashboard d={dash} />;
  }
  // 이번 달 특강이 하나라도 있으면(마감·지난 특강 포함) 메뉴를 보여줘요. 신청 가능하면 '특강 신청', 아니면 '특강 다시 보기'.
  const month = todayKST().slice(0, 7);
  const [specials, courseMonth, faq, kakaoSetting] = await Promise.all([
    safe("home.specials", () => listSpecialLectures(), []),
    safe("home.courseMonth", () => homeCourseMonth(), null),
    safe("home.faq", () => listFaq(), []),
    safe("home.kakao", () => getSetting("kakao_channel_url"), ""),
  ]);
  const thisMonth = publicSpecials(specials).filter((event) => event.event_date.startsWith(month)); // 공개 전 초안 제외
  const open = thisMonth.filter((event) => specialRegistrationOpen(event));
  const kakaoUrl = kakaoSetting || BRAND.kakaoUrl;
  const starts = Object.fromEntries(Object.entries(courseMonth?.starts ?? {}).map(([k, d]) => [k, startLabel(d)]));
  const courseTitle = courseMonth ? `${courseMonth.month}월 강좌 시간표` : "강좌 시간표";

  return (
    <div className="vh">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml() }} />
      <NoticePopupHost />
      <Reveal />

      {/* ── 첫 화면 (2026-11-26 Vella: 사진 없이 깔끔하게, '처음이에요' / '등록했어요' 두 갈래) ── */}
      <section className="start">
        <div className="wrap start-grid">
          <div className="start-head">
          <p className="hero-ybm"><span className="ybm-chip">YBM</span>{BRAND.center}</p>
          <h1>
            {BRAND.tagline},<br /><em>벨라토익</em>
            <span className="sr-only"> 부산 서면 토익 벨라토익(vella_toeic)</span>
          </h1>
          <p className="start-sub">{BRAND.slogan} · 한 달 16회 최단 프로젝트</p>
          </div>

          <div className="start-steps">
          <div className="doors">
            <div className="door">
              <p className="door-k">처음이에요</p>
              <p className="door-t">벨라토익이 처음인 학생</p>
              <p className="door-s">나에게 맞는 반을 찾고, YBM 서면에서 수강 등록해요.</p>
              <div className="door-btns">
                <a href="#finder" className="db main">{icon("target", "xs")}나에게 맞는 반 찾기</a>
                <a href={BRAND.courseUrl} {...out} className="db">{icon("school", "xs")}수강 신청하기 ↗</a>
              </div>
            </div>
            <div className="door on">
              <p className="door-k">등록했어요</p>
              <p className="door-t">학원 수강 등록을 마친 학생</p>
              <p className="door-s">YBM 수강증으로 교재를 신청하고, 강의실에 들어가요.</p>
              <div className="door-btns">
                <Link href="/guide/onsite" className="db main">{icon("book", "xs")}교재 신청 · 현장</Link>
                <Link href="/guide/online" className="db main">{icon("laptop", "xs")}교재 신청 · 불라방</Link>
                <Link href="/class" className="db">{icon("star", "xs")}강의실 들어가기</Link>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ── 수강생 바로가기 ── */}
      <section className="sec quick" id="students">
        <div className="wrap narrow">
          <div className="quick-greet">
            <p className="eyebrow">FOR STUDENTS</p>
            <h2>수강생 바로가기</h2>
          </div>
          <Link href="/class" className="quick-main">
            {icon("star", "md")}
            <span className="grow"><b>강의실</b><small>라이브 입장 · 출석 · 스티커판 · 지난 강의 · LC 음원</small></span>
            <span className="chev" aria-hidden="true">›</span>
          </Link>
          <div className="quick-list">
            <QuickItem href="/guide" ic="book" title="교재 신청" sub="현장 · 불라방 교재 신청 · 신청 확인" />
            <QuickItem href="/mission" ic="clipboard" title="첫 수업 미션" sub="첫 수업 시간에 다 같이 해요" />
            {open.length > 0 ? (
              <QuickItem href="/special" ic="mic" title="특강 신청" sub={open.map((e) => specialDay(e.event_date)).join(" · ")} alert={deadlineBadge(open[0])} />
            ) : thisMonth.length > 0 && (
              <QuickItem href="/special" ic="mic" title="특강 다시 보기" sub="신청한 학생은 이번 달 말까지 다시 볼 수 있어요" />
            )}
            <QuickItem href="/faq" ic="feedback" title="자주 묻는 질문" sub="교재 · 강의실 · 라이브 · 출석 · 숙제" />
          </div>
        </div>
      </section>

      {/* ── 나에게 맞는 반 찾기 ── */}
      <section className="sec" id="finder">
        <div className="wrap">
          <SecHead eyebrow="CLASS FINDER" title="나에게 맞는 반 찾기" sub="세 문제면 충분해요. 소개 자료 속 '선택 길잡이' 문장 그대로!" />
          <div className="finder-grid">
            <div className="rv"><ClassFinder kakaoUrl={kakaoUrl} /></div>
            <div className="class-list">{CLASSES_INTRO.map((c) => <ClassCard key={c.id} c={c} />)}</div>
          </div>
        </div>
      </section>

      {/* ── 강좌 시간표 (수업일 설정의 개강일로 자동) ── */}
      <section className="sec" id="courses">
        <div className="wrap">
          <SecHead
            eyebrow={courseMonth ? `${courseMonth.month}월 CLASSES` : "CLASSES"}
            title={courseTitle}
            sub={`${BRAND.centerShort} · 모든 반이 현장과 불라방(실시간 라이브) 둘 다 열려요`}
          />
          <Courses cards={COURSE_CARDS} starts={starts} />
          <div className="h-card note-card rv">
            <p>{COURSE_NOTE}</p>
            <ul>{COURSE_EVENTS.map((e) => <li key={e}>{e}</li>)}</ul>
            <div className="h-row">
              <a className="h-btn gold" href={BRAND.courseUrl} {...out}>YBM에서 수강료 · 수강 신청 ↗</a>
              <a className="h-btn line" href={`tel:${BRAND.phone.replace(/-/g, "")}`}>문의 {BRAND.phone}</a>
            </div>
            <p className="fine">수강료 · 할인은 반과 이벤트마다 달라 YBM 공식 페이지에서 안내해요.</p>
          </div>
        </div>
      </section>

      {/* ── 성적 인증 · 후기 ── */}
      <section className="sec" id="proof">
        <div className="wrap">
          <SecHead eyebrow="REAL SCORES" title={<>수많은 수강생이 증명한<br /><em>한 달 최단 프로젝트</em></>} sub="벨라토익 소개 자료에 실린 수강생 성적 인증이에요 (토익 990점 만점)." />
          <div className="proofs">
            {PROOFS.map((p) => (
              <article key={p.caption} className="h-card proof rv tilt">
                {p.before && (
                  <div className="pf-row before">
                    <span className="pf-k">{p.beforeLabel ?? "Before"}</span>
                    <b data-count={p.before}>{p.before}</b>
                    <span className="sbar"><i style={{ width: `${Math.round((p.before / 990) * 100)}%` }} /></span>
                  </div>
                )}
                <div className="pf-row after">
                  <span className="pf-k">{p.before ? "After" : "Total"}</span>
                  <b data-count={p.after} data-from={p.before} data-dur="1800">{p.after}</b>
                  <span className="sbar"><i style={{ width: `${Math.round((p.after / 990) * 100)}%` }} /></span>
                </div>
                <p className="pf-lr">{p.lc ? `LC ${p.lc}` : ""}{p.rc ? ` · RC ${p.rc}` : ""}</p>
                <p className="pf-cap">{p.caption}</p>
              </article>
            ))}
          </div>
          <blockquote className="big-quote rv">
            <span className="qmark" aria-hidden="true">&ldquo;</span>
            <p>{BIG_QUOTE.text}</p>
            <footer>{BIG_QUOTE.tag}</footer>
          </blockquote>
          <SecHead eyebrow="REVIEWS" title="토익의 시작 ‘Vella Toeic’을 만나고" small />
          <Reviews reviews={REVIEWS} />
          <p className="center rv" style={{ marginTop: 24 }}>
            <a className="h-btn line" href={BRAND.courseUrl} {...out}>YBM 실시간 수강후기 보러 가기 ↗</a>
          </p>
        </div>
      </section>

      {/* ── 벨라쌤 소개 ── */}
      <section className="sec" id="teacher">
        <div className="wrap">
          <SecHead eyebrow="ABOUT VELLA" title={<>영어전공자에게 배우는<br /><em>리얼 토익</em></>} sub="최단 프로젝트 리얼토익, 필요한 것만 제.대.로 공부하자!" />
          <div className="teacher-grid">
            <div className="h-card glass rv tilt">
              <h3 className="card-t">{icon("laurel", "sm")}경력</h3>
              <ul className="career">
                {CAREER.map(([k, t]) => <li key={t}><span className={`k${k === "현" ? " now" : ""}`}>{k}</span>{t}</li>)}
              </ul>
              <div className="socials">
                <a className="chip-link" href="https://www.instagram.com/vella_toeic/" {...out}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>vella_toeic
                </a>
                <a className="chip-link" href={BRAND.youtubeUrl} {...out}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3z" fill="currentColor" /></svg>벨라토익
                </a>
                <a className="chip-link" href={kakaoUrl} {...out}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 6l-1 3.6 4.1-2.7c.6.1 1.1.1 1.7.1 5 0 9-3.1 9-7S17 4 12 4z" /></svg>카톡 {BRAND.kakaoId}
                </a>
              </div>
            </div>
            <div className="h-card glass rv tilt">
              <h3 className="card-t">{icon("book", "sm")}벨라토익 수업은</h3>
              <ul className="ticks">{POINTS.map((p) => <li key={p}>{CHECK}<span>{p}</span></li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 16회 프로젝트 ── */}
      <section className="sec band" id="project">
        <div className="wrap">
          <SecHead eyebrow="ONE MONTH PROJECT" title={<>한 달, <em>16회</em>로 끝내는<br />토익 졸업 최단 프로젝트</>} sub="주 4회 · 16회 완성 (회당 120분)" />
          <div className="sixteen rv" aria-label="16회 완성">
            {Array.from({ length: 16 }, (_, i) => <span key={i} className="dot16" style={{ "--i": i } as React.CSSProperties}><b>{i + 1}</b></span>)}
          </div>
          <div className="tracks">
            {TRACKS_INTRO.map((t) => (
              <article key={t.title} className="h-card track rv tilt">
                {icon(t.icon, "lg")}
                <h3>{t.title}</h3>
                <p className="lead">{t.lead}</p>
                <ul className="ticks">{t.items.map((x) => <li key={x}>{CHECK}<span>{x}</span></li>)}</ul>
                <p className="fine">*전체 커리큘럼 중 맞춤형 과정 선택!</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 혜택 ── */}
      <section className="sec band">
        <div className="wrap">
          <SecHead eyebrow="BENEFITS" title={<>벨라토익 클래스<br /><em>끝없는 혜택!</em></>} />
          <div className="perks">
            {PERKS.map(([ic, t]) => <div key={t} className="perk rv tilt">{icon(ic)}<p>{t}</p></div>)}
          </div>
        </div>
      </section>

      {/* ── 자주 묻는 질문 (관리 [FAQ]와 같은 내용) ── */}
      <section className="sec faq-sec" id="faq">
        <div className="wrap narrow">
          <SecHead eyebrow="FAQ" title="자주 묻는 질문" sub="교재비 · 강의실 · 라이브 · 출석 · 숙제 · LC 음원 · 특강 · 데일리 테스트" />
          <FaqList items={faq} />
        </div>
      </section>

      <div className="float-cta">
        <a className="h-btn gold sm" href={kakaoUrl} {...out}>카톡 상담</a>
      </div>
    </div>
  );
}
