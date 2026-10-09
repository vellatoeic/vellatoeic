import Link from "next/link";
import { logout } from "@/app/actions";

export default function AdminTabs({ active }: { active: "apps" | "roster" | "stamps" | "lectures" | "schedule" | "special" | "delivery" | "audio" | "faq" | "tests" | "notices" }) {
  const tab = (on: boolean) =>
    `rounded-full px-4 py-2 font-bold ${on ? "bg-sky-deep text-white" : "bg-white text-sky-ink"}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-jua mr-2 text-3xl text-sky-ink">관리</h1>
        <Link href="/admin" className={tab(active === "apps")}>신청 관리</Link>
        <Link href="/admin/roster" className={tab(active === "roster")}>현장 명단</Link>
        <Link href="/admin/delivery" className={tab(active === "delivery")}>택배 발송</Link>
        <Link href="/admin/tests" className={tab(active === "tests")}>오늘의 테스트</Link>
        <Link href="/admin/stamps" className={tab(active === "stamps")}>출석·숙제</Link>
        <Link href="/admin/schedule" className={tab(active === "schedule")}>수업일 설정</Link>
        <Link href="/admin/lectures" className={tab(active === "lectures")}>강의 관리</Link>
        <Link href="/admin/audio" className={tab(active === "audio")}>LC 음원</Link>
        <Link href="/admin/notices" className={tab(active === "notices")}>공지</Link>
        <Link href="/admin/faq" className={tab(active === "faq")}>FAQ·질문함</Link>
        <Link href="/admin/special" className={tab(active === "special")}>특강 관리</Link>
      </div>
      <form action={logout}>
        <button className="text-sm text-slate-500 underline">로그아웃</button>
      </form>
    </div>
  );
}
