import { YBM_BANK, YBM_ORDER_AMOUNT, won } from "@/lib/config";
import OrderForm from "./OrderForm";

export const metadata = { title: "YBM 인강 교재 주문 · vella_toeic", description: "YBM 토익 단기공략 650+ 강의 벨라토익 '개념 zip' 교재 주문" };

// YBM 공식 사이트·카톡 채널 링크로 들어오는 인강생 교재 주문 (첫 화면 메뉴에는 없어요)
export default function YbmOrderPage() {
  return (
    <div className="space-y-5 pt-8">
      <div className="text-center">
        <span className="rounded-full bg-sky-main px-4 py-1.5 text-sm font-bold text-sky-ink">YBM 인강 수강생</span>
        <h1 className="font-jua mt-3 text-3xl text-sky-ink">개념 zip 교재 주문</h1>
      </div>
      <section className="card space-y-2 text-[15px] leading-relaxed text-slate-700">
        <p><b className="text-sky-ink">YBM 토익 단기공략 650+ 강의</b> 자체교재를 여기서 주문할 수 있어요.</p>
        <p>벨라토익 &apos;개념 zip&apos; 교재비 <b>1만원 + 배송비 4천원</b></p>
        <p className="rounded-2xl bg-sky-soft p-3 text-center font-bold text-sky-ink">{YBM_BANK}</p>
        <p>아래 주문서를 작성하고 이체해 주시면 순차적으로 배송됩니다.</p>
        <p className="text-sm text-slate-500">✔️ 택배로만 받을 수 있어요. 택배 접수 이후 수령까지 평일 기준 평균 2-3일 소요돼요.</p>
      </section>
      <OrderForm amountLabel={won(YBM_ORDER_AMOUNT)} bank={YBM_BANK} />
    </div>
  );
}
