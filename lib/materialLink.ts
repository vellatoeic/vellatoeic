// ── LC 음원·특강 자료 링크 (DB 없이 검사해요. 테스트: tests/material-link.test.ts) ──
// 파일은 구글 드라이브에 올리고, 사이트에는 '제목 + 공유 링크'만 저장해요. (Supabase 전송량을 쓰지 않아요)

// https 주소만 받아요. 앞뒤 공백·꺾쇠는 지우고, 잘못된 주소면 null.
export function cleanMaterialLink(raw: string): string | null {
  const v = raw.trim().replace(/^<|>$/g, "");
  if (!v || v.length > 2000) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

// 제목: 비어 있으면 null, 길면 200자에서 잘라요.
export function cleanMaterialTitle(raw: string): string | null {
  const v = raw.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, 200) : null;
}

// 구글 드라이브 링크인지 (아니어도 저장은 되지만 관리 화면에서 한 번 더 알려줘요)
export const isDriveLink = (url: string) => /^https:\/\/(drive|docs)\.google\.com\//.test(url);
