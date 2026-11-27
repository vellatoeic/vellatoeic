// 택배 주소 나누기: 우편번호 · 기본주소 · 상세주소 (택배 사이트 칸에 하나씩 붙여 넣기 좋게)
// 신청서 주소 형식: 주소 검색 = "[12345] 부산 부산진구 중앙대로 1 (건물), 101동 1001호" / 직접 입력 = "부산 ... 101동 1001호"
// SQL 41부터 상세주소는 address_detail에도 따로 저장해요. 예전 신청은 형식에서 나눠요. 자동 테스트: tests/address.test.ts
export type AddressParts = { zip: string; base: string; detail: string; full: string };

export function splitAddress(address: string | null | undefined, detail?: string | null): AddressParts {
  const full = (address ?? "").trim();
  const d = (detail ?? "").trim();
  let rest = full;
  let zip = "";
  const z = /^\[(\d{5})\]\s*/.exec(rest);
  if (z) {
    zip = z[1];
    rest = rest.slice(z[0].length);
  }
  if (d && rest.endsWith(d)) {
    return { zip, base: rest.slice(0, rest.length - d.length).replace(/[\s,]+$/, ""), detail: d, full };
  }
  // 예전 신청: 주소 검색 형식은 기본주소(괄호 안 쉼표는 건너뛰어요) 다음 첫 ', ' 뒤가 상세주소
  if (zip) {
    const m = /^([^,(]+(?:\([^)]*\))?)\s*,\s*(.+)$/.exec(rest);
    if (m) return { zip, base: m[1].trim(), detail: m[2].trim(), full };
  }
  return { zip, base: rest, detail: d, full };
}

// 엑셀·택배 사이트에 붙여 넣는 한 줄 (칸 사이는 탭)
export const addressCells = (a: AddressParts) => [a.zip, a.base, a.detail];

// ── 학원 전달용 지역 (시·도 + 시·군·구까지, 도로명·번지·상세주소는 빼요) ──
// 예: "[49300] 부산광역시 사하구 낙동대로 1, 301호" → "부산 사하구", "경남 창원시 성산구 …" → "경남 창원시 성산구"
const SIDO: Record<string, string> = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천", 광주광역시: "광주", 대전광역시: "대전", 울산광역시: "울산",
  세종특별자치시: "세종", 경기도: "경기", 강원도: "강원", 강원특별자치도: "강원", 충청북도: "충북", 충청남도: "충남",
  전라북도: "전북", 전북특별자치도: "전북", 전라남도: "전남", 경상북도: "경북", 경상남도: "경남", 제주특별자치도: "제주",
};
export function regionOf(address: string | null | undefined): string {
  const { base } = splitAddress(address);
  const words = base.replace(/[(),]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const out = [SIDO[words[0]] ?? words[0]];
  const city = words[1];
  if (city && /(시|군|구)$/.test(city)) {
    out.push(city);
    if (/시$/.test(city) && words[2] && /구$/.test(words[2])) out.push(words[2]); // 시 아래 구 (예: 성남시 분당구)
  }
  return out.join(" ");
}

// "1. 김태우: 부산 사하구" 줄들 (학원에 매달 보내는 택배 명단)
export const regionLines = (rows: { name: string; address: string | null | undefined }[]) =>
  rows.map((r, i) => `${i + 1}. ${r.name}: ${regionOf(r.address) || "주소 없음"}`).join("\n");
