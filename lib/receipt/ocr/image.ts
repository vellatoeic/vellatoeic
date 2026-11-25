/**
 * 수강증 이미지 전처리 — OCR 전에 **흑백 변형 여러 장**을 만든다.
 *
 * 학생은 카드만 잘라 올리지 않고 **휴대폰 화면 전체**를 캡처한다. 그 화면에서 수강증 카드는 파란 바탕에 흰 글자인데,
 * tesseract 는 컬러 원본에서 카드를 통째로 건너뛴다. 흑백으로만 바꿔도 대부분 읽히고, 폭을 700px 로 줄이면 큰 제목 글자까지 읽힌다.
 * 그래서 변형을 여러 장 읽어 원문을 이어 붙인다 — 판독기는 공백을 지운 원문에서 키워드를 찾으므로 중복은 해가 없고,
 * 한 장이 놓친 단어를 다른 장이 채운다. 엔진은 앞에서 판정 키가 다 읽히면 뒤를 건너뛴다.
 *
 * 변형 (싼 것부터): 폭 700 흑백 → 흰 글자만 남김 → 원본 크기 흑백. PC · 태블릿 카드는 카드를 잘라 키운 변형 셋을 **앞에** 둔다.
 */
import sharp, { type Sharp } from "sharp";
import { cardCrop, cardFirst, cardOf, cardScale, largestBlueBlob } from "./card";

/**
 * **SVG 는 읽지 않는다.** sharp 는 선언된 형식이 아니라 그림의 내용으로 형식을 알아내서, PNG 라고 올린 SVG 도 librsvg 로 푼다 —
 * 그 라이브러리의 메모리 오류가 로그인한 누구나 닿는 자리가 된다. 수강증은 화면 캡처라 SVG 일 수 없으므로 아예 막는다.
 * 막힌 그림은 metadata() 가 던져 `image_unreadable` 로 강사 검토에 간다. (프로세스 전체에 걸린다 — 다른 곳에서 SVG 를 sharp 로 다루면 이 줄을 옮길 것)
 */
sharp.block({ operation: ["VipsForeignLoadSvg"] });

export type OcrVariant = { name: string; bytes: Buffer };

const TITLE_WIDTH = 700;
const WHITE_THRESHOLD = 200;
/** 이보다 큰 그림은 읽지 않는다 — 작은 파일이 거대한 픽셀로 풀리는 그림(디컴프레션 폭탄)을 막는다. 휴대폰 캡처는 3~12MP */
const MAX_PIXELS = 40_000_000;

export async function receiptVariants(input: Uint8Array): Promise<OcrVariant[]> {
  const src = sharp(Buffer.from(input), { failOn: "none", limitInputPixels: MAX_PIXELS }).rotate();
  const meta = await src.metadata();
  const width = meta.width ?? 0;
  const gray = () => src.clone().grayscale();

  const out: OcrVariant[] = [];
  if (width > TITLE_WIDTH * 1.2) out.push({ name: `gray_w${TITLE_WIDTH}`, bytes: await gray().resize({ width: TITLE_WIDTH }).png().toBuffer() });
  out.push({ name: "white_only", bytes: await gray().threshold(WHITE_THRESHOLD).negate().png().toBuffer() });
  out.push({ name: "gray", bytes: await gray().png().toBuffer() });

  const firstScale = width > TITLE_WIDTH * 1.2 ? TITLE_WIDTH / width : 1;
  const card = await cardVariants(src, firstScale).catch((err: unknown) => {
    console.error(`[ocr] 수강증 카드를 찾다 실패했어요: ${err instanceof Error ? err.message : String(err)}`);
    return [] as OcrVariant[];
  });
  return [...card, ...out];
}

/** 카드를 찾을 때 줄이는 폭 — 덩어리만 보면 되므로 작게 */
const FIND_WIDTH = 320;
/** 카드 변형의 카드 높이 — 이 높이에서 라벨 글자가 20px 남짓. 두 높이를 함께 읽어 서로 메운다 */
const CARD_HEIGHTS = [800, 1100] as const;
/** 배지 `12월 과정` 의 검은 글자만 남기는 문턱 (카드 파랑 · 흰 글자 · 노란 배지는 희게) */
const BADGE_DARK = 110;

async function cardVariants(src: Sharp, firstScale: number): Promise<OcrVariant[]> {
  const meta = await src.metadata();
  const auto = (meta as { autoOrient?: { width?: number; height?: number } }).autoOrient;
  const imageWidth = auto?.width ?? meta.width ?? 0;
  const imageHeight = auto?.height ?? meta.height ?? 0;
  if (imageWidth <= 0 || imageHeight <= 0) return [];
  const flat = () => src.clone().flatten({ background: "#ffffff" });
  const { data, info } = await flat().resize({ width: FIND_WIDTH, kernel: "nearest" }).raw().toBuffer({ resolveWithObject: true });
  const blob = largestBlueBlob(data, info.width, info.height, info.channels);
  if (!blob) return [];
  const card = cardOf(blob, imageWidth / info.width, imageHeight / info.height, imageWidth, imageHeight);
  if (!card || !cardFirst(card, firstScale)) return [];

  const crop = cardCrop(card, imageWidth, imageHeight);
  const at = (height: number) =>
    flat()
      .extract(crop)
      .grayscale()
      .resize({ width: Math.max(1, Math.round(crop.width * cardScale(card, height))) });
  const dark = Math.min(BADGE_DARK, Math.round(blob.gray) - 15);
  const [first, second] = CARD_HEIGHTS;
  return [
    { name: `card_h${first}`, bytes: await at(first).png().toBuffer() },
    { name: "card_badge", bytes: await at(first).threshold(dark).png().toBuffer() },
    { name: `card_h${second}`, bytes: await at(second).png().toBuffer() },
  ];
}
