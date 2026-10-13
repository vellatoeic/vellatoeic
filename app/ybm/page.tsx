import Link from "next/link";
import { YBM_ORDER_AMOUNT, won } from "@/lib/config";
import OrderForm from "./OrderForm";

export const metadata = { title: "YBM 인강 교재 신청 · vella_toeic", description: "YBM 토익 단기공략 650+ 강의 벨라토익 '개념 zip' 교재 신청" };

// YBM 공식 사이트·카톡 채널 링크로 들어오는 인강생 교재 신청 (첫 화면 메뉴에는 없어요)
export default function YbmOrderPage() {
  return (
    <div className="space-y-3 pt-6">
      <p className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-800">
        💻 <b>YBM 인강 수강생 전용</b> 교재 신청이에요.<br />
        학원 현장·불라방 수강생은 <Link href="/" className="font-bold text-amber-700 underline">여기</Link>에서 신청해 주세요.
      </p>
      <div className="py-3 text-center">
        <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-sky-deep">YBM 인강 × vella_toeic</span>
        <h1 className="font-jua mt-3 text-3xl text-sky-ink">인강 교재 신청</h1>
        <p className="mt-1 text-sm text-slate-500">YBM 토익 단기공략 650+ 강의 자체교재를 신청할 수 있어요</p>
      </div>
      <OrderForm amountLabel={won(YBM_ORDER_AMOUNT)} />
    </div>
  );
}
