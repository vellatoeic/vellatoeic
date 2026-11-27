// ── 수강증 글자 → 우리 신청서의 반 (DB·OCR 없이 계산해요. 테스트: tests/receipt.test.ts) ──
// 키트(decision · match · approve-rules)로 판정하고, 찾은 반을 신청서 칸(기수·반·과정·시간·현장/불라방)으로 바꿔요.
//   match  = 반을 딱 하나 찾았고 자동 확인 조건이 다 맞음 → 신청서 칸을 채우고 잠가요
//   review = 반을 못 찾았거나 몇 칸이 애매함 → 학생이 직접 고르고(찾은 반이 있으면 미리 골라 둠) 선생님이 확인해요
//   reject = 서면센터·벨라토익 수강증이 아니거나 지금 신청받는 달이 아님 → 다시 올려 달라고 안내해요
// 이름은 여기서 보지 않아요(신청서 이름 칸이 뒤에 있어서). 제출할 때 nameOnReceipt로 따로 확인해요.
import type { Kind as ApplyKind } from "../config";
import { autoApproveBlockers, blockerLines, type AutoApproveBlocker } from "./approve-rules";
import { classOfSection, sectionsFor, type ReceiptClass } from "./classes";
import { decideVerification, isCaptureFresh, termOf } from "./decision";
import { matchSections } from "./match";
import { KIND_LABEL, TRACK_LABEL, parseReceipt, receiptHasName, receiptStudentName, type ParsedReceipt } from "./receipt";

export type ReceiptStatus = "match" | "review" | "reject";

export type ReceiptReading = {
  level: number | null;
  program: "score" | "premier";
  kind: string | null;
  track: string | null;
  twoMonth: boolean;
  time: string | null;
  courseMonth: number | null;
  startMonth: number | null;
  mode: ApplyKind | null;
  brandExact: boolean;
  card: boolean;
  gates: { academy: boolean; brand: boolean };
  warnings: string[];
};

export type ReceiptAnalysis = {
  status: ReceiptStatus;
  /** 학생에게 보여줄 문장 (~해요) */
  message: string;
  /** 찾은 반. 보통 1개, 격일반 2개월 과정이면 신청받는 달마다 하나씩 (review여도 찾았으면 미리 골라 둘 반) */
  classes: ReceiptClass[];
  /** 수강증의 강의실 칸: 801호 = 현장, 온라인 강의 = 불라방. 못 읽으면 null */
  kind: ApplyKind | null;
  /** 수강생 칸 이름 (또렷할 때만) */
  receiptName: string | null;
  /** 수강증 화면의 '현재시간' (초까지) — 다른 학생과 같은 초면 복사본 */
  capturedAt: string | null;
  /** 선생님 확인 화면에 보여줄 까닭 */
  reasons: string[];
  reading: ReceiptReading;
};

const toApplyKind = (p: ParsedReceipt): ApplyKind | null => (p.modeEvidence === "online" ? "online" : p.modeEvidence === "room" ? "onsite" : null);

function readingOf(p: ParsedReceipt): ReceiptReading {
  return {
    level: p.level,
    program: p.program,
    kind: p.kind ? KIND_LABEL[p.kind] : null,
    track: p.track ? TRACK_LABEL[p.track] : null,
    twoMonth: p.twoMonth,
    time: p.time?.timeBlock ?? null,
    courseMonth: p.courseMonth,
    startMonth: p.startMonth,
    mode: toApplyKind(p),
    brandExact: p.brandExact,
    card: p.card,
    gates: p.gates,
    warnings: p.warnings,
  };
}

const monthLabel = (cohorts: readonly string[]) => cohorts.map((c) => `${Number(c.slice(5, 7))}월`).join(" · ");

/**
 * @param text OCR 원문
 * @param cohorts 지금 신청받는 달 (lib/signupMonths) — 이 달들의 반만 찾아요
 * @param today 오늘 (한국 날짜)
 * @param open [일정표]에 수업일이 있는 반인지 (없으면 모든 반)
 */
export function analyzeReceipt(text: string, cohorts: readonly string[], today: string, open?: (c: ReceiptClass) => boolean): ReceiptAnalysis {
  const p = parseReceipt(text);
  const base = { kind: toApplyKind(p), receiptName: receiptStudentName(p.text), capturedAt: p.capturedAt, reading: readingOf(p) };

  const decision = decideVerification(p, cohorts.map(termOf), today);
  if (decision.kind === "reject") return { ...base, status: "reject", message: decision.reason, classes: [], reasons: [decision.reason] };
  if (decision.kind === "upcoming") {
    const message = `${decision.month}월 과정 수강증이에요. 지금은 ${monthLabel(cohorts)} 수업 신청만 받아요. 신청할 달의 수강증을 올려 주세요.`;
    return { ...base, status: "reject", message, classes: [], reasons: [message] };
  }

  const { result } = matchSections(p, sectionsFor(cohorts, open));
  const classes = result.kind === "match" ? result.sectionIds.map(classOfSection).filter((c): c is ReceiptClass => !!c) : [];
  const blockers: AutoApproveBlocker[] = autoApproveBlockers({
    parsed: p,
    nameMatches: true, // 이름은 제출할 때 확인해요
    flags: { duplicateImage: false, staleCapture: !isCaptureFresh(p.capturedOn, today), sameCapture: false, alreadyEnrolled: [], decidedBefore: null },
    matched: classes.length > 0,
    monthUnclear: result.kind === "match" ? result.monthUnclear : false,
    kindUnclear: result.kind === "match" ? result.kindUnclear : false,
  });
  const reasons = [...blockerLines(blockers, result.kind === "match" ? null : result.reason), ...(decision.note ? [decision.note] : [])];

  if (classes.length > 0 && blockers.length === 0) return { ...base, status: "match", message: "수강증을 확인했어요.", classes, reasons: [] };
  const message = classes.length
    ? "수강증에서 반을 찾았지만 몇 칸을 또렷하게 읽지 못했어요. 아래에 골라 둔 반이 맞는지 확인해 주세요. 선생님이 한 번 더 확인해요."
    : "수강증에서 반을 정확히 찾지 못했어요. 아래에서 직접 골라 주세요. 선생님이 수강증을 보고 확인해 드려요.";
  return { ...base, status: "review", message, classes, reasons };
}

/** 제출할 때: 신청서 이름이 수강증 수강생 칸과 같은가 (띄어쓰기 무시, 칸 값이 같아야 해요) */
export function nameOnReceipt(ocrText: string, name: string): boolean {
  return receiptHasName(ocrText, name);
}
