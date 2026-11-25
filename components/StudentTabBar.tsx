"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 학생 화면 아래 메뉴 막대 (휴대폰). 컴퓨터에서는 숨겨요.
export default function StudentTabBar({ tests }: { tests: boolean }) {
  const path = usePathname();
  const items: [string, string, string][] = [
    ["/", "star", "홈"],
    ["/class", "laptop", "강의실"],
    ...(tests ? ([["/class/tests", "stopwatch", "테스트"]] as [string, string, string][]) : []),
    ["/special", "mic", "특강"],
    ["/notices", "megaphone", "공지"],
  ];
  return (
    <nav className="tabbar" aria-label="학생 메뉴">
      {items.map(([href, icon, label]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
          <img src={`/img/icons/${icon}.png`} alt="" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
