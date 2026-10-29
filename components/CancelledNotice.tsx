// 취소된 신청·주문 화면: 이유 + [다시 신청하기] + 이미 입금했다면 카톡 채널로
export default function CancelledNotice({ reason, retryHref, retryLabel = "다시 신청하기", kakao }: { reason: "timeout" | "admin" | null | undefined; retryHref: string; retryLabel?: string; kakao: string }) {
  return (
    <div className="pt-10">
      <div className="card mx-auto max-w-md space-y-4 text-center">
        <p className="font-jua text-4xl text-slate-600">신청이 취소됐어요</p>
        <p className="rounded-2xl bg-slate-100 p-3 text-[15px] text-slate-700">
          {reason === "admin" ? "관리자가 취소한 신청이에요." : "30분 안에 입금이 확인되지 않아 자동으로 취소됐어요."}
        </p>
        <a href={retryHref} className="btn block w-full">{retryLabel}</a>
        <div className="space-y-2 rounded-2xl bg-sky-soft p-3 text-sm text-slate-700">
          <p>이미 입금했다면 카톡 채널로 <b>이름과 입금 내역</b>을 알려 주세요.</p>
          {kakao && <a href={kakao} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-[#fee500] px-4 py-2 font-bold text-[#3c1e1e]">카톡 채널 열기 ↗</a>}
        </div>
      </div>
    </div>
  );
}
