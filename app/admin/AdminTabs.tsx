import Link from "next/link";
import { logout, markAppsSeen } from "@/app/actions";
import { adminAlerts } from "@/lib/adminAlerts";
import { expireUnpaid, purgeTimedOut } from "@/lib/cancellations";

export default async function AdminTabs({ active }: { active: "apps" | "roster" | "stamps" | "lectures" | "schedule" | "special" | "delivery" | "audio" | "faq" | "tests" | "notices" }) {
  // 관리 화면을 열 때마다: 30분 지난 입금 대기 자동 취소 + 자동 취소 7일 지난 것 삭제
  await expireUnpaid().catch(() => null);
  await purgeTimedOut().catch(() => null);
  const { fresh, waiting, checks, delivery, refunds } = await adminAlerts();
  const tab = (on: boolean) =>
    `relative rounded-full px-4 py-2 font-bold ${on ? "bg-sky-deep text-white" : "bg-white text-sky-ink"}`;
  const dot = (n: number) => n > 0 && (
    <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] text-white">{n}</span>
  );
  const appsTodo = fresh.length + waiting + checks;
  const chip = "rounded-full px-3 py-1.5 text-sm font-bold";
  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-jua mr-2 text-3xl text-sky-ink">관리</h1>
          <Link href="/admin" className={tab(active === "apps")}>신청 관리{dot(appsTodo)}</Link>
          <Link href="/admin/roster" className={tab(active === "roster")}>현장 명단</Link>
          <Link href="/admin/delivery" className={tab(active === "delivery")}>택배 발송{dot(delivery)}</Link>
          <Link href="/admin/tests" className={tab(active === "tests")}>오늘의 테스트</Link>
          <Link href="/admin/stamps" className={tab(active === "stamps")}>출석·숙제</Link>
          <Link href="/admin/schedule" className={tab(active === "schedule")}>수업일 설정</Link>
          <Link href="/admin/lectures" className={tab(active === "lectures")}>강의 관리</Link>
          <Link href="/admin/audio" className={tab(active === "audio")}>LC 음원</Link>
          <Link href="/admin/notices" className={tab(active === "notices")}>공지</Link>
          <Link href="/admin/faq" className={tab(active === "faq")}>FAQ</Link>
          <Link href="/admin/special" className={tab(active === "special")}>특강 관리{dot(refunds)}</Link>
        </div>
        <div className="flex items-center gap-3">
          <form action="/admin/students" className="flex items-center gap-1.5">
            <input name="q" placeholder="🔍 학생 이름·번호" autoComplete="off" className="input !w-40 !rounded-full !py-2 text-sm" />
            <button className="btn !rounded-full !py-2 !text-sm">찾기</button>
          </form>
          <form action={logout}>
            <button className="text-sm text-slate-500 underline">로그아웃</button>
          </form>
        </div>
      </div>

      {appsTodo + delivery > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-red-200 bg-white p-3 shadow-sm">
          <span className="font-jua px-1 text-lg text-red-500">🔔 할 일</span>
          {fresh.length > 0 && (
            <form action={markAppsSeen} className="flex flex-wrap items-center gap-1.5 rounded-full bg-sky-soft py-1 pl-3 pr-1">
              <Link href="/admin#recent" className="text-sm font-bold text-sky-ink">
                🆕 새 신청 {fresh.length}건
                <span className="ml-1 font-normal text-slate-500">{fresh.slice(0, 3).map((x) => `${x.name}(${x.type})`).join(", ")}{fresh.length > 3 ? " 외" : ""}</span>
              </Link>
              <button className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-sky-deep">확인했어요 ✓</button>
            </form>
          )}
          {waiting > 0 && <Link href="/admin" className={`${chip} bg-amber-50 text-amber-700`}>💰 입금 대기 {waiting}명</Link>}
          {checks > 0 && <Link href="/admin" className={`${chip} bg-red-50 text-red-600`}>⚠️ 입금 문자 확인 {checks}건</Link>}
          {delivery > 0 && <Link href="/admin/delivery" className={`${chip} bg-sky-deep text-white`}>📦 택배 발송 대기 {delivery}건</Link>}
        </div>
      )}
    </div>
  );
}
