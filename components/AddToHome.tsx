import Icon from "./Icon";

// 휴대폰 홈 화면에 사이트를 앱처럼 추가하는 방법 (접이식)
export default function AddToHome() {
  return (
    <details className="rounded-[20px] border border-sky-deep/10 bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_6px_22px_rgba(18,64,92,0.07)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-jua text-base text-sky-ink"><Icon name="phone" size={24} />홈 화면에 추가하기 <span className="font-body text-sm font-normal text-slate-500">(다음부터 한 번에 들어와요)</span></summary>
      <div className="mt-2 space-y-1.5">
        <p><b className="text-sky-ink">아이폰</b> · Safari 아래쪽 공유 버튼(□↑) → &apos;홈 화면에 추가&apos;</p>
        <p><b className="text-sky-ink">갤럭시</b> · 인터넷/크롬 오른쪽 위 ⋮ → &apos;홈 화면에 추가&apos;</p>
      </div>
    </details>
  );
}
