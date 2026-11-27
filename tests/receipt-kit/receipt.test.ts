import { describe, expect, it } from "./vitest-shim";
import { parseReceipt, parsedComplete, receiptHasName, receiptStudentName, normalizeReceiptText, readEnoughFor } from "@/lib/receipt/receipt";
import { card } from "./fixtures";

describe("기본 — 문풀반 주 4일 저녁 현장", () => {
  const p = parseReceipt(card());
  it("판정 키를 다 읽는다", () => {
    expect(p.gates).toEqual({ academy: true, brand: true });
    expect(p.brandExact).toBe(true);
    expect(p.card).toBe(true);
    expect(p.kind).toBe("full");
    expect(p.level).toBe(750);
    expect(p.program).toBe("score");
    expect(p.track).toBe("w4");
    expect(p.twoMonth).toBe(false);
    expect(p.time?.timeBlock).toBe("18:00~20:10");
    expect(p.courseMonth).toBe(12);
    expect(p.startMonth).toBe(12);
    expect(p.weeks).toBe(4);
    expect(p.mode).toBe("onsite");
    expect(p.modeEvidence).toBe("room");
    expect(p.capturedOn).toBe("2026-11-24");
    expect(p.capturedAt).toBe("2026-11-24T19:01:58");
    expect(parsedComplete(p)).toBe(true);
  });
  it("캡처 시각은 수강월 날짜에 들어가지 않는다 (11월 캡처 · 12월 과정)", () => {
    expect(p.months).toEqual([]);
  });
  it("수강생 칸 이름 대조", () => {
    expect(receiptHasName(p.text, "홍길동")).toBe(true);
    expect(receiptHasName(p.text, "홍 길 동")).toBe(true);
    expect(receiptHasName(p.text, "홍길")).toBe(false);
    expect(receiptStudentName(p.text)).toBe("홍길동");
  });
  it("강사 줄의 이름은 학생 이름을 대신 채우지 못한다", () => {
    expect(receiptHasName(p.text, "김지민")).toBe(false);
  });
});

describe("수강 방식", () => {
  it("강의실 `온라인 강의` = 불라방", () => {
    const p = parseReceipt(card({ room: "온라인 강의", days: "[4주-12/01] 월화수목 (월16회 라이브방송)" }));
    expect(p.mode).toBe("live");
    expect(p.modeEvidence).toBe("online");
    expect(p.track).toBe("w4");
  });
  it("강의실 칸을 못 읽고 `라이브방송` 만 있으면 불라방으로 보되 짐작(live)", () => {
    const p = parseReceipt(card({ room: "", days: "[4주-12/01] 월화수목 (월16회 라이브방송)" }));
    expect(p.mode).toBe("live");
    expect(p.modeEvidence).toBe("live");
    expect(parsedComplete(p)).toBe(false);
  });
  it("아무것도 못 읽으면 현장 기본값 (근거 없음)", () => {
    const p = parseReceipt(card({ room: "" }));
    expect(p.mode).toBe("onsite");
    expect(p.modeEvidence).toBeNull();
  });
});

describe("종합 / 단과 · 레벨 · 속성반", () => {
  it("LC 단과 650", () => {
    const p = parseReceipt(card({ title: "[LC]", goal: "650 목표", level: "650+", time: "11:10~12:10" }));
    expect(p.kind).toBe("lc");
    expect(p.level).toBe(650);
  });
  it("RC 단과 — 꺾쇠가 괄호로 읽혀도", () => {
    const p = parseReceipt(card({ title: "(RC]", goal: "750 목표", time: "12:20~13:20" }));
    expect(p.kind).toBe("rc");
  });
  it("한국어 모델이 읽은 꼴 — 브랜드 뒤 꺾쇠의 `ㄴㅇ` = LC · `80` = RC", () => {
    expect(parseReceipt(card({ title: "[ㄴㅇ]", goal: "650 목표", level: "650+", time: "11:10~12:10" })).kind).toBe("lc");
    expect(parseReceipt(card({ title: "[80]", time: "12:20~13:20" })).kind).toBe("rc");
    expect(parseReceipt(card({ title: "[[ㅇ]" })).kind).toBeNull();
  });
  it("종합 · 단과 표기를 못 읽으면 null (경고)", () => {
    const p = parseReceipt(card({ title: "" }));
    expect(p.kind).toBeNull();
    expect(p.warnings.some((w) => w.includes("종합반 / LC / RC"))).toBe(true);
  });
  it("속성반 — 강의레벨 `실전속성` · `프리미어반`", () => {
    const p = parseReceipt(card({ level: "실전속성", days: "[4주-12/01] 월화수목 (월16회) 프리미어반", time: "10:00~13:20" }));
    expect(p.program).toBe("premier");
    expect(p.courseLevel).toBe(750);
    expect(p.level).toBe(750);
  });
  it("속성반 레벨 숫자를 못 읽어도 과정명으로 750", () => {
    const p = parseReceipt(card({ goal: "목표", level: "실전속성", days: "[4주-12/01] 월화수목 (월16회) 프리미어반", time: "10:00~13:20" }));
    expect(p.level).toBe(750);
    expect(p.warnings.some((w) => w.includes("과정명으로 750"))).toBe(true);
  });
  it("금액의 세 자리 묶음은 레벨이 아니다", () => {
    const p = parseReceipt(card({ goal: "목표", level: "", extra: "수강료 _ 650,000원" }));
    expect(p.level).toBeNull();
  });
  it("벨라토익 레벨이 아닌 숫자(850)는 레벨로 받지 않는다", () => {
    const p = parseReceipt(card({ goal: "850 목표", level: "850+" }));
    expect(p.level).toBeNull();
    expect(p.warnings.some((w) => w.includes("850"))).toBe(true);
  });
  it("둥근 글꼴의 7 (두 칸 모두 150 꼴) → 750", () => {
    const p = parseReceipt(card({ goal: '"150 목표', level: "디50+" }));
    expect(p.level).toBe(750);
  });
});

describe("요일 — 회차 먼저, 격일은 요일 글자 그대로", () => {
  it("격일 월수 (월8회) — 2개월 과정", () => {
    const p = parseReceipt(card({ days: "[4주-12/01] 월수 (월8회)" }));
    expect(p.track).toBe("mw");
    expect(p.twoMonth).toBe(true);
  });
  it("격일 화목", () => {
    expect(parseReceipt(card({ days: "[4주-12/02] 화목 (월8회)" })).track).toBe("tt");
  });
  it("월수 · 화목이 함께 읽히면 모른다", () => {
    const p = parseReceipt(card({ days: "월수 (월8회) 화목" }));
    expect(p.track).toBeNull();
  });
  it("월16회 와 월8회 가 함께면 모른다", () => {
    expect(parseReceipt(card({ days: "월화수목 (월16회) 월8회" })).track).toBeNull();
  });
  it("회차를 못 읽어도 `월화수목` 한 글자 오인식이면 주 4일", () => {
    expect(parseReceipt(card({ days: "[4주-12/01] 월화수폭" })).track).toBe("w4");
  });
  it("`월수금`(다른 강좌 표기)은 격일 월수가 아니다", () => {
    expect(parseReceipt(card({ days: "[4주-12/01] 월수금" })).track).toBeNull();
  });
});

describe("게이트 · 브랜드", () => {
  it("한 글자 오인식은 게이트를 지나되, 강사 칸이 없으면 자동 승인용 `brandExact` 는 아니다", () => {
    const p = parseReceipt(card().replace("벨라토익", "벨라토의").replace("강사 _ 벨라(김지민)", "강사 _ 홍강사"));
    expect(p.gates.brand).toBe(true);
    expect(p.brandExact).toBe(false);
  });
  it("실물(2026-11-25): 제목 첫 글자를 `렐`·`켈`·`킬`로 읽어도 강사 칸이 정확히 `벨라(김지민)`이면 그대로 읽은 것으로 본다", () => {
    for (const misread of ["렐라토익", "켈라토익", "킬라토익"]) {
      const p = parseReceipt(card().replace("벨라토익", misread));
      expect(p.brandExact).toBe(true);
    }
    // 두 글자 이상 틀리면 강사 칸이 있어도 아니다
    expect(parseReceipt(card().replace("벨라토익", "켈라토의")).brandExact).toBe(false);
    // 강사 칸이 다른 강사면 아니다
    expect(parseReceipt(card().replace("벨라토익", "렐라토익").replace("벨라(김지민)", "김벨라(홍길동)")).brandExact).toBe(false);
  });
  it("다른 강좌 수강증 — 브랜드도 강사명도 없으면 G2 탈락", () => {
    const p = parseReceipt(card().replace("벨라토익", "샘플토익").replace("벨라(김지민)", "홍강사"));
    expect(p.gates.brand).toBe(false);
  });
  it("카톡 대화 같은 다른 화면 — 센터 줄이 없으면 G1 탈락", () => {
    const p = parseReceipt("선생님 수강증 보내드려요\n벨라토익 12월\n감사합니다");
    expect(p.gates.academy).toBe(false);
    expect(p.card).toBe(false);
  });
});

describe("OCR 이 흔히 틀리는 꼴", () => {
  it("시각 구분자 · 범위 구분자", () => {
    expect(normalizeReceiptText("수강시간 18;00 - 20.10").compact).toBe("수강시간18:00~20:10");
  });
  it("날짜는 시각으로 고치지 않는다", () => {
    expect(normalizeReceiptText("2026.12.01").compact).toBe("2026.12.01");
  });
  it("라벨 한 글자 오인식 `수갈생`", () => {
    const text = card().replace("수강생", "수갈생");
    expect(receiptHasName(text, "홍길동")).toBe(true);
    expect(parseReceipt(text).card).toBe(true);
  });
  it("둥근 글꼴 — 수남생 · 수남센터 · 수남시반 · 감의실 · 받침 빠진 브랜드", () => {
    const text = card()
      .replace("수강생", "수남생")
      .replace("수강센터", "수남센터")
      .replace("수강시간", "수남시반")
      .replace("강의실", "감의실")
      .replace("벨라토익", "베라토이");
    const p = parseReceipt(text);
    expect(p.card).toBe(true);
    expect(p.brandExact).toBe(true);
    expect(p.modeEvidence).toBe("room");
    expect(p.time?.timeBlock).toBe("18:00~20:10");
  });
  it("배지 `월` 이 `뭘` 로 읽혀도 수강월", () => {
    expect(parseReceipt(card({ month: "12뭘 과정" })).courseMonth).toBe(12);
  });
  it("`2개월 과정` 은 배지가 아니다", () => {
    expect(parseReceipt(card({ month: "2개월 과정" })).courseMonth).toBeNull();
  });
  it("배지를 못 읽으면 수강요일 줄의 개강일 달", () => {
    const p = parseReceipt(card({ month: "", days: "[4주-12/01] 월화수목 (월16회)" }));
    expect(p.courseMonth).toBeNull();
    expect(p.startMonth).toBe(12);
  });
  it("앞달 말 개강(22일 이후)은 다음 달 과정 — 12월반 11/30 개강, 1월반 12/28 개강", () => {
    expect(parseReceipt(card({ month: "", days: "[4주-11/30] 월화수목 (월16회)" })).startMonth).toBe(12);
    expect(parseReceipt(card({ month: "", days: "[4주-12/28] 월화수목 (월16회)" })).startMonth).toBe(1);
    expect(parseReceipt(card({ month: "", days: "[4주-12/07] 월화수목 (월16회)" })).startMonth).toBe(12);
  });
  it("수강시간 칸 밖에 시간이 여럿이면 칸의 값만 쓴다", () => {
    const p = parseReceipt(card({ extra: "다음 특강 10:00~12:00" }));
    expect(p.time?.timeBlock).toBe("18:00~20:10");
  });
});

describe("readEnoughFor — 이름까지 읽혀야 멈춘다", () => {
  it("이름이 다르면 더 읽는다", () => {
    expect(readEnoughFor("홍길동")(card())).toBe(true);
    expect(readEnoughFor("김철수")(card())).toBe(false);
  });
});
