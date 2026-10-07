"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 화면이 열려 있는 동안 5초마다 새 제출 결과를 불러와요.
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
