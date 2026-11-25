// 수강증 기록 저장·자동 정리 (임시 저장소에서만)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createReceiptCheck, getReceiptCheck, isPreview, listReceiptChecks, purgeReceipts, receiptImageUrl, receiptImageUsage, updateReceiptChecks } from "@/lib/db";

const base = { outcome: "review" as const, cohorts: ["2026-12"], classes: [], kind: null, receipt_name: "홍길동", captured_at: null, image_hash: "h1", reading: {}, reasons: ["반을 못 찾음"], ocr_text: "수강생 홍길동", ocr_ms: 1200 };
const DAY = 24 * 3600 * 1000;

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

test("확인이 필요할 때만 사진을 저장하고, 용량을 셀 수 있어요", async () => {
  const withImage = await createReceiptCheck(base, Buffer.alloc(1000, 1));
  const noImage = await createReceiptCheck({ ...base, outcome: "match", image_hash: "h2" });
  const a = (await getReceiptCheck(withImage))!;
  assert.equal(a.status, "read");
  assert.ok(a.image_path?.endsWith(`${withImage}.jpg`));
  assert.ok(await receiptImageUrl(a.image_path!));
  assert.equal((await getReceiptCheck(noImage))!.image_path, null);
  const u = await receiptImageUsage();
  assert.ok(u.images >= 1 && u.bytes >= 1000);
});

test("자동 정리: 제출 안 한 기록은 하루 뒤 삭제, 확인한 수강증은 7일 뒤 사진·원문만 삭제, 확인 대기는 그대로", async () => {
  const now = Date.now();
  const unsent = await createReceiptCheck({ ...base, image_hash: "u" }, Buffer.alloc(10));
  const approved = await createReceiptCheck({ ...base, image_hash: "a" }, Buffer.alloc(10));
  const waiting = await createReceiptCheck({ ...base, image_hash: "w" }, Buffer.alloc(10));
  const appId = "00000000-0000-4000-8000-000000000001";
  await updateReceiptChecks([approved], { application_id: appId, status: "approved", decided_at: new Date(now - 8 * DAY).toISOString() });
  await updateReceiptChecks([waiting], { application_id: appId, status: "review" });

  // 아직 하루 안 됨 → 아무것도 안 지워요(확인한 지 8일 된 사진만)
  const first = await purgeReceipts(now);
  assert.equal(first.stripped >= 1, true);
  assert.ok(await getReceiptCheck(unsent));
  const a = (await getReceiptCheck(approved))!;
  assert.equal(a.image_path, null);
  assert.equal(a.ocr_text, null);
  assert.ok(a.image_deleted_at);
  assert.deepEqual(a.reasons, ["반을 못 찾음"]); // 읽은 값·까닭은 남아요

  // 이틀 뒤 → 제출 안 한 기록은 삭제, 확인 대기는 사진까지 그대로
  await purgeReceipts(now + 2 * DAY);
  assert.equal(await getReceiptCheck(unsent), null);
  const w = (await getReceiptCheck(waiting))!;
  assert.ok(w.image_path);
  assert.ok((await listReceiptChecks("review")).some((c) => c.id === waiting));
});
