"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { studentLogout } from "@/app/actions";

// 머리 오른쪽 메뉴 서랍 (2026-11-27 Vella): 벨라토익 소개(맨 위) → 교재 신청 → 수강생 전용(표시). 묶음은 모두 닫힌 채로 시작하고 누르면 열려요.
// 서랍은 body 바로 아래에 그려요(포털): 머리의 흐림 효과(backdrop-filter) 안에 두면
// 아이폰 사파리 등에서 화면 전체가 아니라 머리 높이 안에 갇혀 보여요.
const ABOUT: [string, string, string][] = [
  ["/#teacher", "laurel", "벨라쌤 소개"],
  ["/#project", "hourglass", "한 달 최단 프로젝트"],
  ["/#finder", "target", "나에게 맞는 반 찾기"],
  ["/#proof", "trophy", "성적 인증 · 후기"],
  ["/#courses", "calendar", "강좌 시간표"],
  ["/about", "school", "벨라토익 소개 · 수강 신청 방법"],
  ["/faq", "book", "자주 묻는 질문"],
];
const BOOKS: [string, string, string][] = [
  ["/guide/onsite", "school", "현장 수강생 · 교재 신청"],
  ["/guide/online", "laptop", "불라방 수강생 · 교재 신청"],
];
const STUDENT: [string, string, string][] = [
  ["/me", "people", "내 정보"],
  ["/class", "star", "강의실"],
  ["/class/scores", "trophy", "모의고사 결과"],
  ["/mission", "clipboard", "첫 수업 미션"],
  ["/special", "mic", "특강"],
  ["/notices", "megaphone", "공지"],
];
const YBM_URL = "https://www.ybmedu.com/seomyon/vellatoeic";

// 강사 모드(관리 화면) 전용 메뉴 (2026-11-27 Vella: '강사모드 전용 + 카테고리화'): 하는 일 순서로 묶어 한눈에 보이게 펼쳐 둬요.
const TEACHER: { title: string; items: [string, string, string][] }[] = [
  { title: "매일 수업", items: [["/admin/stamps", "homework", "출석·숙제"], ["/admin/lectures", "live", "강의 관리"], ["/admin/tests", "stopwatch", "오늘의 테스트"], ["/admin/qr", "qr", "QR 출석"]] },
  { title: "신청 · 교재", items: [["/admin", "clipboard", "신청 관리"], ["/admin/roster", "school", "현장 명단"], ["/admin/delivery", "parcel", "불라방"], ["/admin/students", "people", "학생 찾기"]] },
  { title: "한 달 준비", items: [["/admin/schedule", "calendar", "일정표"], ["/admin/special", "mic", "특강 관리"], ["/admin/audio", "headphones", "LC 음원"]] },
  { title: "성적 · 소통", items: [["/admin/scores", "trophy", "모의고사"], ["/admin/notices", "megaphone", "공지"], ["/admin/faq", "book", "FAQ"]] },
  { title: "화면 보기", items: [["/admin/view-as", "reading", "학생 화면으로 보기"], ["/?home=1", "laptop", "홈페이지"]] },
];

export default function SiteMenu({ loggedIn = false, admin = false }: { loggedIn?: boolean; admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const teacher = admin && path.startsWith("/admin"); // 강사 모드: 관리 화면에서는 강사 메뉴만
  useEffect(() => setOpen(false), [path]); // 다른 화면으로 가면 닫혀요
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const item = ([href, icon, label]: [string, string, string]) => (
    <Link key={href} href={href} className="dr-item" aria-current={path === href} onClick={() => setOpen(false)}>
      <img src={`/img/icons/${icon}.png`} alt="" />
      {label}
    </Link>
  );

  return (
    <>
      <button type="button" className="icon-btn" aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
      </button>
      {open && createPortal(
        <div className="drawer-bg" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="메뉴">
            <div className="dr-head">
              <span className="wordmark">VELLA <i>TOEIC</i></span>
              <button type="button" className="icon-btn" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            {teacher ? (
            <nav className="dr-body" aria-label="강사 메뉴">
              <p className="dr-mode">강사 모드</p>
              {TEACHER.map((g) => (
                <section key={g.title} className="dr-sec">
                  <h3>{g.title}</h3>
                  <div className="dr-grid">
                    {g.items.map(([href, icon, label]) => (
                      <Link key={href} href={href} className="dr-tile" aria-current={path === href} onClick={() => setOpen(false)}>
                        <img src={`/img/icons/${icon}.png`} alt="" />
                        {label}
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </nav>
            ) : (
            <nav className="dr-body">
              {admin && (
                <Link href="/admin" className="dr-item dr-login" onClick={() => setOpen(false)}>
                  <img src="/img/icons/settings.png" alt="" />
                  강사 화면으로
                </Link>
              )}
              {!loggedIn && (
                <Link href="/login" className="dr-item dr-login" onClick={() => setOpen(false)}>
                  <img src="/img/icons/lock.png" alt="" />
                  로그인
                </Link>
              )}
              <details className="dr-group">
                <summary>벨라토익 소개</summary>
                {ABOUT.map(item)}
                <a className="dr-item" href={YBM_URL} target="_blank" rel="noopener noreferrer">
                  <img src="/img/icons/calendar.png" alt="" />
                  YBM에서 수강 신청 ↗
                </a>
              </details>
              <details className="dr-group">
                <summary>교재 신청</summary>
                {BOOKS.map(item)}
              </details>
              <details className="dr-group">
                <summary>수강생 전용{!loggedIn && <span className="dr-badge">로그인 필요</span>}</summary>
                {STUDENT.map(item)}
              </details>
            </nav>
            )}
            {loggedIn && (
              <form action={studentLogout} className="dr-foot">
                <button className="btn-ghost w-full">로그아웃</button>
              </form>
            )}
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
