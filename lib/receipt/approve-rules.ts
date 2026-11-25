/**
 * **자동 승인 조건 — 한곳에서 정한다.** 수강증을 올린 그 자리와, 받아 둔 다음 달 수강증을 다시 맞출 때가 같은 조건을 본다
 * (두 곳에 베껴 두면 한쪽만 고쳐져 갈라진다).
 *
 * 하나라도 걸리면 자동 승인하지 않고 강사 검토로 보낸다. **거절 사유가 아니다** — 진짜 학생도 걸릴 수 있다.
 * 학생에게는 위조 신호를 말하지 않는다 (진짜 학생에게 실례고, 위조하는 쪽에는 무엇을 고칠지 알려 주는 꼴이다).
 */
import type { StoredParsed } from "./receipt";

export type AutoApproveBlocker =
  | "no_match"
  | "month_unclear"
  | "kind_unclear"
  | "gate"
  | "brand_word"
  | "card"
  | "name"
  | "mode"
  | "duplicate_image"
  | "stale_capture"
  | "same_capture"
  | "already_enrolled"
  | "decided_before";

/** 위조 · 돌려쓰기 신호 + 이미 그 달 반에 있나 (`flags.ts` 가 잰다) */
export type VerifyFlags = {
  /** 같은 파일(SHA-256)을 다른 계정이 올렸다 */
  duplicateImage: boolean;
  /** 캡처한 지 45일이 넘었다 */
  staleCapture: boolean;
  /** 같은 **초**에 캡처한 수강증이 다른 계정에 있다 — 파일 해시와 달리 글자를 고쳐도 살아남는다 (친구 수강증에 이름만 바꾼 것) */
  sameCapture: boolean;
  /** 배정하려는 달에 이미 배정된 반 id — 새로 넣으면 두 반을 듣게 된다 */
  alreadyEnrolled: string[];
  /** 같은 캡처를 전에 **사람이** 판정했다 — 승인됐다가 회수됐거나 반려된 그림을 기계가 다시 승인하면 안 된다 */
  decidedBefore: "approved" | "rejected" | null;
};

export type AutoApproveInput = {
  /** 저장해 둔 판독 결과에서도 부른다 — 칸이 없으면 **막는 쪽**으로 읽는다 */
  parsed: Partial<Pick<StoredParsed, "gates" | "brandExact" | "card" | "modeEvidence">>;
  nameMatches: boolean | null | undefined;
  flags: VerifyFlags;
  matched: boolean;
  monthUnclear?: boolean;
  kindUnclear?: boolean;
};

export function autoApproveBlockers({ parsed, nameMatches, flags, matched, monthUnclear = false, kindUnclear = false }: AutoApproveInput): AutoApproveBlocker[] {
  const out: AutoApproveBlocker[] = [];
  if (!matched) out.push("no_match");
  if (matched && monthUnclear) out.push("month_unclear");
  if (matched && kindUnclear) out.push("kind_unclear");
  if (parsed.gates?.academy !== true || parsed.gates?.brand !== true) out.push("gate");
  if (parsed.brandExact !== true) out.push("brand_word");
  if (parsed.card !== true) out.push("card");
  if (nameMatches !== true) out.push("name");
  if (parsed.modeEvidence !== "online" && parsed.modeEvidence !== "room") out.push("mode");
  if (flags.duplicateImage) out.push("duplicate_image");
  if (flags.staleCapture) out.push("stale_capture");
  if (flags.sameCapture) out.push("same_capture");
  if (flags.alreadyEnrolled.length > 0) out.push("already_enrolled");
  if (flags.decidedBefore !== null) out.push("decided_before");
  return out;
}

/** 승인 화면의 "자동 등업하지 않은 까닭" (강사 · 관리자만 본다) */
export const BLOCKER_LABEL: Record<AutoApproveBlocker, string> = {
  no_match: "딱 맞는 반을 못 찾음",
  month_unclear: "몇 월 과정인지 못 읽음 — 지금 열린 달의 반을 골라 뒀어요. 다음 달 수강증이면 그 달 반을 연 뒤 그 반으로 승인해 주세요",
  kind_unclear: "종합반 / LC / RC 표기를 못 읽음 — 시간 · 레벨로 골라 뒀어요",
  gate: "서면센터 · 벨라토익 표시를 못 읽음",
  brand_word: "‘벨라토익’ 글자를 그대로 못 읽음",
  card: "수강증 카드의 칸이 다 보이지 않음",
  name: "수강생 이름이 가입 이름과 다르거나 못 읽음",
  mode: "강의실 칸(온라인 강의 · 호실)을 못 읽어 현장 / 불라방을 모름",
  duplicate_image: "다른 계정과 같은 파일",
  stale_capture: "45일 넘은 캡처",
  same_capture: "다른 계정과 같은 초에 캡처",
  already_enrolled: "이미 그 달 반에 배정됨 — 반을 더하는 건지(단과 두 개) 바꾸는 건지 확인",
  decided_before: "같은 캡처를 전에 사람이 판정함",
};

/** 까닭 목록 → 문장. `no_match` 는 반 대조가 남긴 문장이 있으면 그것을 쓴다 (반이 없어서인지, 여럿이라 못 고른 것인지) */
export function blockerLines(blockers: readonly string[], matchReason?: string | null): string[] {
  return blockers.flatMap((b) => {
    if (!(b in BLOCKER_LABEL)) return [];
    if (b === "no_match" && matchReason) return [matchReason];
    return [BLOCKER_LABEL[b as AutoApproveBlocker]];
  });
}

/**
 * 이름 불일치 팝업 — 이름이 다르면 **거절하지 않는다** (한 글자 오인식일 수 있다). 학생에게 수강증에서 읽은 이름과
 * 가입 이름을 나란히 보여 주고 할 일을 알린다. 이름을 또렷이 읽었을 때만 띄운다.
 */
export type NameMismatch = { receiptName: string; myName: string };

export function nameMismatchOf(nameMatches: boolean | null | undefined, receiptName: string | null | undefined, myName: string | null | undefined): NameMismatch | undefined {
  if (nameMatches !== false || !receiptName || !myName) return undefined;
  const clean = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");
  const mine = clean(myName);
  if (!/^[가-힣]{2,}$/.test(mine)) return undefined; // 외국 이름은 비교하지 않는다 (수강증 칸은 한글로 읽는다)
  if (clean(receiptName) === mine) return undefined;
  return { receiptName: clean(receiptName), myName: mine };
}
