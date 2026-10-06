"use client";

// 반(group)별 또는 같은 칸(form) 전체("*")의 체크박스를 한 번에 선택·해제해요.
export default function SelectAll({ group }: { group: string }) {
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
          : Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-group="${group}"]`));
        boxes.forEach((box) => { box.checked = on; });
      }}
    />
  );
}
