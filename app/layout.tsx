import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/latin-700-italic.css";
import "@fontsource/great-vibes/latin-400.css";
import "./globals.css";
import SiteMenu from "@/components/SiteMenu";
import { INSTAGRAM_URL, SITE_URL } from "@/lib/config";
import { BRAND } from "@/lib/homeContent";
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
        <header className="site-hdr print:hidden">
          <nav className="site-hdr-in">
            <Link href="/" className="wordmark" aria-label="벨라토익 첫 화면">VELLA <i>TOEIC</i></Link>
            <div className="site-hdr-nav" aria-label="첫 화면 바로가기">
              <Link href="/#teacher">벨라쌤 소개</Link>
              <Link href="/#project">최단 프로젝트</Link>
              <Link href="/#finder">반 찾기</Link>
              <Link href="/#proof">성적 인증</Link>
              <Link href="/#courses">강좌</Link>
              <Link href="/faq">FAQ</Link>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Bell count={notice.unread} visitorKeys={notice.visitorKeys} />
              <Link href="/class" className="hdr-class">강의실</Link>
              <SiteMenu />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-16">{children}</main>
        <footer className="site-foot print:hidden">
          <p className="wordmark">VELLA <i>TOEIC</i></p>
          <p>{BRAND.center} · 벨라토익 · 문의 {BRAND.phone}</p>
          <p>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="underline">@vella_toeic</a>
            <span className="mx-2">·</span>
            <a href={BRAND.youtubeUrl} target="_blank" rel="noreferrer" className="underline">유튜브 벨라토익</a>
            <span className="mx-2">·</span>부산 서면
          </p>
        </footer>
      </body>
    </html>
  );
}
