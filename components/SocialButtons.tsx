"use client";

import { useEffect, useState } from "react";
import { inAppBrowser, isAndroid, type Provider } from "@/lib/socialLogin";

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);
const KakaoIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
    <path fill="#000" d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.7 6.6l-1 3.5c-.1.3.3.6.5.4l4.2-2.8c.5.1 1.1.1 1.6.1 5.5 0 10-3.5 10-7.8S17.5 3 12 3z" />
  </svg>
);

// [카카오로 로그인] · [구글로 로그인]
// 카톡·인스타·네이버 앱 안의 브라우저에서는 구글이 로그인을 막아요 → 카톡은 밖의 브라우저로, 안드로이드는 크롬으로 열고, 아이폰은 사파리로 여는 법을 안내해요.
// link: 강의실에서 이미 로그인한 학생이 [연결하기]로 누를 때 (지금 신청을 그 계정에 바로 연결)
// admin: 관리자 로그인(login) · 관리자 계정 등록(add) 버튼
export default function SocialButtons({ providers, next, link = false, admin }: { providers: Provider[]; next: string; link?: boolean; admin?: "login" | "add" }) {
  const [ua, setUa] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setUa(navigator.userAgent);
    setOrigin(location.origin);
  }, []);
  if (providers.length === 0) return null;

  const path = (p: Provider) => admin ? `/api/auth/${p}?admin=${admin}` : `/api/auth/${p}?next=${encodeURIComponent(next)}${link ? "&link=1" : ""}`;
  const verb = admin === "add" ? " 계정 추가" : link ? " 계정 연결하기" : "로 로그인";
  const inApp = origin ? inAppBrowser(ua) : null;
  const iosOtherApp = inApp === "other" && !isAndroid(ua);
  const googleHref =
    inApp === "kakaotalk" ? `kakaotalk://web/openExternal?url=${encodeURIComponent(origin + path("google"))}`
    : inApp === "other" && isAndroid(ua) ? `intent://${origin.replace(/^https?:\/\//, "")}${path("google")}#Intent;scheme=https;package=com.android.chrome;end`
    : path("google");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2">
      {providers.includes("kakao") && (
        <a href={path("kakao")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-5 py-3.5 font-bold text-black/85 transition active:scale-[0.98]">
          <KakaoIcon />
          카카오{verb}
        </a>
      )}
      {providers.includes("google") && (iosOtherApp ? (
        <div className="space-y-2 rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 text-left text-sm text-slate-600">
          <p className="flex items-center gap-2 font-bold text-slate-700"><GoogleIcon /> 구글 로그인은 사파리에서 돼요</p>
          <p>이 앱 안에서는 구글 로그인이 막혀 있어요. 오른쪽 위 ⋯ 메뉴에서 <b>&apos;Safari로 열기&apos;</b>를 누르거나, 주소를 복사해 사파리에 붙여 넣어 주세요.</p>
          <button type="button" onClick={copy} className="btn-ghost !py-2 w-full text-sm">{copied ? "복사했어요 ✓" : "주소 복사하기"}</button>
        </div>
      ) : (
        <a href={googleHref} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 transition active:scale-[0.98]">
          <GoogleIcon />
          구글{verb}
        </a>
      ))}
      {providers.includes("google") && inApp === "kakaotalk" && <p className="text-xs text-slate-500">카톡 안에서는 구글 로그인이 안 돼서, 구글은 다른 브라우저로 열려요.</p>}
    </div>
  );
}
