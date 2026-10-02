"use client";
export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-ghost !py-2 text-sm print:hidden">
      인쇄하기
    </button>
  );
}
