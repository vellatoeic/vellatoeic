/**
 * 수강증 OCR 엔진 — tesseract.js (한국어 + 영어, 무료 · 서버에서 직접 실행).
 *
 * **영어도 함께 싣는 까닭**: 벨라토익은 단과 강좌명이 `[LC]` · `[RC]` 다. 한국어 모델만 쓰면 `LC` 를 `ㄴㅇ` 으로, `RC` 를 `80` 으로 읽는다
 * (실측 — 같은 카드를 한국어만 · 한국어+영어로 읽어 비교). 판독기는 그 꼴도 받지만(receipt.ts parseKind) 또렷이 읽는 쪽이 낫다.
 *
 * 왜 무료 엔진인가: 수강증은 종이 사진이 아니라 YBM 앱 · 홈페이지 **화면 캡처**라 글자가 또렷하다. 판정에 쓰는 줄이 1초 안팎에 읽힌다.
 * 유료 엔진을 쓰지 않으면 키 · 요금 · 외부 전송이 없고, 무엇보다 **수강증의 실명이 밖으로 나가지 않는다.**
 *
 * ## 서버에서만 돈다
 * 학생 브라우저에서 읽은 글자는 믿을 수 없다 (게이트를 우회해 남의 반에 배정될 수 있다). 서버가 받은 파일을 여기서 읽는다.
 *
 * ## Vercel 에서 주의할 것 (README "배포")
 * - 언어 데이터(kor · eng)는 처음 한 번 CDN 에서 받아 **쓰기가 되는 `/tmp`** 에 캐시한다.
 * - 워커는 모듈 수준에서 한 번 만들어 재사용한다 (인스턴스가 살아 있는 동안 두 번째 요청부터 빠르다).
 * - Next.js 는 `serverExternalPackages: ["tesseract.js"]` + `outputFileTracingIncludes` 로 워커 파일을 함수에 싣는다.
 * - 한 장씩 줄을 세운다 (`serial-queue.ts`). 기다림 20초 + 읽기 30초 = 50초 < 함수 제한 60초 (`maxDuration = 60`).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import { receiptVariants, type OcrVariant } from "./image";
import { createSerialQueue } from "./serial-queue";

export type OcrResult = { text: string; engine: string; confidence: number | null; variants: string[] };

/** OCR 엔진 자리 — 어떤 엔진이든 원문 text 만 돌려주면 판독기가 그 뒤를 맡는다 (시험에서는 가짜 엔진을 꽂는다) */
export interface OcrEngine {
  readonly name: string;
  /** `enough`: 지금까지 읽은 원문으로 판정 키가 다 나왔으면 true — 엔진은 남은(더 느린) 변형을 건너뛴다 */
  recognize(input: { bytes: Uint8Array; mimeType: string; enough?: (text: string) => boolean }): Promise<OcrResult>;
}

const LANGS = ["kor", "eng"];
const LANG = LANGS.join("+");
/** 이미지 한 장 읽기 제한 — **자기 차례가 온 뒤부터** 센다 */
const TIMEOUT_MS = 30_000;
/** 앞 사람 수강증을 읽는 동안 기다리는 한도 (넘으면 `ocr_busy` 로 강사 검토) */
const QUEUE_WAIT_MS = 20_000;
/** 워커를 못 만들었으면 잠시 쉰다 — 실패한 워커 스레드는 손에 없어 못 끝내므로 요청마다 다시 만들면 스레드가 쌓인다 */
const RETRY_AFTER_MS = 5 * 60_000;

const ocrQueue = createSerialQueue();
let slot: { promise: Promise<Worker>; ready: boolean } | null = null;
let failedAt = 0;

/** 언어 데이터 캐시 폴더 — **폴더가 없으면 tesseract.js 가 조용히 캐시를 건너뛰고 매번 새로 받는다.** 그래서 먼저 만든다 */
function cacheDir(): string {
  const dir = process.env.TESSERACT_CACHE_DIR || path.join(os.tmpdir(), "tesseract-cache");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* 못 만들면 캐시 없이 매번 받는다 — 느릴 뿐 동작은 한다 */
  }
  return dir;
}

/**
 * 워커 준비. `createWorker` 는 **언어 데이터 · 초기화가 실패해도 끝나지 않는다** — 안에서 오류를 삼키고 errorHandler 만 부른다.
 * 그대로 두면 실패할 때마다 타임아웃을 다 기다린다. 그래서 errorHandler 로 받은 첫 오류로 바로 실패시킨다.
 * errorHandler 가 아예 없으면 tesseract.js 가 메인 스레드에 그냥 던져 함수 전체가 죽는다.
 */
function getWorker(): Promise<Worker> {
  if (slot) return slot.promise;
  if (Date.now() - failedAt < RETRY_AFTER_MS) return Promise.reject(new Error("ocr_cooldown"));
  const current = { ready: false } as { promise: Promise<Worker>; ready: boolean };
  current.promise = new Promise<Worker>((resolve, reject) => {
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      failedAt = Date.now();
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    createWorker(LANGS, 1, {
      cachePath: cacheDir(),
      ...(process.env.TESSERACT_LANG_PATH ? { langPath: process.env.TESSERACT_LANG_PATH } : {}),
      logger: () => {},
      errorHandler: (err: unknown) => {
        console.error("[ocr] worker error:", err);
        fail(err);
      },
    }).then((worker) => {
      if (settled) return void worker.terminate();
      settled = true;
      current.ready = true;
      resolve(worker);
    }, fail);
  });
  slot = current;
  return current.promise;
}

/** 실패한 워커를 버린다 — **줄의 차례를 쥔 작업 안에서만** 부른다. 끝나기를 기다리지 않는다 (멈춘 워커는 영영 안 끝날 수 있다) */
function resetWorker() {
  const old = slot;
  slot = null;
  if (!old) return;
  if (!old.ready) failedAt = Date.now();
  old.promise.then((w) => w.terminate(), () => {}).catch(() => {});
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ocr_timeout")), ms);
    p.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** tesseract 가 읽을 수 있는 형식인가 — 그림만 (PDF · SVG 는 아니다) */
export function ocrSupports(mimeType: string | null | undefined, filePath?: string): boolean {
  const type = (mimeType ?? "").toLowerCase();
  if (type === "image/svg+xml") return false;
  if (type.startsWith("image/")) return true;
  if (type) return false;
  return /\.(jpe?g|png|webp|bmp)$/i.test(filePath ?? "");
}

async function recognizeVariants(variants: OcrVariant[], enough?: (text: string) => boolean): Promise<OcrResult> {
  const worker = await getWorker();
  const texts: string[] = [];
  const used: string[] = [];
  let confidence = 0;
  for (const v of variants) {
    const { data } = await worker.recognize(v.bytes);
    texts.push(data.text);
    used.push(v.name);
    confidence = Math.max(confidence, data.confidence);
    if (enough?.(texts.join("\n"))) break;
  }
  return { text: texts.join("\n"), engine: `tesseract.js/${LANG}`, confidence, variants: used };
}

export const tesseractOcr: OcrEngine = {
  name: `tesseract.js/${LANG}`,
  async recognize({ bytes, enough }) {
    // 전처리는 줄 밖에서 한다. 실패하면 원본을 그대로 읽지 않는다 — 픽셀 상한을 넘는 그림도 여기서 실패한다
    let variants: OcrVariant[];
    try {
      variants = await receiptVariants(bytes);
    } catch (err) {
      throw new Error(`image_unreadable: ${err instanceof Error ? err.message : String(err)}`);
    }
    return ocrQueue(async () => {
      try {
        return await withTimeout(recognizeVariants(variants, enough), TIMEOUT_MS);
      } catch (err) {
        resetWorker();
        throw err;
      }
    }, QUEUE_WAIT_MS);
  },
};

export type OcrOutcome = { ok: true; result: OcrResult } | { ok: false; reason: string };

/**
 * 이미지 바이트 → 원문. **실패해도 던지지 않는다** — 사유를 돌려준다 (기록의 ocr.error 에 남아 승인 화면에서 보인다).
 * 등업 신청은 OCR 이 안 돼도 접수돼야 한다 (읽은 게 없으면 강사 검토).
 */
export async function readReceiptText(
  engine: OcrEngine,
  input: { bytes: Uint8Array; mimeType?: string | null; filePath?: string; enough?: (text: string) => boolean },
): Promise<OcrOutcome> {
  if (!ocrSupports(input.mimeType, input.filePath)) return { ok: false, reason: "not_image" };
  const started = Date.now();
  try {
    const result = await engine.recognize({ bytes: input.bytes, mimeType: input.mimeType ?? "", enough: input.enough });
    console.log(`[ocr] ${result.text.replace(/\s+/g, "").length}자 읽음, ${Date.now() - started}ms (${result.variants.join("+") || "?"})`);
    return { ok: true, result };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[ocr] 수강증을 읽지 못했어요 (${Date.now() - started}ms): ${reason}`);
    return { ok: false, reason: reason.slice(0, 200) };
  }
}

/** 워커를 끝낸다 — 시험 · 명령줄 도구가 끝날 때 (워커 스레드가 남아 프로세스가 안 끝나는 일을 막는다) */
export async function closeOcrWorker(): Promise<void> {
  await ocrQueue(async () => {
    const old = slot;
    slot = null;
    if (old) await withTimeout(old.promise.then((w) => w.terminate()), 5_000).catch(() => {});
  }, 120_000).catch(() => {});
}
