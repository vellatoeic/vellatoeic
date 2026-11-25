// ── 신청서 제출할 때 수강증 판정 (DB 없이 계산해요. 테스트: tests/receipt.test.ts) ──
//   auto   = 수강증대로 자동 확인 (반·현장/불라방·이름이 모두 수강증과 같고, 다른 학생이 같은 수강증을 쓰지 않음)
//   review = 선생님 확인 필요 (까닭을 남겨요)
//   error  = 제출을 막고 학생에게 안내 (수강증과 다른 반·다른 수강 형태로 신청하려 할 때. '직접 고르기'를 누르면 review로 받아요)
import { KINDS, type CourseId, type Kind, type TimeSlot, type Track } from "../config";
import { nameOnReceipt } from "./analyze";
import { classText, type ReceiptClass } from "./classes";

export type CheckForVerdict = {
  outcome: "match" | "review" | "reject" | "skipped";
  classes: ReceiptClass[];
  kind: Kind | null;
  receipt_name: string | null;
  ocr_text: string | null;
  reasons: string[];
};
export type Submitted = { cohort: string; course: CourseId; track: Track; slot: TimeSlot; kind: Kind; name: string };

export { classText };

const same = (a: ReceiptClass, s: Submitted) => a.cohort === s.cohort && a.course === s.course && a.track === s.track && a.slot === s.slot;

/**
 * @param override 학생이 '수강증과 다르게 직접 고르기'를 눌렀어요 → 막지 않고 선생님 확인으로 받아요
 * @param twinNames 같은 사진(지문)이나 같은 초 캡처 수강증으로 이미 낸 다른 신청의 이름들
 */
export function receiptVerdict(check: CheckForVerdict, s: Submitted, override: boolean, twinNames: string[] = []):
  { status: "auto" | "review"; reasons: string[] } | { error: string } {
  const extra: string[] = [];

  if (check.outcome === "match") {
    // 현장 학생은 불라방으로 전환할 수 있어요(운영 규칙). 불라방 수강증으로 현장 신청만 막아요.
    if (check.kind === "online" && s.kind === "onsite") {
      if (!override) return { error: `이 수강증은 ${KINDS.online.short} 수강증이에요. ${KINDS.online.short} 신청서에서 신청해 주세요.` };
      extra.push(`학생이 불라방 수강증으로 현장 신청`);
    }
    if (!check.classes.some((c) => same(c, s))) {
      if (!override) return { error: `수강증과 다른 반이에요. 수강증에 적힌 반(${classText(check.classes[0])})으로 신청해 주세요.` };
      extra.push(`학생이 수강증과 다른 반을 고름 (수강증: ${check.classes.map(classText).join(" / ")})`);
    }
  }

  if (check.ocr_text && !nameOnReceipt(check.ocr_text, s.name)) {
    extra.push(check.receipt_name ? `수강생 이름이 달라요 (수강증 ${check.receipt_name} · 신청서 ${s.name})` : "수강증에서 수강생 이름을 또렷이 못 읽음");
  }

  const others = [...new Set(twinNames.filter((n) => n.replace(/\s+/g, "") !== s.name.replace(/\s+/g, "")))];
  if (others.length) extra.push(`다른 학생(${others.join(", ")}) 신청과 같은 수강증`);

  if (check.outcome === "match" && extra.length === 0) return { status: "auto", reasons: [] };
  return { status: "review", reasons: [...check.reasons, ...extra] };
}
