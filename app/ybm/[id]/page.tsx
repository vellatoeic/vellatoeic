import { notFound } from "next/navigation";
import { getYbmOrder } from "@/lib/db";
import { YBM_BANK, won } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "교재 주문 · vella_toeic", robots: { index: false } };

// 주문 후 보는 화면. 입금이 확인되면 카톡에서 보내던 감사 인사가 보여요.
export default async function YbmOrderDone({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ again?: string }> }) {
  const { id } = await params;
  const { again } = await searchParams;
  const o = await getYbmOrder(id);
  if (!o) notFound();
  const note = "✔️ 택배 접수 이후 수령까지 평일 기준 평균 2-3일 소요되니 참고해주세요";

  return (
    <div className="space-y-5 pt-8">
      {again && <p className="card !bg-sky-soft text-center font-bold text-sky-ink">이미 접수된 주문이 있어요. 다시 주문하지 않아도 돼요.</p>}
      {o.status === "pending" ? (
        <section className="card space-y-3 text-center">
          <p className="font-jua text-3xl text-sky-ink">주문이 접수됐어요 🧸</p>
          <div className="rounded-3xl border-2 border-red-300 bg-red-50 p-4">
            <p className="font-jua text-lg text-red-600">⚠️ 아직 입금 전이에요</p>
            <p className="text-sm text-slate-700">아래 계좌로 입금해 주시면 순차적으로 배송됩니다.</p>
          </div>
          <p className="font-jua text-4xl text-sky-ink">{won(o.amount)}</p>
          <p className="rounded-2xl bg-sky-soft p-4 text-lg font-bold text-sky-ink">{YBM_BANK}</p>
          <p className="text-sm text-slate-600">입금자명: <b>{o.depositor}</b></p>
          <p className="text-xs text-slate-400">입금이 확인되면 이 화면이 바뀌어요. 이 페이지를 즐겨찾기 해 두면 다시 볼 수 있어요.</p>
        </section>
      ) : (
        <section className="card space-y-3 text-center leading-relaxed">
          <p className="font-jua text-3xl text-sky-ink">{o.status === "shipped" ? "교재를 발송했어요 📦" : "입금 확인 완료! ☁️"}</p>
          <p className="text-slate-700">확인 감사합니다<br />교재 잘 준비해서 수령할 수 있도록 도와드리겠습니다:)</p>
          <p className="text-slate-700">좋은 하루 되세요☁️</p>
          <p className="rounded-2xl bg-sky-soft p-3 text-sm text-sky-ink">{note}</p>
        </section>
      )}
      <section className="card text-sm">
        <p className="font-jua text-lg text-sky-ink">주문 내용</p>
        <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-y-1.5">
          <dt className="text-slate-500">교재</dt><dd>벨라토익 &apos;개념 zip&apos; 1권 (택배)</dd>
          <dt className="text-slate-500">이름</dt><dd>{o.name}</dd>
          <dt className="text-slate-500">주소</dt><dd>{o.address}</dd>
        </dl>
      </section>
    </div>
  );
}
