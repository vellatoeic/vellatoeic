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
