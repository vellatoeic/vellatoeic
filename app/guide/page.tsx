import Icon from "@/components/Icon";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("교재 신청 | 부산 서면 토익 벨라토익", "부산 서면 토익 벨라토익 교재 신청. 현장 또는 온라인 라이브(불라방)를 골라 YBM 수강증으로 교재를 신청해요.", "/guide");

// 교재 신청: 현장 / 불라방 고르기 (머리 메뉴 '교재 신청'). 컴퓨터에서는 넓고 큰 두 칸.
export default function Guide() {
  return (
    <div className="stagger wide space-y-6 pt-8 lg:pt-14">
      <div className="text-center">
        <h1 className="font-jua text-4xl text-sky-ink lg:text-5xl">교재 신청</h1>
        <p className="mt-3 text-slate-600 lg:text-lg">학원 수강 등록을 마쳤다면, 수업 듣는 방법을 골라 주세요.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:mx-auto lg:max-w-4xl lg:gap-6">
        <Link href="/guide/onsite" className="card group block transition hover:-translate-y-1 lg:p-10">
          <Icon name="school" size={72} className="lg:!h-24 lg:!w-24" />
          <h2 className="font-jua mt-3 text-2xl text-sky-ink lg:text-3xl">현장 수강생</h2>
          <p className="mt-2 text-slate-600 lg:text-lg">서면 강의실에서 수업 들어요. 교재는 첫 수업 날 받아요.</p>
          <p className="mt-4 font-bold text-sky-deep group-hover:underline lg:mt-8">교재 신청하기 →</p>
        </Link>
        <Link href="/guide/online" className="card group block transition hover:-translate-y-1 lg:p-10">
          <Icon name="laptop" size={72} className="lg:!h-24 lg:!w-24" />
          <h2 className="font-jua mt-3 text-2xl text-sky-ink lg:text-3xl">불라방 수강생</h2>
          <p className="mt-2 text-slate-600 lg:text-lg">온라인 라이브로 수업 들어요. 교재는 1층 데스크 또는 택배로 받아요.</p>
          <p className="mt-4 font-bold text-sky-deep group-hover:underline lg:mt-8">교재 신청하기 →</p>
        </Link>
      </div>
    </div>
  );
}
