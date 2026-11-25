// 사이트 아이콘 (기본 이모티콘 대신). 2026-11 새 디자인.
// ① 3D 아이콘 27개(public/img/icons, 하늘색 유리 + 진주빛 흰색) ② 그 안에 없는 모양은 같은 느낌의 SVG.
// SVG 색은 components/IconDefs.tsx의 그라데이션(한 페이지에 한 번)을 써요.
// 사용: <Icon name="sun" /> · <Icon name="star" size={28} /> · 글자 옆에 쓰면 글자 높이에 맞춰 살짝 내려와요.

export const PNG_ICONS = [
  "bell", "book", "calendar", "chart", "clipboard", "coins", "feedback", "headphones", "homework", "hourglass",
  "laptop", "laurel", "live", "lock", "megaphone", "mic", "parcel", "people", "qr", "reading", "replay",
  "school", "settings", "star", "stopwatch", "target", "trophy",
] as const;
type PngName = (typeof PNG_ICONS)[number];

const HL = <ellipse cx="17" cy="14" rx="7" ry="3.2" fill="#fff" opacity=".55" transform="rotate(-25 17 14)" />;

// 48×48 SVG 모양 (그라데이션: vt-sky · vt-sky2 · vt-sun · vt-moon · vt-red · vt-amber · vt-green · vt-pink)
const SVG: Record<string, React.ReactNode> = {
  sun: (
    <g>
      <g stroke="url(#vt-sun)" strokeWidth="4" strokeLinecap="round">
        <path d="M24 4v5M24 39v5M4 24h5M39 24h5M9.9 9.9l3.5 3.5M34.6 34.6l3.5 3.5M9.9 38.1l3.5-3.5M34.6 13.4l3.5-3.5" />
      </g>
      <circle cx="24" cy="24" r="10.5" fill="url(#vt-sun)" />
      <ellipse cx="20.5" cy="19.5" rx="4.5" ry="2.4" fill="#fff" opacity=".6" transform="rotate(-30 20.5 19.5)" />
    </g>
  ),
  moon: (
    <g>
      <path d="M30.5 6.5A18 18 0 1 0 41.5 33 15 15 0 0 1 30.5 6.5Z" fill="url(#vt-moon)" />
      <ellipse cx="15" cy="18" rx="5" ry="2.4" fill="#fff" opacity=".5" transform="rotate(-40 15 18)" />
      <circle cx="36" cy="12" r="1.8" fill="#ffd66b" /><circle cx="41" cy="20" r="1.2" fill="#ffd66b" />
    </g>
  ),
  livedot: (
    <g>
      <circle cx="24" cy="24" r="20" fill="#ffe3e4" />
      <circle cx="24" cy="24" r="11" fill="url(#vt-red)" />
      <ellipse cx="20.5" cy="20" rx="4" ry="2" fill="#fff" opacity=".6" transform="rotate(-30 20.5 20)" />
    </g>
  ),
  check: (
    <g>
      <circle cx="24" cy="24" r="20" fill="url(#vt-green)" />
      {HL}
      <path d="m15 24.5 6.5 6.5L34 17.5" fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  alert: (
    <g>
      <path d="M21 7.6a3.5 3.5 0 0 1 6 0l16.6 29a3.5 3.5 0 0 1-3 5.2H7.4a3.5 3.5 0 0 1-3-5.2Z" fill="url(#vt-amber)" />
      <path d="M24 17v11" stroke="#fff" strokeWidth="4.4" strokeLinecap="round" /><circle cx="24" cy="34.5" r="2.6" fill="#fff" />
    </g>
  ),
  siren: (
    <g>
      <path d="M21 7.6a3.5 3.5 0 0 1 6 0l16.6 29a3.5 3.5 0 0 1-3 5.2H7.4a3.5 3.5 0 0 1-3-5.2Z" fill="url(#vt-red)" />
      <path d="M24 17v11" stroke="#fff" strokeWidth="4.4" strokeLinecap="round" /><circle cx="24" cy="34.5" r="2.6" fill="#fff" />
    </g>
  ),
  cloud: (
    <g>
      <path d="M14 38a9 9 0 0 1-1.2-17.9A12 12 0 0 1 35.6 17 10.5 10.5 0 0 1 35 38Z" fill="url(#vt-sky)" />
      <ellipse cx="20" cy="20" rx="6" ry="2.8" fill="#fff" opacity=".65" transform="rotate(-20 20 20)" />
    </g>
  ),
  gift: (
    <g>
      <rect x="7" y="20" width="34" height="22" rx="5" fill="url(#vt-sky)" />
      <rect x="5" y="13" width="38" height="10" rx="4" fill="url(#vt-sky2)" />
      <path d="M24 13v29" stroke="#fff" strokeWidth="5" />
      <path d="M24 13c-3-6-11-7-11-2.5S21 13 24 13Zm0 0c3-6 11-7 11-2.5S27 13 24 13Z" fill="url(#vt-pink)" />
      <ellipse cx="13" cy="26" rx="3.5" ry="1.6" fill="#fff" opacity=".55" />
    </g>
  ),
  sparkle: (
    <g fill="url(#vt-sun)">
      <path d="M20 6c1.2 7.6 4.4 10.8 12 12-7.6 1.2-10.8 4.4-12 12-1.2-7.6-4.4-10.8-12-12 7.6-1.2 10.8-4.4 12-12Z" />
      <path d="M36 26c.7 4.4 2.6 6.3 7 7-4.4.7-6.3 2.6-7 7-.7-4.4-2.6-6.3-7-7 4.4-.7 6.3-2.6 7-7Z" fill="url(#vt-sky)" />
    </g>
  ),
  clock: (
    <g>
      <circle cx="24" cy="24" r="19" fill="url(#vt-sky)" />
      <circle cx="24" cy="24" r="14" fill="#fff" opacity=".92" />
      <path d="M24 15v9.5l6 4" fill="none" stroke="#2b8fc7" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  pin: (
    <g>
      <path d="M24 44s14-12.6 14-24a14 14 0 1 0-28 0c0 11.4 14 24 14 24Z" fill="url(#vt-sky)" />
      <circle cx="24" cy="20" r="5.5" fill="#fff" />
      <ellipse cx="17.5" cy="13" rx="4" ry="2" fill="#fff" opacity=".55" transform="rotate(-35 17.5 13)" />
    </g>
  ),
  repeat: (
    <g fill="none" stroke="url(#vt-sky2)" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 22a14 14 0 0 1 24-8.5L38 17M38 26a14 14 0 0 1-24 8.5L10 31" />
      <path d="M38 8v9h-9M10 40v-9h9" />
    </g>
  ),
  chat: (
    <g>
      <path d="M24 7C13.5 7 6 13.3 6 21c0 4.8 3 9 7.6 11.5L12 41l8.4-5.6c1.2.2 2.4.3 3.6.3 10.5 0 18-6.3 18-14.4S34.5 7 24 7Z" fill="url(#vt-sky)" />
      <circle cx="16.5" cy="21.5" r="2.4" fill="#fff" /><circle cx="24" cy="21.5" r="2.4" fill="#fff" /><circle cx="31.5" cy="21.5" r="2.4" fill="#fff" />
    </g>
  ),
  search: (
    <g>
      <circle cx="21" cy="21" r="13" fill="url(#vt-sky)" />
      <circle cx="21" cy="21" r="8.5" fill="#fff" opacity=".9" />
      <path d="m31 31 9 9" stroke="url(#vt-sky2)" strokeWidth="6" strokeLinecap="round" />
    </g>
  ),
  play: (
    <g>
      <circle cx="24" cy="24" r="20" fill="url(#vt-sky)" />
      {HL}
      <path d="M19.5 15.5v17l14-8.5Z" fill="#fff" />
    </g>
  ),
  link: (
    <g fill="none" stroke="url(#vt-sky2)" strokeWidth="4.6" strokeLinecap="round">
      <path d="M21 27a8 8 0 0 0 11.3 0l6-6a8 8 0 0 0-11.3-11.3L24.5 12" />
      <path d="M27 21a8 8 0 0 0-11.3 0l-6 6A8 8 0 0 0 21 38.3l2.5-2.3" />
    </g>
  ),
  dot: <circle cx="24" cy="24" r="12" fill="url(#vt-amber)" />,
  edit: (
    <g>
      <path d="M31.5 7.5a4.5 4.5 0 0 1 6.4 0l2.6 2.6a4.5 4.5 0 0 1 0 6.4L18 39 7 41l2-11Z" fill="url(#vt-sky)" />
      <path d="m27 12 9 9" stroke="#fff" strokeWidth="3" />
    </g>
  ),
  trash: (
    <g>
      <rect x="11" y="14" width="26" height="29" rx="5" fill="url(#vt-sky)" />
      <rect x="7" y="9" width="34" height="7" rx="3.5" fill="url(#vt-sky2)" />
      <path d="M19 21v15M29 21v15" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    </g>
  ),
  camera: (
    <g>
      <rect x="5" y="13" width="38" height="28" rx="7" fill="url(#vt-sky)" />
      <path d="M16 13l3-5h10l3 5" fill="url(#vt-sky2)" />
      <circle cx="24" cy="27" r="8.5" fill="#fff" /><circle cx="24" cy="27" r="4.5" fill="url(#vt-sky2)" />
    </g>
  ),
  phone: (
    <g>
      <rect x="12" y="4" width="24" height="40" rx="6" fill="url(#vt-sky)" />
      <rect x="15.5" y="9" width="17" height="27" rx="2.5" fill="#fff" opacity=".9" />
      <circle cx="24" cy="40" r="1.8" fill="#fff" />
    </g>
  ),
  mail: (
    <g>
      <rect x="5" y="10" width="38" height="28" rx="6" fill="url(#vt-sky)" />
      <path d="m8 14 16 12 16-12" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  plus: (
    <g>
      <circle cx="24" cy="24" r="20" fill="url(#vt-sky)" />
      <path d="M24 15v18M15 24h18" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" />
    </g>
  ),
  refresh: (
    <g fill="none" stroke="url(#vt-sky2)" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M39 24a15 15 0 1 1-4.4-10.6" /><path d="M37 6v8.5h-8.5" />
    </g>
  ),
  heart: (
    <g>
      <path d="M24 41S6 30.5 6 18.5A9.5 9.5 0 0 1 24 13a9.5 9.5 0 0 1 18 5.5C42 30.5 24 41 24 41Z" fill="url(#vt-pink)" />
      <ellipse cx="15" cy="17" rx="3.5" ry="2" fill="#fff" opacity=".6" transform="rotate(-35 15 17)" />
    </g>
  ),
  help: (
    <g>
      <circle cx="24" cy="24" r="20" fill="url(#vt-sky)" />
      <path d="M18.5 19a5.5 5.5 0 1 1 7.6 5.1c-1.4.6-2.1 1.6-2.1 3.1v1" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="24" cy="34.5" r="2.5" fill="#fff" />
    </g>
  ),
  doc: (
    <g>
      <path d="M11 4h18l10 10v26a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill="url(#vt-sky)" />
      <path d="M29 4v10h10" fill="url(#vt-sky2)" />
      <path d="M14 24h18M14 31h18M14 38h11" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  arrowRight: <path d="M10 24h26M27 14l10 10-10 10" fill="none" stroke="url(#vt-sky2)" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />,
  chevronRight: <path d="m19 12 12 12-12 12" fill="none" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />,
  chevronLeft: <path d="M29 12 17 24l12 12" fill="none" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />,
  close: <path d="M13 13l22 22M35 13 13 35" fill="none" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" />,
  external: <path d="M18 12h18v18M35 13 13 35" fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />,
  card: (
    <g>
      <rect x="4" y="10" width="40" height="28" rx="6" fill="url(#vt-sky)" />
      <rect x="4" y="16" width="40" height="6" fill="url(#vt-sky2)" />
      <rect x="10" y="28" width="12" height="4" rx="2" fill="#fff" />
    </g>
  ),
  new: (
    <g>
      <circle cx="24" cy="24" r="20" fill="url(#vt-red)" />
      <path d="M24 13v14" stroke="#fff" strokeWidth="4.4" strokeLinecap="round" /><circle cx="24" cy="34" r="2.6" fill="#fff" />
    </g>
  ),
  wave: (
    <g>
      <path d="M17 41c-6-2-9-8-9-13V17a3 3 0 0 1 6 0v6-11a3 3 0 0 1 6 0v9-12a3 3 0 0 1 6 0v12-9a3 3 0 0 1 6 0v16l2.5-4a3.2 3.2 0 0 1 5.4 3.4L34 38c-2 3-6 5-11 4Z" fill="url(#vt-sun)" />
    </g>
  ),
};

export type IconName = PngName | keyof typeof SVG;

// 이 이름의 아이콘이 있는지 (공지 섹션 아이콘처럼 저장된 값이 이름인지 이모티콘인지 가릴 때)
export const hasIcon = (name: string) => (PNG_ICONS as readonly string[]).includes(name) || name in SVG;

export default function Icon({ name, size = 20, className = "", title }: { name: IconName | string; size?: number | string; className?: string; title?: string }) {
  const style = { width: size, height: size };
  const cls = `vt-icon ${className}`.trim();
  if ((PNG_ICONS as readonly string[]).includes(name)) {
    return <img src={`/img/icons/${name}.png`} alt={title ?? ""} className={cls} style={style} loading="lazy" decoding="async" />;
  }
  const shape = SVG[name];
  if (!shape) return null;
  return (
    <svg viewBox="0 0 48 48" className={cls} style={style} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {shape}
    </svg>
  );
}
