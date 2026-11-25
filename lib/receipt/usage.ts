// ── 수강증 글자 읽기 스위치·월 상한·사용량 (엔진 없이 설정만. 관리 화면·서버 동작이 같이 써요) ──
// 무료 요금제 보호: Vercel 서버 계산 시간(월 4시간)을 넘지 않게 '이번 달 읽은 장수'를 세고 상한에 닿으면 글자 읽기를 멈춰요.
// 멈춰도 신청은 계속 받아요(학생이 직접 반을 고르고 선생님이 확인). 관리 [신청 관리] '수강증 확인' 칸에서 끄고 켜요.
import "server-only";
import { getSetting, setSetting } from "../db";

export const OCR_SWITCH_KEY = "receipt_ocr"; // "off" = 끔 (비어 있으면 켜짐)
export const OCR_CAP_KEY = "receipt_ocr_cap"; // 한 달 상한 (비어 있으면 기본값)
export const DEFAULT_OCR_CAP = 400;
const countKey = (month: string) => `receipt_ocr_count:${month}`;
const thisMonth = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);

export async function ocrUsage(month = thisMonth()) {
  const [sw, capRaw, countRaw] = await Promise.all([getSetting(OCR_SWITCH_KEY), getSetting(OCR_CAP_KEY), getSetting(countKey(month))]);
  const cap = capRaw !== "" && Number(capRaw) >= 0 ? Number(capRaw) : DEFAULT_OCR_CAP;
  const count = Number(countRaw) || 0;
  return { on: sw !== "off", cap, count, month };
}

// 지금 글자를 읽어도 되나 (꺼짐·상한이면 이유)
export async function ocrAllowed(): Promise<{ ok: true } | { ok: false; reason: "off" | "cap" }> {
  const u = await ocrUsage();
  if (!u.on) return { ok: false, reason: "off" };
  if (u.count >= u.cap) return { ok: false, reason: "cap" };
  return { ok: true };
}

// 읽기를 한 번 시도할 때마다 한 장으로 세요 (성공·실패와 상관없이)
export async function countOcr() {
  const month = thisMonth();
  const n = (Number(await getSetting(countKey(month))) || 0) + 1;
  await setSetting(countKey(month), String(n));
}
