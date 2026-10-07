// 가로 막대 (한 가지 색, 값은 글자로 함께). 점수 분포·많이 틀린 번호에 써요.
export default function Bars({ rows, big = false, unit = "명" }: { rows: { label: string; value: number }[]; big?: boolean; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={big ? "space-y-3" : "space-y-1.5"}>
      {rows.map((r) => (
        <li key={r.label} className={`grid items-center gap-2 ${big ? "grid-cols-[6rem_1fr_4rem] text-2xl" : "grid-cols-[4.5rem_1fr_3rem] text-sm"}`}>
          <span className="text-right text-slate-600">{r.label}</span>
          <span className={`block rounded-r-[4px] bg-sky-soft ${big ? "h-8" : "h-4"}`}>
            <span className="block h-full rounded-r-[4px] bg-sky-deep" style={{ width: `${(r.value / max) * 100}%` }} title={`${r.label}: ${r.value}${unit}`} />
          </span>
          <span className="font-bold text-sky-ink">{r.value}{unit}</span>
        </li>
      ))}
    </ul>
  );
}
