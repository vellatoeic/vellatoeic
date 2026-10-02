// 첫 화면 배경과 같은 동글동글 구름
export default function Cloud({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 64" aria-hidden className={className}>
      <circle cx="36" cy="40" r="20" />
      <circle cx="60" cy="28" r="26" />
      <circle cx="88" cy="40" r="18" />
      <rect x="18" y="38" width="88" height="22" rx="11" />
    </svg>
  );
}
