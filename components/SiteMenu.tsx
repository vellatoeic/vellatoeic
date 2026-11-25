"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// 머리 오른쪽 ☰ 메뉴 서랍. 첫 화면 구역 + 수강생 메뉴 + YBM 수강 신청.
const SITE: [string, string, string][] = [
  ["/#teacher", "laurel", "벨라쌤 소개"],
  ["/#project", "hourglass", "한 달 최단 프로젝트"],
  ["/#finder", "target", "나에게 맞는 반 찾기"],
  ["/#proof", "trophy", "성적 인증 · 후기"],
  ["/#courses", "calendar", "강좌 시간표"],
  ["/about", "school", "벨라토익 소개 · 수강 신청 방법"],
];
const STUDENT: [string, string, string][] = [
  ["/guide/onsite", "school", "현장 수강생 · 교재비 신청"],
  ["/guide/online", "laptop", "불라방 수강생 · 교재비 신청"],
  ["/class", "star", "강의실"],
  ["/mission", "clipboard", "첫 수업 미션"],
  ["/special", "mic", "특강"],
  ["/notices", "megaphone", "공지"],
  ["/faq", "book", "자주 묻는 질문"],
];
const YBM_URL = "https://www.ybmedu.com/seomyon/vellatoeic";

export default function SiteMenu() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
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
      {open && (
        <div className="drawer-bg" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="메뉴">
            <div className="dr-head">
              <span className="wordmark">VELLA <i>TOEIC</i></span>
              <button type="button" className="icon-btn" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <nav className="dr-body">
              <p className="dr-label">수강생</p>
              {STUDENT.map(item)}
              <p className="dr-label">벨라토익</p>
              {SITE.map(item)}
              <a className="dr-item" href={YBM_URL} target="_blank" rel="noopener noreferrer">
                <img src="/img/icons/calendar.png" alt="" />
                YBM에서 수강 신청 ↗
              </a>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
