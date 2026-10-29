import { notFound } from "next/navigation";
import { getSetting, getYbmOrder } from "@/lib/db";
import { depositDeadline, expireUnpaid, ruleFrom } from "@/lib/cancellations";
import DepositCountdown from "@/components/DepositCountdown";
import CancelledNotice from "@/components/CancelledNotice";
import { YBM_BANK, won } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "교재 신청 · vella_toeic", robots: { index: false } };

// 신청 후 보는 화면. 입금이 확인되면 카톡에서 보내던 감사 인사가 보여요.
export default async function YbmOrderDone({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ again?: string }> }) {
  const { id } = await params;
  const { again } = await searchParams;
  await expireUnpaid(); // 30분 지난 입금 대기는 먼저 자동 취소
  const o = await getYbmOrder(id);
  if (!o) notFound();
  if (o.status === "cancelled") {
    return <CancelledNotice reason={o.cancel_reason} retryHref="/ybm" kakao={await getSetting("kakao_channel_url")} />;
  }
  const deadline = depositDeadline(o, await ruleFrom());
  const step = o.status === "pending" ? 1 : o.status === "paid" ? 2 : 3;
  const STEPS = ["신청 완료", "납부 확인", "발송 완료"];

  return (
    <div className="space-y-3 pt-6">
      {again && <p className="card !bg-sky-soft text-center font-bold text-sky-ink">이미 접수된 신청이 있어요. 다시 신청하지 않아도 돼요.</p>}
      <div className="py-3 text-center">
        <h1 className="font-jua text-3xl text-sky-ink">{step === 1 ? "신청 완료!" : step === 2 ? "입금 확인 완료! ☁️" : "교재를 발송했어요 📦"}</h1>
        <p className="mt-1 text-sm text-slate-500">{step === 1 ? `${o.name}님, 아래 계좌로 입금해 주세요` : `${o.name}님, 확인 감사합니다`}</p>
      </div>
      <section className="card">
        <ol className="flex justify-between">
          {STEPS.map((label, i) => (
            <li key={label} className={`flex-1 text-center text-xs font-bold ${i < step ? "text-sky-ink" : "text-slate-300"}`}>
              <span className={`mx-auto mb-1.5 grid h-9 w-9 place-items-center rounded-full font-jua text-base ${i < step ? "bg-sky-deep text-white" : "bg-sky-soft text-slate-400"}`}>{i < step ? "✓" : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </section>
      {step === 1 ? (
        <section className="card space-y-2 text-center">
          <p className="font-jua text-4xl text-sky-ink">{won(o.amount)}</p>
          <p className="rounded-2xl bg-sky-soft p-3 font-bold text-sky-ink">{YBM_BANK}</p>
          <p className="text-xs text-slate-500">입금자명: <b>{o.depositor}</b> · 입금하면 보통 몇 분 안에 자동 확인돼요</p>
          {deadline && <DepositCountdown deadline={deadline} />}
        </section>
      ) : (
        <section className="card space-y-2 text-center leading-relaxed text-slate-700">
          <p>확인 감사합니다<br />교재 잘 준비해서 수령할 수 있도록 도와드리겠습니다:)<br />좋은 하루 되세요☁️</p>
          <p className="rounded-2xl bg-sky-soft p-3 text-sm text-sky-ink">✔️ 택배 접수 이후 수령까지 평일 기준 평균 2-3일 소요되니 참고해주세요</p>
        </section>
      )}
      <section className="card text-sm">
        <p className="font-jua text-lg text-sky-ink">📦 신청 내용</p>
        <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-y-1.5">
          <dt className="text-slate-500">교재</dt><dd>벨라토익 &apos;개념 zip&apos; 1권</dd>
          <dt className="text-slate-500">받는 곳</dt><dd>{o.address}</dd>
          <dt className="text-slate-500">금액</dt><dd className="font-bold">{won(o.amount)} (택배비 포함)</dd>
        </dl>
      </section>
      <p className="text-center text-xs text-slate-400">이 화면을 즐겨찾기 해 두면 입금·발송 상태를 다시 볼 수 있어요.</p>
    </div>
  );
}
