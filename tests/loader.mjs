// 테스트 실행용: Next.js 없이 TypeScript 파일을 불러오게 도와줘요.
// "@/..." 경로와 확장자 없는 경로를 찾아 주고, 서버 전용 표시(server-only)는 빈 모듈로 바꿔요.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(spec, ctx, next) {
  if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
  // next/headers 같은 Next.js 내부 경로는 .js 파일이에요.
  if (/^next\/[a-z-]+$/.test(spec)) return next(`${spec}.js`, ctx);
  let p = null;
  if (spec.startsWith("@/")) p = path.join(root, spec.slice(2));
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:")) p = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
  if (p) {
    for (const candidate of [p, `${p}.ts`, `${p}.tsx`, path.join(p, "index.ts")]) {
      if (existsSync(candidate) && path.extname(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return next(spec, ctx);
}
