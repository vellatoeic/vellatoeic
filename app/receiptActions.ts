"use server";

// 신청서 맨 위 '수강증 올리기' — 사진을 받아 글자를 읽고, 찾은 반을 신청서에 돌려줘요.
// 판정은 lib/receipt/analyze.ts 한곳, 글자 읽기·월 상한은 lib/receipt/server.ts.
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { todayKST, type Kind } from "@/lib/config";
import { createReceiptCheck } from "@/lib/db";
import { allow } from "@/lib/rateLimit";
import { analyzeReceipt, type ReceiptAnalysis } from "@/lib/receipt/analyze";
import type { ReceiptClass } from "@/lib/receipt/classes";
import { ocrReceipt, shrinkForReview } from "@/lib/receipt/server";
import { ocrAllowed } from "@/lib/receipt/usage";
import { signupMonths } from "@/lib/signupMonthsServer";

export type ReceiptResult = {
  id?: string;
  status: "match" | "review" | "reject" | "skipped" | "error";
  message: string;
  classes: ReceiptClass[];
  kind: Kind | null;
};

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

const SKIPPED = "지금은 수강증을 자동으로 읽지 않아요. 아래에서 반을 직접 골라 주세요. 선생님이 수강증을 보고 확인해 드려요.";
const UNREADABLE = "수강증을 자동으로 읽지 못했어요. 아래에서 반을 직접 골라 주세요. 선생님이 수강증을 보고 확인해 드려요.";

export async function readReceiptAction(fd: FormData): Promise<ReceiptResult> {
  const file = fd.get("receipt");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "수강증 사진을 골라 주세요.", classes: [], kind: null };
  if (!TYPES.includes(file.type)) return { status: "error", message: "사진 파일(JPG·PNG)만 올릴 수 있어요. 수강증 화면을 캡처해서 올려 주세요.", classes: [], kind: null };
  if (file.size > MAX_BYTES) return { status: "error", message: "사진이 너무 커요. 수강증 화면을 캡처한 사진으로 올려 주세요.", classes: [], kind: null };

  // 같은 사람이 계속 올리는 것을 막아요 (10분에 6번)
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!allow(`receipt:${ip}`, 6, 10 * 60 * 1000)) return { status: "error", message: "잠시 뒤(10분) 다시 올려 주세요.", classes: [], kind: null };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const cohorts = (await signupMonths()).map((m) => m.cohort);
  const today = todayKST();
  const image_hash = createHash("sha256").update(bytes).digest("hex");

  let analysis: ReceiptAnalysis | null = null;
  let outcome: "match" | "review" | "reject" | "skipped" = "skipped";
  let message = SKIPPED;
  let ocr_text: string | null = null;
  let ocr_ms: number | null = null;
  let reasons: string[] = [];

  const allowed = await ocrAllowed();
  if (!allowed.ok) reasons = [allowed.reason === "off" ? "글자 읽기를 꺼 둔 동안 올린 수강증" : "이번 달 글자 읽기 상한에 닿은 뒤 올린 수강증"];
  else {
    const out = await ocrReceipt(bytes, file.type);
    ocr_ms = out.ms;
    if (!out.ok) {
      outcome = "review";
      message = UNREADABLE;
      reasons = [`글자를 읽지 못함 (${out.reason.slice(0, 60)})`];
    } else {
      ocr_text = out.result.text;
      analysis = analyzeReceipt(out.result.text, cohorts, today);
      outcome = analysis.status;
      message = analysis.message;
      reasons = analysis.reasons;
    }
  }

  // 줄인 사진(약 70KB)을 잠깐 보관해요. 제출할 때 자동 확인되면 바로 지우고(다운로드가 없어 전송량은 그대로),
  // 이름이 다르거나 같은 수강증처럼 선생님 확인이 필요하면 확인 7일 뒤까지 남겨요. 제출 안 한 사진은 하루 뒤 지워요.
  const image = (await shrinkForReview(bytes)) ?? undefined;
  const id = await createReceiptCheck({
    outcome,
    cohorts,
    classes: analysis?.classes ?? [],
    kind: analysis?.kind ?? null,
    receipt_name: analysis?.receiptName ?? null,
    captured_at: analysis?.capturedAt ?? null,
    image_hash,
    reading: (analysis?.reading as unknown as Record<string, unknown>) ?? {},
    reasons,
    ocr_text,
    ocr_ms,
  }, image);

  return { id, status: outcome, message, classes: analysis?.classes ?? [], kind: analysis?.kind ?? null };
}
