// 휴대폰 홈 화면에 사이트를 앱처럼 추가하는 방법 (접이식)
export default function AddToHome() {
  return (
    <details className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_2px_0_#d5ecf9]">
      <summary className="font-jua cursor-pointer text-base text-sky-ink">📱 홈 화면에 추가하기 (다음부터 한 번에 들어와요)</summary>
      <div className="mt-2 space-y-1.5">
        <p><b className="text-sky-ink">아이폰</b> · Safari 아래쪽 공유 버튼(□↑) → &apos;홈 화면에 추가&apos;</p>
        <p><b className="text-sky-ink">갤럭시</b> · 인터넷/크롬 오른쪽 위 ⋮ → &apos;홈 화면에 추가&apos;</p>
      </div>
    </details>
  );
}
