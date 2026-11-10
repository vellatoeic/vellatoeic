import { cache } from "react";

// 한 요청 안에서 같은 조회를 한 번만 해요 (React cache = 요청마다 따로, 다른 학생과 섞이지 않아요).
// 같은 요청에서 고치면(forget) 다음 조회는 새로 읽어요. 화면을 그리는 중이 아니면(테스트 등) 매번 새로 읽어요.
const store = cache(() => new Map<string, Promise<unknown>>());

function current(): Map<string, Promise<unknown>> | null {
  try {
    return store();
  } catch {
    return null;
  }
}

export function memo<T>(key: string, run: () => Promise<T>): Promise<T> {
  const m = current();
  if (!m) return run();
  const hit = m.get(key);
  if (hit) return hit as Promise<T>;
  const p = run();
  m.set(key, p);
  p.catch(() => m.delete(key)); // 실패한 조회는 기억하지 않아요
  return p;
}

// key로 시작하는 기억을 지워요 (예: "apps:" → 신청 조회 전부)
export function forget(prefix: string) {
  const m = current();
  if (!m) return;
  for (const k of [...m.keys()]) if (k.startsWith(prefix)) m.delete(k);
}
