"use client";

import { useEffect, useState } from "react";

// 관리자 계정을 추가하고 돌아오면(?al=added) 로그인 설정 상자를 열고 알려줘요
export default function AdminAddedNotice() {
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("al") !== "added") return;
    setAdded(true);
    document.getElementById("login-mode")?.setAttribute("open", "");
  }, []);
  return added ? <p className="font-bold text-emerald-700">관리자 계정을 추가했어요. 다음부터 관리 페이지에서 그 계정 버튼으로 들어와요.</p> : null;
}
