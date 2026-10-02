import Link from "next/link";
import { logout } from "@/app/actions";

export default function AdminTabs({ active }: { active: "apps" | "roster" | "lectures" }) {
  const tab = (on: boolean) =>
    `rounded-full px-4 py-2 font-bold ${on ? "bg-sky-deep text-white" : "bg-white text-sky-ink"}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-jua mr-2 text-3xl text-sky-ink">관리</h1>
        <Link href="/admin" className={tab(active === "apps")}>신청 관리</Link>
        <Link href="/admin/roster" className={tab(active === "roster")}>현장 명단</Link>
        <Link href="/admin/lectures" className={tab(active === "lectures")}>강의 관리</Link>
      </div>
      <form action={logout}>
        <button className="text-sm text-slate-500 underline">로그아웃</button>
      </form>
    </div>
  );
}
