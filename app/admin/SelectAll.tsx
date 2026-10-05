"use client";

// 반(group)별 또는 화면 전체("*")의 체크박스를 한 번에 선택·해제해요.
export default function SelectAll({ group }: { group: string }) {
  return (
    <input
      type="checkbox"
      aria-label="전체 선택"
      data-select-all={group}
      className="h-5 w-5 accent-sky-deep"
      onChange={(e) => {
        const on = e.currentTarget.checked;
        const selector = group === "*" ? 'input[name="ids"], input[data-select-all]' : `input[data-group="${group}"]`;
        document.querySelectorAll<HTMLInputElement>(selector).forEach((box) => { box.checked = on; });
      }}
    />
  );
}
