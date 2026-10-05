import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Cloud from "@/components/Cloud";
import "@fontsource/jua";
import "@fontsource/gowun-dodum";
import "./globals.css";
import { INSTAGRAM_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "vella_toeic",
  description: "부산 서면 토익, vella_toeic 수강 안내와 교재비 납부",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#9fd8f5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh">
        <header className="print:hidden sticky top-0 z-10 border-b border-sky-main/40 bg-sky-soft/90 backdrop-blur">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-jua leading-tight text-sky-ink">
              <span className="block text-xs text-sky-ink/60">토익의 시작</span>
              <span className="flex items-center gap-1.5 text-2xl">
                vella_toeic
                <Cloud className="cloud-a h-6 w-auto fill-sky-main drop-shadow-[0_1px_0_rgba(43,143,199,0.25)]" />
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/special" className="rounded-full bg-white px-3 py-2 text-sm font-bold text-sky-ink">
                특강 신청
              </Link>
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
