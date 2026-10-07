// 테스트 번호별 정답률 꺾은선 그래프 (한 줄, 범례 없이 제목이 이름 역할). 점 위에 손가락/마우스를 올리면 값이 보여요.
export default function LineChart({ title, points }: { title: string; points: { label: string; pct: number }[] }) {
  const W = 340, H = 170, L = 32, R = 10, T = 12, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (p: number) => T + ih - (p / 100) * ih;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(" ");
  const avg = points.length ? Math.round(points.reduce((s, p) => s + p.pct, 0) / points.length) : 0;
  const step = Math.max(1, Math.ceil(points.length / 8)); // 아래 글자가 겹치지 않게 일부만 표시
  return (
    <figure className="rounded-2xl bg-white p-4 shadow-[0_2px_0_#d5ecf9]">
      <figcaption className="flex items-baseline justify-between">
        <span className="font-jua text-lg text-sky-ink">{title}</span>
        <span className="text-sm text-slate-500">평균 {avg}% · {points.length}회</span>
      </figcaption>
      {points.length === 0 ? <p className="mt-2 text-sm text-slate-400">아직 기록이 없어요.</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`${title} 정답률 그래프`}>
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#e2eef6" strokeWidth={1} />
              <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize={10} fill="#7aa3bd">{g}</text>
            </g>
          ))}
          <path d={path} fill="none" stroke="#2b8fc7" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.pct)} r={4.5} fill="#2b8fc7" stroke="#ffffff" strokeWidth={2} />
              <circle cx={x(i)} cy={y(p.pct)} r={14} fill="transparent"><title>{`${p.label}번 · ${p.pct}%`}</title></circle>
              {i % step === 0 && <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#7aa3bd">{p.label}</text>}
            </g>
          ))}
        </svg>
      )}
    </figure>
  );
}
