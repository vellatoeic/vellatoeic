// 엑셀에서 한글이 깨지지 않게 BOM을 붙인 CSV 응답을 만들어요.
export function csvResponse(fileName: string, rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

export function phoneLabel(phone: string | null) {
  return phone?.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3") ?? "";
}
