// ── 수강증 글자 읽기 (서버 전용, 신청서 서버 동작만 써요) ──
// 스위치·월 상한·사용량은 lib/receipt/usage.ts (엔진 없이 설정만).
import "server-only";
import sharp from "sharp";
import { readReceiptText, tesseractOcr } from "./ocr/engine";
import { readEnoughFor } from "./receipt";
import { countOcr } from "./usage";

// 사진 → 원문. 실패해도 던지지 않아요(이유를 돌려줘요). 읽기를 시도하면 성공·실패와 상관없이 한 장으로 세요.
export async function ocrReceipt(bytes: Uint8Array, mimeType: string) {
  const started = Date.now();
  const out = await readReceiptText(tesseractOcr, { bytes, mimeType, enough: readEnoughFor(null) });
  await countOcr().catch(() => {});
  return { ...out, ms: Date.now() - started };
}

// 선생님 확인용으로 보관할 줄인 사진 (가로 최대 900px, JPEG). 보통 60~150KB예요.
export async function shrinkForReview(bytes: Uint8Array): Promise<Buffer | null> {
  try {
    return await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
  } catch {
    return null;
  }
}
