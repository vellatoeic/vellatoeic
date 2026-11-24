import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CLASSROOM } from "@/lib/config";

// 카카오톡·검색 미리보기 이미지 (하늘색 브랜드 카드). 빌드할 때 한 번 만들어요.
export const alt = "부산 서면 토익 벨라토익 vella_toeic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (file: string) => readFile(join(process.cwd(), "node_modules/@fontsource/jua/files", file));

function Cloud({ w, color, style }: { w: number; color: string; style: React.CSSProperties }) {
  return (
    <svg width={w} height={(w * 64) / 120} viewBox="0 0 120 64" style={{ position: "absolute", ...style }}>
      <circle cx="36" cy="40" r="20" fill={color} />
      <circle cx="60" cy="28" r="26" fill={color} />
      <circle cx="88" cy="40" r="18" fill={color} />
      <rect x="18" y="38" width="88" height="22" rx="11" fill={color} />
    </svg>
  );
}

export default async function Image() {
  const [korean, latin] = await Promise.all([font("jua-korean-400-normal.woff"), font("jua-latin-400-normal.woff")]);
  const chip = { display: "flex", padding: "12px 28px", borderRadius: 999, background: "#eaf6fd", color: "#12405c", fontSize: 34 };
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #cdeefe 0%, #9fd8f5 100%)", fontFamily: "Jua", position: "relative" }}>
        <Cloud w={260} color="#ffffff" style={{ left: 40, top: 40, opacity: 0.9 }} />
        <Cloud w={200} color="#ffffff" style={{ right: 60, top: 70, opacity: 0.85 }} />
        <Cloud w={240} color="#e3f4fd" style={{ right: 30, bottom: 30 }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 940, padding: "56px 40px", borderRadius: 48, background: "#ffffff", boxShadow: "0 10px 0 #7cc4ea" }}>
          <div style={{ display: "flex", fontSize: 34, color: "#5b88a6" }}>토익의 시작</div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 104, color: "#12405c", marginTop: 4 }}>
            vella_toeic
            <svg width={110} height={59} viewBox="0 0 120 64" style={{ marginLeft: 18 }}>
              <circle cx="36" cy="40" r="20" fill="#9fd8f5" />
              <circle cx="60" cy="28" r="26" fill="#9fd8f5" />
              <circle cx="88" cy="40" r="18" fill="#9fd8f5" />
              <rect x="18" y="38" width="88" height="22" rx="11" fill="#9fd8f5" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 50, color: "#2b8fc7", marginTop: 14 }}>부산 서면 YBM 토익 · 벨라토익</div>
          <div style={{ display: "flex", gap: 16, marginTop: 34 }}>
            <div style={chip}>시작반 650</div>
            <div style={chip}>문풀반 750</div>
            <div style={chip}>속성반</div>
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#5b88a6", marginTop: 26 }}>{`현장 ${CLASSROOM} · 온라인 라이브(불라방)`}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jua", data: latin, style: "normal", weight: 400 },
        { name: "Jua", data: korean, style: "normal", weight: 400 },
      ],
    },
  );
}
