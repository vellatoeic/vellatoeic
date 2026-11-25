import { describe, expect, it } from "./vitest-shim";
import { autoApproveBlockers, nameMismatchOf, type VerifyFlags } from "@/lib/receipt/approve-rules";
import { decideVerification, isCaptureFresh, monthsAhead, termOf } from "@/lib/receipt/decision";
import { matchSections } from "@/lib/receipt/match";
import { parseReceipt } from "@/lib/receipt/receipt";
import { card, sectionsFor } from "./fixtures";

const dec = sectionsFor("2026-12");
const jan = sectionsFor("2027-01", "2027-01-05", "2027-01-29");

describe("반 대조 — 키로 거른다", () => {
  it("문풀반 주 4일 저녁 → 딱 하나", () => {
    const { result } = matchSections(parseReceipt(card()), dec);
    expect(result).toMatchObject({ kind: "match", sectionIds: ["12-solve-pm"], terms: ["2026-12"] });
  });
  it("LC 650 과 LC 750 은 같은 시간이어도 레벨로 갈린다", () => {
    const { result } = matchSections(parseReceipt(card({ title: "[LC]", goal: "650 목표", level: "650+", time: "11:10~12:10" })), dec);
    expect(result).toMatchObject({ kind: "match", sectionIds: ["12-lc650-am"] });
  });
  it("속성반 저녁", () => {
    const { result } = matchSections(parseReceipt(card({ level: "실전속성", days: "[4주-12/01] 월화수목 (월16회) 프리미어반", time: "18:00~21:20" })), dec);
    expect(result).toMatchObject({ kind: "match", sectionIds: ["12-premier-pm"] });
  });
  it("종합/단과를 못 읽으면 시간 · 레벨로 고르되 kindUnclear", () => {
    const { result } = matchSections(parseReceipt(card({ title: "" })), dec);
    expect(result).toMatchObject({ kind: "match", sectionIds: ["12-solve-pm"], kindUnclear: true });
  });
  it("시간이 어느 반과도 안 맞으면 none (까닭 문장)", () => {
    const { result } = matchSections(parseReceipt(card({ time: "17:00~19:10" })), dec);
    expect(result.kind).toBe("none");
  });
  it("격일 월수 2개월 — 12월만 열려 있으면 12월 월수 + 1월 화목은 followUp", () => {
    const { result } = matchSections(parseReceipt(card({ days: "[4주-12/01] 월수 (월8회)" })), dec);
    expect(result).toMatchObject({ kind: "match", sectionIds: ["12-solve-mw-pm"], followUp: { month: 1, track: "tt", level: 750, timeBlock: "18:00~20:10" } });
  });
  it("격일 월수 2개월 — 12월 · 1월이 다 열려 있으면 두 반 다", () => {
    const { result } = matchSections(parseReceipt(card({ days: "[4주-12/01] 월수 (월8회)" })), [...dec, ...jan]);
    expect(result).toMatchObject({ kind: "match", sectionIds: ["12-solve-mw-pm", "01-solve-tt-pm"] });
    expect(result.kind === "match" && result.followUp).toBeFalsy();
  });
  it("격일 12월 과정 수강증을 1월에 올리면 (12월 반 종강) 1월 반대 요일 반", () => {
    const { result } = matchSections(parseReceipt(card({ days: "[4주-12/02] 화목 (월8회)" })), jan);
    expect(result).toMatchObject({ kind: "match", sectionIds: ["01-solve-mw-pm"] });
  });
  it("수강월을 못 읽었는데 열린 달이 하나면 고르되 monthUnclear", () => {
    const { result } = matchSections(parseReceipt(card({ month: "", days: "월화수목 (월16회)" })), dec);
    expect(result).toMatchObject({ kind: "match", monthUnclear: true });
  });
  it("수강월을 못 읽었는데 두 달이 열려 있으면 가릴 수 없다", () => {
    const { result } = matchSections(parseReceipt(card({ month: "", days: "월화수목 (월16회)" })), [...dec, ...jan]);
    expect(result.kind).toBe("ambiguous");
  });
  it("1월 수강증인데 1월 반이 없으면 다른 달로 넘어가지 않는다", () => {
    const { result } = matchSections(parseReceipt(card({ month: "01월 과정", days: "[4주-01/05] 월화수목 (월16회)" })), dec);
    expect(result.kind).toBe("none");
  });
  it("과정명 레벨과 숫자가 다르면 멈춘다", () => {
    const { result } = matchSections(parseReceipt(card({ goal: "650 목표", level: "실전속성", days: "[4주-12/01] 월화수목 (월16회) 프리미어반", time: "10:00~13:20" })), dec);
    expect(result.kind).toBe("ambiguous");
  });
});

describe("1차 판정", () => {
  const open = [termOf("2026-12")];
  it("서면센터 화면이 아니면 거절", () => {
    expect(decideVerification(parseReceipt("카카오톡 대화 캡처입니다 선생님 벨라토익 12월 등록했어요 확인 부탁드립니다 감사합니다 ^^"), open, "2026-11-25")).toMatchObject({ kind: "reject", code: "academy" });
  });
  it("벨라토익이 아니면 거절", () => {
    const t = card().replace("벨라토익", "샘플토익").replace("벨라(김지민)", "홍강사");
    expect(decideVerification(parseReceipt(t), open, "2026-11-25")).toMatchObject({ kind: "reject", code: "brand" });
  });
  it("지난 과정이면 거절", () => {
    expect(decideVerification(parseReceipt(card({ month: "10월 과정", days: "[4주-10/01] 월화수목 (월16회)" })), open, "2026-12-03")).toMatchObject({ kind: "reject", code: "month" });
  });
  it("다음 달 수강증은 받아 둔다", () => {
    expect(decideVerification(parseReceipt(card({ month: "01월 과정", days: "[4주-01/05] 월화수목 (월16회)" })), open, "2026-12-10")).toMatchObject({ kind: "upcoming", month: 1 });
  });
  it("격일 12월 과정을 1월에 올리면 (1월 반 열림) 통과", () => {
    expect(decideVerification(parseReceipt(card({ days: "[4주-12/01] 월수 (월8회)" })), [termOf("2027-01")], "2027-01-06")).toEqual({ kind: "review" });
  });
  it("글자를 거의 못 읽었으면 거절하지 않는다", () => {
    expect(decideVerification(parseReceipt("흐림"), open, "2026-11-25").kind).toBe("review");
  });
  it("열린 반이 하나도 없으면 지난 과정이라고 말하지 않는다", () => {
    expect(decideVerification(parseReceipt(card({ month: "10월 과정", days: "[4주-10/01] 월화수목 (월16회)" })), [], "2026-12-03").kind).toBe("review");
  });
  it("monthsAhead · 캡처 신선도", () => {
    expect(monthsAhead(1, "2026-12-10")).toBe(1);
    expect(monthsAhead(11, "2026-12-10")).toBe(11);
    expect(isCaptureFresh("2026-10-01", "2026-11-25")).toBe(false);
    expect(isCaptureFresh("2026-11-01", "2026-11-25")).toBe(true);
    expect(isCaptureFresh(null, "2026-11-25")).toBe(true);
  });
});

describe("자동 승인 조건", () => {
  const clean: VerifyFlags = { duplicateImage: false, staleCapture: false, sameCapture: false, alreadyEnrolled: [], decidedBefore: null };
  const p = parseReceipt(card());
  it("다 맞으면 막는 것이 없다", () => {
    expect(autoApproveBlockers({ parsed: p, nameMatches: true, flags: clean, matched: true })).toEqual([]);
  });
  it("하나씩 막는다", () => {
    expect(autoApproveBlockers({ parsed: p, nameMatches: false, flags: clean, matched: true })).toEqual(["name"]);
    expect(autoApproveBlockers({ parsed: p, nameMatches: true, flags: { ...clean, sameCapture: true }, matched: true })).toEqual(["same_capture"]);
    expect(autoApproveBlockers({ parsed: p, nameMatches: true, flags: { ...clean, alreadyEnrolled: ["x"] }, matched: true })).toEqual(["already_enrolled"]);
    expect(autoApproveBlockers({ parsed: p, nameMatches: true, flags: clean, matched: true, monthUnclear: true })).toEqual(["month_unclear"]);
    expect(autoApproveBlockers({ parsed: { ...p, modeEvidence: "live" }, nameMatches: true, flags: clean, matched: true })).toEqual(["mode"]);
  });
  it("저장된 기록에 칸이 없으면 막는 쪽", () => {
    expect(autoApproveBlockers({ parsed: {}, nameMatches: true, flags: clean, matched: true })).toEqual(["gate", "brand_word", "card", "mode"]);
  });
  it("이름 불일치 팝업은 이름을 또렷이 읽었을 때만", () => {
    expect(nameMismatchOf(false, "홍길동", "김철수")).toEqual({ receiptName: "홍길동", myName: "김철수" });
    expect(nameMismatchOf(false, null, "김철수")).toBeUndefined();
    expect(nameMismatchOf(true, "홍길동", "홍길동")).toBeUndefined();
    expect(nameMismatchOf(false, "홍길동", "John")).toBeUndefined();
  });
});
