import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import SiteMenu from "@/components/SiteMenu";
import IconDefs from "@/components/IconDefs";
import ModeSwitch from "@/components/ModeSwitch";
import { getAccountId, getStudentIds, getViewing, isAdmin } from "@/lib/auth";
import { stopViewing } from "@/app/actions";
import { safe } from "@/lib/safe";
import { ensureDemo } from "@/lib/demoSeed";
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
  await safe("demo", () => ensureDemo(), undefined); // DB 없는 미리보기 + VELLA_DEMO=1 일 때만 예시 학생 (운영 DB에서는 아무것도 안 해요)
  const notice = await safeNoticeSummary(); // 공지 계산이 실패해도 페이지는 떠요
  // 강사로 로그인했으면 [학생 | 강사] 전환 버튼, 학생 화면 미리보기 중이면 위에 띠
  const [admin, viewing, loggedIn] = await Promise.all([
    safe("layout.isAdmin", () => isAdmin(), false),
    safe("layout.viewing", () => getViewing(), null),
    safe("layout.loggedIn", async () => (await getStudentIds()).length > 0 || !!(await getAccountId()), false),
  ]);
  return (
    <html lang="ko">
      <body className="min-h-dvh">
        <IconDefs />
        <header className="site-hdr print:hidden">
          <nav className="site-hdr-in">
            <Link href="/" className="wordmark" aria-label="벨라토익 첫 화면">VELLA <i>TOEIC</i></Link>
            <div className="site-hdr-nav" aria-label="첫 화면 바로가기">
              <Link href="/#finder">반 찾기</Link>
              <a href="https://www.ybmedu.com/seomyon/vellatoeic" target="_blank" rel="noopener noreferrer">수강 신청</a>
              <Link href="/guide">교재 신청</Link>
              <Link href="/#courses">강좌</Link>
              <Link href="/#proof">성적·후기</Link>
              <Link href="/faq">FAQ</Link>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Bell count={notice.unread} visitorKeys={notice.visitorKeys} />
              {admin ? <ModeSwitch viewing={!!viewing} /> : loggedIn ? <Link href="/class" className="hdr-class">강의실</Link> : <Link href="/login" className="hdr-login">로그인</Link>}
              {/* 관리자만 로그인해도 메뉴에 [로그아웃]이 보여야 해요 (로그아웃은 관리자까지 모두 풀어요) */}
              <SiteMenu loggedIn={loggedIn || admin} admin={admin} />
            </div>
          </nav>
          {viewing && (
            <form action={stopViewing} className="view-strip">
              <input type="hidden" name="app_id" value={viewing.appId} />
              <span><b>{viewing.name}</b> 학생 화면 미리보기 중 · 보기만 돼요</span>
              <Link href="/admin/view-as?pick=1" className="underline underline-offset-2">다른 학생</Link>
              <button type="submit">끝내기</button>
            </form>
          )}
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
