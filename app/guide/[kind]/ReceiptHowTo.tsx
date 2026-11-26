// 'YBM 수강증 불러오는 방법' 안내 (교재 신청서 맨 위 수강증 올리기 칸 위)
// menu: 관리 [기본 설정]의 'YBM 수강증 메뉴 위치'(settings.receipt_menu). 비우면 일반 문장으로 안내해요.
// 카드 모양은 수강증 판독기(lib/receipt/config.ts)가 읽는 칸 그대로예요: 맨 위 현재시간 ~ 맨 아래 수강시간.
const CARD: [string, string][] = [
  ["수강생", "홍길동"],
  ["수강센터", "부산 서면센터"],
  ["강사", "벨라"],
  ["레벨", "650+"],
  ["강의실", "801호 · 불라방은 온라인 강의"],
  ["수강요일", "월화수목 (월16회)"],
  ["수강시간", "10:00~12:10"],
];

export default function ReceiptHowTo({ menu, open = true }: { menu?: string | null; open?: boolean }) {
  const where = menu?.trim();
  return (
    <details open={open} className="group rounded-2xl bg-sky-soft/70 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-sky-ink">
        YBM 수강증 불러오는 방법
        <span className="text-sm font-normal text-sky-deep group-open:hidden">펼치기</span>
        <span className="hidden text-sm font-normal text-slate-400 group-open:inline">접기</span>
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_13rem] sm:items-start">
        <ol className="space-y-2.5 text-[15px] leading-relaxed text-slate-700">
          <li className="flex gap-2.5"><b className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-deep text-xs text-white">1</b><span>휴대폰에서 <b>YBM어학원 앱</b> 또는 <b>홈페이지</b>(ybmedu.com)에 학원 수강 등록할 때 쓴 아이디로 로그인해요.</span></li>
          <li className="flex gap-2.5"><b className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-deep text-xs text-white">2</b><span>{where ? <><b>{where}</b>에서</> : "내 수강 정보에서"} 이번 달 <b>벨라토익 강좌의 수강증(파란 카드)</b>을 열어요.</span></li>
          <li className="flex gap-2.5"><b className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-deep text-xs text-white">3</b><span>맨 위 <b>현재시간</b>부터 맨 아래 <b>수강시간</b>까지 한 화면에 다 보이게 <b>캡처</b>해요.</span></li>
          <li className="flex gap-2.5"><b className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-deep text-xs text-white">4</b><span>아래 <b>[수강증 사진 고르기]</b>로 캡처를 올리면 반·과정·시간·수강 월이 자동으로 채워져요.</span></li>
        </ol>
        <figure className="mx-auto w-full max-w-[13rem]" aria-label="수강증 화면 예시">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#3a9bd5] to-[#2b8fc7] p-3 text-white shadow-md">
            <p className="flex items-center justify-between text-[11px] opacity-90"><span className="rounded bg-amber-300 px-1 font-bold text-amber-900">여기부터</span>현재시간 12-01 09:58:12</p>
            <p className="mt-1.5 inline-block rounded-full bg-white/25 px-2 text-[11px] font-bold">12월 과정</p>
            <p className="mt-1 text-sm font-bold">벨라토익 [종합반]</p>
            <dl className="mt-2 space-y-0.5 rounded-xl bg-white p-2 text-[11px] text-slate-700">
              {CARD.map(([k, v]) => (
                <div key={k} className="flex gap-1.5"><dt className="w-12 shrink-0 text-slate-400">{k}</dt><dd className="min-w-0 truncate">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-1.5 text-right text-[11px]"><span className="rounded bg-amber-300 px-1 font-bold text-amber-900">여기까지</span></p>
          </div>
          <figcaption className="mt-1 text-center text-[11px] text-slate-400">예시 화면 (이름·값은 사람마다 달라요)</figcaption>
        </figure>
      </div>
      <ul className="mt-3 space-y-1 border-t border-sky-main/40 pt-3 text-xs leading-relaxed text-slate-500">
        <li>· 오늘 새로 캡처한 화면을 올려 주세요. 사진을 자르거나 꾸미면 자동 확인이 안 될 수 있어요.</li>
        <li>· 다른 사람의 수강증은 올릴 수 없어요. 같은 캡처가 다른 이름으로 들어오면 선생님이 확인해요.</li>
        <li>· 수강증이 안 보이면 학원 수강 등록이 아직 끝나지 않았을 수 있어요. YBM 서면센터 데스크(051-809-0509)에 물어봐 주세요.</li>
      </ul>
    </details>
  );
}
