"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// 헤더 🔔: 안 읽은 공지 수. 방문자는 브라우저에서 안 본 '전체' 공지 수를 세요.
export default function Bell({ count, visitorIds }: { count: number; visitorIds: string[] }) {
  const [n, setN] = useState(count);
  useEffect(() => {
    if (visitorIds.length === 0) return;
    try { setN(visitorIds.filter((id) => !localStorage.getItem(`vella-notice-seen:${id}`)).length); } catch { /* 무시 */ }
  }, [visitorIds]);
  return (
    <Link href="/notices" aria-label={n ? `안 읽은 공지 ${n}개` : "공지"} className="relative grid h-[38px] w-[38px] place-items-center rounded-[14px] bg-white text-lg">
      🔔
      {n > 0 && <i className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#e5484d] px-1 font-jua text-[11px] not-italic text-white">{n}</i>}
    </Link>
  );
}
