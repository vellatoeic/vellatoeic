import { unstable_rethrow } from "next/navigation";

// 부가 기능 보호막: 실패하거나 너무 오래 걸리면 기본값으로 넘어가요.
// 로그인·강의실·라이브·지난 강의 같은 핵심 화면은 부가 기능 때문에 멈추지 않아야 해요.
// 실패하면 함수 이름과 오류 내용만 남겨요 (개인정보·문자 원문은 남기지 않아요).
export async function safe<T>(name: string, fn: () => Promise<T>, fallback: T, ms = 4000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms); }),
    ]);
  } catch (e) {
    unstable_rethrow(e); // Next.js 내부 신호(쿠키 사용 감지·redirect 등)는 그대로 넘겨요
    console.error(`[safe:${name}]`, e instanceof Error ? e.message : String(e));
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
