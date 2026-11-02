"use client";

// 반(group)별 또는 같은 칸(form) 전체("*")의 체크박스를 한 번에 선택·해제해요.
// prefix: group으로 시작하는 묶음 전부 (예: "am-" = 오전반 모든 반)
export default function SelectAll({ group, prefix = false }: { group: string; prefix?: boolean }) {
  return (
    <input
      type="checkbox"
      aria-label="전체 선택"
      data-select-all={group}
      className="h-5 w-5 accent-sky-deep"
      onChange={(e) => {
        const on = e.currentTarget.checked;
        const boxes = group === "*"
          ? Array.from(e.currentTarget.form?.elements ?? []).filter((el): el is HTMLInputElement => el instanceof HTMLInputElement && (el.name === "ids" || el.hasAttribute("data-select-all")))
          : Array.from(document.querySelectorAll<HTMLInputElement>(prefix ? `input[data-group^="${group}"], input[data-select-all^="${group}"]` : `input[data-group="${group}"]`));
        boxes.forEach((box) => { box.checked = on; });
      }}
    />
  );
}
