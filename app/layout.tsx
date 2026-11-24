import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Cloud from "@/components/Cloud";
import "@fontsource/jua";
import "@fontsource/gowun-dodum";
import "./globals.css";
import { INSTAGRAM_URL, SITE_URL } from "@/lib/config";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/seo";
import Bell from "@/components/notices/Bell";
import { safeNoticeSummary } from "@/lib/noticeView";

// 검색 확인 태그: Vercel 환경변수에 코드를 넣으면 켜져요 (비우면 태그 없음)
const naverVerification = process.env.NAVER_SITE_VERIFICATION?.trim();
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["부산 서면 토익", "서면 토익", "YBM 서면", "벨라토익", "vella_toeic", "토익 650", "토익 750", "토익 인강 라이브", "부산 토익 학원"],
  alternates: { canonical: "/" },
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, url: "/", siteName: SITE_NAME, locale: "ko_KR", type: "website" },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  verification: {
    ...(googleVerification ? { google: googleVerification } : {}),
    ...(naverVerification ? { other: { "naver-site-verification": naverVerification } } : {}),
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#9fd8f5" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const notice = await safeNoticeSummary(); // 공지 계산이 실패해도 페이지는 떠요
  return (
    <html lang="ko">
      <body className="min-h-dvh">
        <header className="print:hidden sticky top-0 z-10 border-b border-sky-main/40 bg-sky-soft/90 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-8">
            <Link href="/" className="font-jua leading-tight text-sky-ink">
              <span className="block text-xs text-sky-ink/60">토익의 시작</span>
              <span className="flex items-center gap-1.5 text-2xl">
                vella_toeic
                <Cloud className="cloud-a h-6 w-auto fill-sky-main drop-shadow-[0_1px_0_rgba(43,143,199,0.25)]" />
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Bell count={notice.unread} visitorKeys={notice.visitorKeys} />
              <Link href="/class" className="rounded-full bg-sky-main px-3 py-2 text-sm font-bold text-sky-ink">
                강의실
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-16">{children}</main>
        <footer className="print:hidden mx-auto max-w-3xl px-4 pb-10 text-center text-sm text-sky-ink/60">
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="underline">
            @vella_toeic
          </a>
          <span className="mx-2">·</span>부산 서면
        </footer>
      </body>
    </html>
  );
}
