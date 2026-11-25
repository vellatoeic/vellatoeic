"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 강사(관리자)로 로그인했을 때만 보이는 [학생 | 강사] 전환 버튼 (머리의 메뉴 버튼 왼쪽)
// 학생: 학생이 보는 첫 화면(학생 화면 미리보기 중이면 그 학생 대시보드) / 강사: 관리 화면
export default function ModeSwitch() {
  const path = usePathname();
  const teacher = path.startsWith("/admin");
  return (
    <div className="mode-switch" role="group" aria-label="화면 전환">
      <Link href="/" aria-current={!teacher} className={teacher ? "" : "on"}>학생</Link>
      <Link href="/admin" aria-current={teacher} className={teacher ? "on" : ""}>강사</Link>
    </div>
  );
}
