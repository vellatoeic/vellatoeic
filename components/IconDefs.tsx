// SVG 아이콘(components/Icon.tsx)이 함께 쓰는 그라데이션. 레이아웃에 한 번만 넣어요 (화면에는 안 보여요).
// 3D 아이콘처럼 '하늘색 유리 + 진주빛 흰색' 느낌: 위는 밝고 아래로 갈수록 진해져요.
export default function IconDefs() {
  const g = (id: string, from: string, to: string) => (
    <linearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  );
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {g("vt-sky", "#bfe8fc", "#4fb3e8")}
        {g("vt-sky2", "#6cc4ef", "#2b8fc7")}
        {g("vt-sun", "#ffe9a3", "#f5b23d")}
        {g("vt-moon", "#c9dafc", "#6f8fe0")}
        {g("vt-red", "#ff8a8e", "#e5484d")}
        {g("vt-amber", "#ffd27a", "#f0a83a")}
        {g("vt-green", "#8fe0b6", "#1f9d6b")}
        {g("vt-pink", "#ffc2d4", "#f07ca0")}
      </defs>
    </svg>
  );
}
