import Link from "next/link";
import "./dashboard.css";
import Icon from "@/components/Icon";
import StudentTabBar from "@/components/StudentTabBar";
import NoticePopupHost from "@/components/notices/NoticePopupHost";
import AudioPopup from "@/components/audio/AudioPopup";
import AddToHome from "@/components/AddToHome";
import { COURSES, KINDS, TIME_SLOTS, TRACKS } from "@/lib/config";
import { specialDay } from "@/lib/special";
import type { Dashboard } from "@/lib/dashboard";

// 학생 대시보드 (로그인한 이번 달 수강생의 첫 화면). 데이터는 lib/dashboard.ts studentDashboard.
// 토스처럼 깔끔하게: 흰 카드 · 큰 숫자 · 오른쪽 화살표 목록. 움직임: 카드가 차례로 올라오고 진행 링이 차올라요.

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

function Row({ href, icon, title, sub, right, external }: { href: string; icon: string; title: string; sub?: string; right?: React.ReactNode; external?: boolean }) {
  const inner = (
    <>
      <Icon name={icon} size={36} />
      <span className="sd-row-txt">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      {right}
      <Icon name={external ? "external" : "chevronRight"} size={16} className="sd-chev" />
    </>
  );
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="sd-row">{inner}</a>
    : <Link href={href} className="sd-row">{inner}</Link>;
}

function Ring({ done, total }: { done: number; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c * (1 - done / Math.max(1, total));
  return (
    <div className="sd-ring">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} className="sd-ring-bg" />
        <circle cx="60" cy="60" r={r} className="sd-ring-fg" strokeDasharray={c} strokeDashoffset={off} style={{ "--c": c } as React.CSSProperties} />
      </svg>
      <div className="sd-ring-txt"><b>{done}</b><span>/ {total}회</span></div>
    </div>
  );
}

export default function StudentDashboard({ d }: { d: Dashboard }) {
  const a = d.app;
  const slot = a.slot;
  const title = d.dStart !== null
    ? <>개강까지 <em>D-{d.dStart}</em></>
    : d.dEnd !== null
      ? d.dEnd === 0 ? <>오늘 <em>종강</em>이에요</> : <>종강까지 <em>D-{d.dEnd}</em></>
      : <>{d.cohortMonth}월 수업이 끝났어요</>;

  return (
    <div className="sd wide">
      <NoticePopupHost />
      {d.audio && d.audio.count > 0 && <AudioPopup cohort={a.cohort} end={d.audio.end} />}

      <header className="sd-head">
        <p className="sd-hello">안녕하세요, {d.name}님</p>
        <h1>{d.cohortMonth}월 강의실</h1>
        <p className="sd-chips">
          <span className="sd-chip">{COURSES[a.course].label} {TRACKS[a.track]}</span>
          {slot && <span className="sd-chip"><Icon name={slot === "am" ? "sun" : "moon"} size={16} />{TIME_SLOTS[slot]}</span>}
          <span className="sd-chip"><Icon name={a.kind === "onsite" ? "school" : "laptop"} size={16} />{KINDS[a.kind].short}</span>
        </p>
      </header>

      {d.pendingCount > 0 && (
        <Link href="/class" className="sd-card sd-notice">
          <Icon name="hourglass" size={36} />
          <span className="sd-row-txt"><b>입금 확인 중인 신청이 {d.pendingCount}개 있어요</b><small>계좌·금액은 강의실에서 확인해요</small></span>
          <Icon name="chevronRight" size={16} className="sd-chev" />
        </Link>
      )}

      {/* 컴퓨터(1024px 이상)에서는 왼쪽: 라이브·진행·오늘 할 일 / 오른쪽: 카드·단톡방·메뉴 (휴대폰은 위아래 그대로) */}
      <div className="sd-cols">
      <div className="sd-main">
      {/* 라이브: 수업 10분 전~종료까지 빨갛게 (강의실과 같은 규칙) */}
      {d.live.open ? (
        d.live.link ? (
          <a href={d.live.link} target="_blank" rel="noreferrer" className="sd-live on">
            <Icon name="livedot" size={30} className="vt-pulse" />
            <span className="sd-row-txt"><b>라이브 입장</b><small>{d.live.label} · 눌러서 입장해요</small></span>
            <Icon name="chevronRight" size={18} className="sd-chev" />
          </a>
        ) : (
          <Link href="/class" className="sd-live soon">
            <Icon name="livedot" size={30} className="vt-pulse" />
            <span className="sd-row-txt"><b>라이브 곧 시작</b><small>{d.live.label} · 링크가 올라오면 바로 입장해요</small></span>
          </Link>
        )
      ) : (
        <Link href="/class" className="sd-live">
          <Icon name="live" size={34} />
          <span className="sd-row-txt"><b>다음 라이브</b><small>{d.live.next ?? "이번 달 라이브가 모두 끝났어요"}</small></span>
          <Icon name="chevronRight" size={16} className="sd-chev" />
        </Link>
      )}

      {/* 한 달 진행 */}
      <section className="sd-card sd-progress">
        <Ring done={d.done} total={d.days.length} />
        <div>
          <p className="sd-eyebrow">한 달 최단 프로젝트</p>
          <h2>{title}</h2>
          {d.first && d.last && <p className="sd-muted">{md(d.first)} ~ {md(d.last)} · 총 {d.days.length}회</p>}
          <p className="sd-stats">
            <span><Icon name="cloud" size={18} />출석 <b>{d.attendance}</b></span>
            <span><Icon name="star" size={18} />숙제 별 <b>{d.stars}</b></span>
          </p>
        </div>
      </section>

      {/* 오늘 할 일 */}
      <section className="sd-card">
        <h3 className="sd-title">{d.isClassDay ? "오늘 할 일" : "다음 수업"}</h3>
        {d.isClassDay ? (
          <ul className="sd-todo">
            <li className={d.attendedToday ? "ok" : ""}>
              <Icon name={d.attendedToday ? "check" : "qr"} size={26} />
              <span>{d.attendedToday ? "출석 완료" : "출석 · 수업 화면의 QR을 찍어요"}</span>
            </li>
            <li>
              <Icon name="homework" size={26} />
              <span>숙제 · 카페에 올리고 스티커판에서 별 받기</span>
              <Link href="/class#sticker" className="sd-link">스티커판</Link>
            </li>
            {d.tests && d.tests.today > 0 && (
              <li className={d.tests.todayDone === d.tests.today ? "ok" : ""}>
                <Icon name={d.tests.todayDone === d.tests.today ? "check" : "stopwatch"} size={26} />
                <span>오늘의 테스트 {d.tests.todayDone}/{d.tests.today} 제출 · 23:59까지</span>
                <Link href="/class" className="sd-link">내기</Link>
              </li>
            )}
          </ul>
        ) : (
          <p className="sd-big">{d.next ? specialDay(d.next) : "이번 달 수업이 모두 끝났어요"}</p>
        )}
      </section>

      </div>
      <div className="sd-side">
      {/* 카드 묶음 */}
      <div className="sd-grid">
        {d.tests && (
          <Link href={d.tests.missed > 0 ? "/class/tests" : "/class"} className="sd-card sd-mini">
            <Icon name="stopwatch" size={40} />
            <b>데일리 테스트</b>
            <small>{d.tests.missed > 0 ? `밀린 테스트 ${d.tests.missed}개` : d.tests.today > 0 ? `오늘 ${d.tests.todayDone}/${d.tests.today} 제출` : "밀린 테스트 없음"}</small>
          </Link>
        )}
        {d.specials.length > 0 ? (
          <Link href="/special" className="sd-card sd-mini">
            <Icon name="mic" size={40} />
            <b>{d.specials[0].label} 특강</b>
            <small>{d.specials[0].state === "confirmed" ? "신청 확정" : d.specials[0].state === "pending" ? "보증금 입금 대기" : "신청할 수 있어요"}</small>
            {d.specials[0].badge && <em className="sd-badge">{d.specials[0].badge}</em>}
          </Link>
        ) : (
          <Link href="/special" className="sd-card sd-mini">
            <Icon name="mic" size={40} />
            <b>특강</b>
            <small>신청 · 다시 보기</small>
          </Link>
        )}
        {d.audio && (
          <Link href="/class#lc-audio" className="sd-card sd-mini">
            <Icon name="headphones" size={40} />
            <b>LC 음원 {d.audio.count}개</b>
            <small>{d.audio.count === 0 ? "올라오면 알려드려요" : `${md(d.audio.end)}까지 · D-${d.audio.left}`}</small>
          </Link>
        )}
        <Link href="/class/scores" className="sd-card sd-mini">
          <Icon name="trophy" size={40} />
          <b>모의고사 성적</b>
          <small>{a.student_no ? `개인번호 ${a.student_no}` : "개인번호 · 성적 보기"}</small>
        </Link>
        {d.mission < 4 && (
          <Link href="/mission" className="sd-card sd-mini">
            <Icon name="clipboard" size={40} />
            <b>첫 수업 미션 {d.mission}/4</b>
            <small>다 하면 웰컴 배지</small>
          </Link>
        )}
      </div>

      {d.chat && (
        <a href={d.chat.url} target="_blank" rel="noreferrer" className="sd-card sd-notice">
          <Icon name="chat" size={36} />
          <span className="sd-row-txt"><b>벨라토익 단톡방</b><small>{d.chat.code ? `참여코드 ${d.chat.code}` : "눌러서 들어가요"}</small></span>
          <Icon name="external" size={16} className="sd-chev" />
        </a>
      )}

      <section className="sd-card sd-menu">
        <Row href="/class" icon="star" title="강의실 전체 보기" sub="스티커판 · 지난 강의 · LC 음원 · 선물" />
        {d.tests && <Row href="/class/tests" icon="chart" title="내 테스트 기록" sub="점수 그래프 · 밀린 테스트" />}
        <Row href="/class/scores" icon="trophy" title="내 모의고사 성적" sub="개인번호 · 총점 · 틀린 문항" />
        <Row href="/special" icon="mic" title="특강" sub="신청 · 자료 · 다시 보기" />
        <Row href="/notices" icon="megaphone" title="공지" />
        <Row href="/faq" icon="book" title="자주 묻는 질문" />
        <Row href="/?home=1" icon="school" title="벨라토익 홈" sub="소개 · 강좌 시간표" />
      </section>

      <AddToHome />
      </div>
      </div>
      <StudentTabBar tests={!!d.tests} />
    </div>
  );
}
