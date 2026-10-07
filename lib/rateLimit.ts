// 간단한 요청 횟수 제한. 서버 인스턴스마다 메모리에 세요(무료 요금제용 가벼운 방어).
const hits = new Map<string, number[]>();

// windowMs 안에 limit번까지만 허용해요. 넘으면 false.
export function allow(key: string, limit: number, windowMs: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return true;
}

// 실패 기록만 셀 때: 지금까지 몇 번이었는지 (늘리지 않음)
export function count(key: string, windowMs: number, now = Date.now()) {
  return (hits.get(key) ?? []).filter((t) => now - t < windowMs).length;
}
