/**
 * 수강증 글자 판독기 — OCR 이 뽑은 원문에서 **판정에 쓰는 키**를 읽는다. 순수 함수만 둔다 (DB · 엔진 없음).
 *
 * 읽는 것: 센터 · 브랜드 · 카드 칸 · 이름 · 종합/단과 · 레벨 · 속성반 · 요일(트랙) · 시간 · 수강월 · 수강 방식 · 캡처 시각.
 * 표기 값은 `config.ts` 한 곳에 있다. 규칙을 바꾸면 `test/receipt.test.ts` 도 같이 고친다.
 *
 * 원칙 (같은 YBM 서면센터의 다른 강사 사이트에서 실물 수강증 수백 장으로 다듬은 것):
 *  - 한 글자 오인식에 무너지지 않게 키워드는 **편집거리 ≤ 1** 로 찾는다. 다만 숫자가 든 낱말(`월16회`)은 그대로 찾는다.
 *  - **카드 칸의 값**을 먼저 본다 — 화면의 광고 배너 · 메뉴 글자가 반을 정하지 못하게.
 *  - 캡처 시각(`현재시간`)은 **수강월이 아니다** — 11월 25일에 12월 강좌를 캡처하면 날짜는 11월이다.
 *  - 못 읽은 것은 null 로 두고 warnings 에 까닭을 남긴다. 짐작으로 채우지 않는다.
 */
import { RECEIPT } from "./config";

export type Track = "w4" | "mw" | "tt";
export type Kind = "full" | "lc" | "rc";
export type Program = "score" | "premier";
export type EnrollMode = "onsite" | "live";

export const TRACK_LABEL: Record<Track, string> = { w4: "월화수목", mw: "월수", tt: "화목" };
export const KIND_LABEL: Record<Kind, string> = { full: "종합반", lc: "LC 단과", rc: "RC 단과" };
/** 격일반 2개월 과정의 둘째 달 요일 — 월수 ↔ 화목 */
export const otherAlternate = (t: Track): Track | null => (t === "mw" ? "tt" : t === "tt" ? "mw" : null);

export type ReceiptTime = { start: string; end: string; minutes: number; /** 반의 timeBlock 과 같은 꼴 "18:00~20:10" */ timeBlock: string };

export type ParsedReceipt = {
  /** 정규화한 원문 (줄바꿈 유지) */
  text: string;
  /** 공백을 뺀 원문 — 키워드 검색용 */
  compact: string;
  /** G1 = 서면센터 수강증 · G2 = 벨라토익(한 글자 오인식 · 강사명 허용) */
  gates: { academy: boolean; brand: boolean };
  mode: EnrollMode;
  /**
   * 수강 방식을 무엇을 보고 정했나 — `online` = 강의실 칸의 `온라인 강의` · `room` = 강의실 칸의 호실(`801호`) ·
   * `live` = 칸은 못 읽었는데 `라이브방송` 같은 글자가 어딘가에 있음 · null = 아무것도 못 읽어 기본값(현장).
   * **자동 승인은 강의실 칸을 읽었을 때(online · room)만** — 불라방 학생이 현장으로 들어가면 교재 택배 · 라이브 안내가 막힌다.
   */
  modeEvidence: "online" | "room" | "live" | null;
  /** 카드 칸 라벨(수강생 · 수강센터 · 수강시간)이 다 보이나 — 카드가 없는 화면의 글자로 반을 정하지 않는다 */
  card: boolean;
  /** `벨라토익` 글자를 그대로 읽었나 — 비슷한 이름의 다른 강좌가 시간만 맞아 자동으로 붙지 않게 */
  brandExact: boolean;
  /** 종합반 · LC 단과 · RC 단과. 못 읽었거나 둘 이상 읽혔으면 null */
  kind: Kind | null;
  /** 요일 — 주 4일(월화수목) · 격일 월수 · 격일 화목. 못 읽었거나 엇갈리면 null */
  track: Track | null;
  /** 격일반 2개월 과정인가 (config.alternateDayMonths) — 둘째 달은 반대 요일 반에 배정한다 */
  twoMonth: boolean;
  /** 카드에 적힌 레벨 숫자들 (보통 하나) */
  levels: number[];
  level: number | null;
  /** 과정명이 말하는 레벨 (`실전속성` = 750). 숫자와 다르면 자동 승인하지 않는다 */
  courseLevel: number | null;
  /** score = 시작반 · 문풀반 · 단과, premier = 속성반(프리미어반) */
  program: Program;
  /** 수강요일 줄의 기간 숫자 `[4주-12/01]` → 4. 또렷이 하나일 때만 */
  weeks: number | null;
  times: ReceiptTime[];
  /** 수강시간 칸의 시간 (칸을 못 읽었으면 시간이 하나뿐일 때만) */
  time: ReceiptTime | null;
  /** 원문의 연·월 날짜들 (캡처 시각 뺌) — 배지 · 개강일을 못 읽었을 때만 쓴다 */
  months: { year: number; month: number }[];
  /** 배지 `12월 과정` 의 달 — 수강월의 1순위 신호 */
  courseMonth: number | null;
  /** 수강요일 줄 `[4주-12/01]` 의 개강일 달 — 배지를 못 읽었을 때의 수강월 */
  startMonth: number | null;
  /** 캡처 날짜 `현재시간 2026-11-24 …` → "2026-11-24" */
  capturedOn: string | null;
  /** 캡처 시각 초까지 "2026-11-24T19:01:58" — 다른 계정과 같은 초면 한쪽이 복사본이다 */
  capturedAt: string | null;
  /** 참고용 (판정에 쓰지 않는다) */
  tuition: number | null;
  warnings: string[];
};

/* ─── 문자열 도구 ────────────────────────────────────────────────────────── */

/** 편집거리 (레벤슈타인). 한글은 음절 하나가 글자 하나라 오인식 한 음절 = 거리 1 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** hay 안에 needle 이 편집거리 maxDist 이내로 들어 있나 (`벨라토익` ↔ `벨라토의` · `밸라토익`) */
export function fuzzyIncludes(hay: string, needle: string, maxDist = 1): boolean {
  if (!needle) return false;
  if (hay.includes(needle)) return true;
  if (maxDist <= 0) return false;
  const n = needle.length;
  for (let len = Math.max(1, n - maxDist); len <= n + maxDist; len++) {
    for (let i = 0; i + len <= hay.length; i++) if (levenshtein(hay.slice(i, i + len), needle) <= maxDist) return true;
  }
  return false;
}

/** 받침을 뗀 글자 — 둥근 글꼴로 바꾼 휴대폰 화면은 받침이 흐려 OCR 이 떨어뜨린다 (`벨라토익` → `베라토이`) */
export function dropFinals(s: string): string {
  return s.replace(/[가-힣]/g, (ch) => {
    const code = ch.charCodeAt(0) - 0xac00;
    return String.fromCharCode(0xac00 + code - (code % 28));
  });
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/*
 * 휴대폰 글꼴을 바꾼 화면 — 둥근 글꼴은 어느 전처리로 읽어도 같은 자리가 같은 꼴로 비틀렸다:
 * `강` → `남` · `감`, `시간` → `시반`, PC 화면 글꼴은 `수강시간` → `수강신관`, `7` → `1` · `]` · `디`.
 * 그래서 **판정에 쓰는 칸 라벨 · 레벨 숫자만** 이 꼴들을 봐준다. 이름은 봐주지 않는다.
 */
const GANG = "[강남감]";
const SIGAN = "(?:시[간반가]|신관)";
const STUDY_TIME_LABEL = new RegExp(`수${GANG}${SIGAN}`);
const ROOM_LABEL = new RegExp(`${GANG}의실`, "g");
/** `ㄱ` 은 정규화(NFKC) 뒤 조합용 자모 U+1100 이 된다 — 두 꼴 다 */
const SEVEN_LOOKALIKE = String.raw`(?:[1\]|lIㄱ\u1100]|디)`;
const TITLE_SEVEN = new RegExp(String.raw`(?<![\d:,])${SEVEN_LOOKALIKE}50(?=목표)`);
const FIELD_SEVEN = new RegExp(String.raw`레벨[^\d가-힣]{0,3}${SEVEN_LOOKALIKE}50(?=\+)`);

/**
 * 정규화 — 전각 → 반각(NFKC), 숫자 사이의 시각 구분자 `. ; ：` → `:`, 시각 사이의 범위 구분자 `- – — ～` → `~`.
 * 시각의 앞자리가 더 긴 숫자 · 날짜의 일부면 건드리지 않는다 (`2026.12.01` 을 `2026:12.01` 로 망가뜨리지 않게).
 */
export function normalizeReceiptText(raw: string): { text: string; compact: string } {
  let t = (raw ?? "").normalize("NFKC").replace(/\r\n?/g, "\n");
  t = t.replace(/(?<!\d)(?<!\d\.)(\d{1,2})\s*[.;:]\s*(\d{2})(?!\d)/g, "$1:$2");
  t = t.replace(/(\d{1,2}:\d{2})\s*[-–—~～]\s*(\d{1,2}:\d{2})/g, "$1~$2");
  return { text: t, compact: t.replace(/\s+/g, "") };
}

/* ─── 게이트 ─────────────────────────────────────────────────────────────── */

/** G1: 서면센터 수강증인가 — 지역(서면 · 부산) + (`수강센터` 라벨 또는 `YBM`). 지역 낱말만 보면 아무 문서나 통과해서 둘 다 본다 */
export function passesAcademyGate(compact: string): boolean {
  const place = RECEIPT.academyPlaces.some((p) => compact.includes(p));
  const academy = compact.toUpperCase().includes(RECEIPT.academy) || fuzzyIncludes(compact, RECEIPT.academyLabel, 1);
  return place && academy;
}

/** G2: 벨라토익(편집거리 ≤ 1) 또는 강사명 — 덜 거절하려고 너그럽다. 자동 승인은 `brandExact` 가 따로 본다 */
export function passesBrandGate(compact: string): boolean {
  return fuzzyIncludes(compact, RECEIPT.brand, 1) || RECEIPT.instructors.some((n) => compact.includes(n));
}

/* ─── 이름 (G3) ──────────────────────────────────────────────────────────── */

function nameLetters(s: string, hangulOnly: boolean): string {
  const t = (s ?? "").normalize("NFKC");
  return hangulOnly ? t.replace(/[^가-힣]/g, "") : t.replace(/[^\p{L}]/gu, "").toLowerCase();
}

/** 칸 라벨의 첫머리 — 값이 다음 줄로 내려갔을 때 그 줄이 라벨이면 값이 아니다 */
const RECEIPT_LABEL_LINE = /^(수강|강사|레벨|강의실)/;
/** `생` 을 잘못 읽은 글자 */
const SAENG_LOOKALIKES = "샘셍싱섕";

/**
 * 줄에서 `수강생` 라벨이 끝나는 자리 (없으면 -1). 줄 첫머리의 한 글자 오인식(`수갈생` · `수강샘`)은 봐준다.
 * `수험생` · `수강센터` · `수강시간` 같은 다른 낱말은 여기 들지 않는다.
 */
function studentLabelEnd(line: string): number {
  const at = line.indexOf("수강생");
  if (at >= 0) return at + 3;
  const lead = line.length - line.replace(/^[^가-힣]+/, "").length;
  const head = line.slice(lead, lead + 3);
  if (head.length !== 3 || head[0] !== "수") return -1;
  const middleMisread = head[2] === "생" && head !== "수험생";
  const lastMisread = head[1] === "강" && SAENG_LOOKALIKES.includes(head[2]);
  return middleMisread || lastMisread ? lead + 3 : -1;
}

function studentValues(text: string, hangulOnly: boolean): string[] {
  const lines = (text ?? "").normalize("NFKC").split("\n").map((l) => l.replace(/\s+/g, ""));
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const end = studentLabelEnd(lines[i]);
    if (end < 0) continue;
    let value = nameLetters(lines[i].slice(end), hangulOnly);
    if (!value && i + 1 < lines.length && !RECEIPT_LABEL_LINE.test(lines[i + 1])) value = nameLetters(lines[i + 1], hangulOnly);
    out.push(value);
  }
  return out;
}

/**
 * G3: 가입 실명이 **`수강생` 칸의 값**과 같은가 (공백 무시 · 정확 일치 — 두세 글자 이름에 편집거리를 주면 동명이인이 섞인다).
 * 원문 어딘가에 들어 있는지로 보지 않는다 — 강사 줄 `김지민` · 메뉴 글자 `최근 본 강의` 가 이름을 대신 채운다.
 * 값 뒤에 다음 칸 라벨이 붙어 읽혔으면(`홍길동수강센터…`) 이름까지만 본다.
 */
export function receiptHasName(text: string, name: string | null | undefined): boolean {
  const raw = (name ?? "").normalize("NFKC").replace(/\s+/g, "");
  const hangulOnly = /^[가-힣]+$/.test(raw);
  const want = nameLetters(raw, hangulOnly);
  if (want.length < 2) return false;
  return studentValues(text, hangulOnly).some((v) => v === want || (v.startsWith(want) && RECEIPT_LABEL_LINE.test(v.slice(want.length))));
}

const NEXT_LABEL = /수강센터|수강요일|수강시간|수강료|강사|레벨|강의실/;

/** `수강생` 칸에 적힌 이름 (한글 2~5자로 또렷할 때만) — 이름이 다를 때 학생에게 보여 주는 데만 쓴다. 판정은 `receiptHasName` */
export function receiptStudentName(text: string): string | null {
  const counts = new Map<string, number>();
  for (let value of studentValues(text, true)) {
    const cut = value.search(NEXT_LABEL);
    if (cut > 0) value = value.slice(0, cut);
    if (value.length >= 2 && value.length <= 5) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | null = null;
  let most = 0;
  for (const [v, c] of counts) if (c > most) [best, most] = [v, c];
  return best;
}

/* ─── 칸 판독 ────────────────────────────────────────────────────────────── */

function parseTimes(compact: string): ReceiptTime[] {
  const out: ReceiptTime[] = [];
  const seen = new Set<string>();
  for (const m of compact.matchAll(/(\d{1,2}):(\d{2})~(\d{1,2}):(\d{2})/g)) {
    const [sh, sm, eh, em] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (sh > 23 || eh > 23 || sm > 59 || em > 59) continue;
    const start = `${pad2(sh)}:${pad2(sm)}`;
    const end = `${pad2(eh)}:${pad2(em)}`;
    const minutes = eh * 60 + em - (sh * 60 + sm);
    if (minutes <= 0) continue;
    const timeBlock = `${start}~${end}`;
    if (seen.has(timeBlock)) continue;
    seen.add(timeBlock);
    out.push({ start, end, minutes, timeBlock });
  }
  return out;
}

const LEVEL_ALT = String.raw`\d{3}`;

/**
 * 레벨 — **카드 칸의 숫자가 먼저** (`750 목표` · `레벨 750+`). 칸에서 읽은 숫자가 있으면 그것만 쓴다 —
 * 칸 밖 숫자(배너의 `550+` · 금액 `650,000원`)가 레벨을 흔들지 못하게. 칸에서 못 읽었으면 둥근 글꼴의 7(`150` 꼴, 두 칸 모두일 때만),
 * 그다음 원문 전체에서 벨라토익 레벨 숫자를 찾는다. `foreign` = 칸에 적힌 숫자가 벨라토익 레벨이 아니다 (다른 레벨 강좌 수강증)
 */
function parseLevels(compact: string): { levels: number[]; font7: boolean; foreign: number[] } {
  const fielded = new Set<number>();
  for (const m of compact.matchAll(new RegExp(String.raw`(?<![\d:,])(${LEVEL_ALT})(?=목표)`, "g"))) fielded.add(Number(m[1]));
  for (const m of compact.matchAll(new RegExp(String.raw`레벨[^\d가-힣]{0,3}(${LEVEL_ALT})(?![\d:,원])`, "g"))) fielded.add(Number(m[1]));
  const known = RECEIPT.levels.filter((l) => fielded.has(l));
  const foreign = [...fielded].filter((l) => l >= 300 && l <= 990 && l % 50 === 0 && !RECEIPT.levels.includes(l));
  if (known.length > 0 || foreign.length > 0) return { levels: known, font7: false, foreign };
  if (RECEIPT.levels.includes(750) && TITLE_SEVEN.test(compact) && FIELD_SEVEN.test(compact)) return { levels: [750], font7: true, foreign: [] };
  const any = new Set<number>();
  for (const m of compact.matchAll(new RegExp(String.raw`(?<![\d:,])(${RECEIPT.levels.join("|")})(?![\d:,원])`, "g"))) any.add(Number(m[1]));
  return { levels: RECEIPT.levels.filter((l) => any.has(l)), font7: false, foreign: [] };
}

/** 수강요일 줄의 기간 숫자 `[4주-12/01]` → 4. 또렷이 읽은 숫자가 하나일 때만 */
export function parsePeriodWeeks(compact: string): { weeks: number | null; conflict: boolean } {
  const digits = new Set([...compact.matchAll(/(?<!\d)(\d)주[-~]\d/g)].map((m) => Number(m[1])));
  if (digits.size === 1) return { weeks: [...digits][0], conflict: false };
  return { weeks: null, conflict: digits.size > 1 };
}

/** 원문의 `YYYY-MM-DD` · `YYYY.MM.DD` · `YYYY년 M월` 날짜들의 (연 · 월). 뒤에 구분자가 오는 것만 센다 (금액 · 번호 오독 방지) */
export function parseReceiptMonths(text: string): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]/g)) {
    const [year, month] = [Number(m[1]), Number(m[2])];
    if (year < 2020 || year > 2100 || month < 1 || month > 12) continue;
    const key = `${year}-${month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ year, month });
  }
  return out;
}

/** 배지 `12월 과정` → 12. PC 화면에서는 `월` 이 `뭘` 로 자주 읽힌다. `2개월 과정` 은 배지가 아니다 */
export function parseCourseMonth(text: string): number | null {
  const m = text.match(/(\d{1,2})\s*[월뭘]\s*과정/);
  if (!m) return null;
  const month = Number(m[1]);
  return month >= 1 && month <= 12 ? month : null;
}

/** 수강요일 줄 `[4주-12/01]` 의 개강일 달. 꺾쇠까지 읽힌 `주-12?01]` 꼴(숫자 · `/` 오인식)도 본다 */
export function parseStartMonth(compact: string): number | null {
  const m = compact.match(/\d주[-~](\d{1,2})[/.:](\d{1,2})(?!\d)/) ?? compact.match(/주[-~](\d{2})[/.:17lI|]?(\d{2})\]/);
  if (!m) return null;
  const [month, day] = [Number(m[1]), Number(m[2])];
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  // 벨라토익: 앞달 말에 개강하는 달이 있어요(예: 12월반 11/30 개강) → 22일 이후 개강은 다음 달 과정
  return day >= 22 ? (month % 12) + 1 : month;
}

/** `현재시간` 라벨 — `현재` 만 맞으면 라벨로 본다 (`현재산 2026-…` 처럼 `시간` 이 뭉개진다) */
const NOW_LABEL = String.raw`현재[^\d\n]{0,6}`;
const YMD = String.raw`(\d{4})[-./](\d{1,2})[-./](\d{1,2})`;
const CAPTURED_ON = new RegExp(`${NOW_LABEL}${YMD}`);
const CAPTURED_AT = new RegExp(`${NOW_LABEL}${YMD}[^\\d]{0,4}(\\d{1,2})[:.](\\d{2})[:.](\\d{2})`);
const CAPTURE_STAMP = new RegExp(`${NOW_LABEL}\\d{4}[-./]\\d{1,2}[-./]\\d{1,2}|\\d{4}[-./]\\d{1,2}[-./]\\d{1,2}[^\\d\\n]{0,3}\\d{1,2}[:.]\\d{2}[:.]\\d{2}`, "g");

function ymd(y: number, mo: number, d: number): string | null {
  if (y < 2020 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

export function parseCapturedOn(text: string): string | null {
  const m = text.match(CAPTURED_ON) ?? text.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return m ? ymd(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

/** 초까지 읽혔을 때만 — 분까지로는 남과 겹칠 수 있다 */
export function parseCapturedAt(text: string): string | null {
  const m = text.match(CAPTURED_AT);
  if (!m) return null;
  const day = ymd(Number(m[1]), Number(m[2]), Number(m[3]));
  const [h, mi, se] = [Number(m[4]), Number(m[5]), Number(m[6])];
  if (!day || h > 23 || mi > 59 || se > 59) return null;
  return `${day}T${[h, mi, se].map(pad2).join(":")}`;
}

/** 수강증이 말하는 수강월 — 배지 → 개강일 달. 캡처 시각은 쓰지 않는다. 판정과 반 대조가 같은 값을 본다 */
export function receiptCourseMonth(p: Pick<ParsedReceipt, "courseMonth" | "startMonth">): number | null {
  return p.courseMonth ?? p.startMonth ?? null;
}

function parseTuition(compact: string): number | null {
  const m = compact.match(/(\d{1,3}(?:,\d{3})+|\d{5,})원/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

const CARD_LABELS = ["수강생", "수강센터", "수강시간"] as const;

/** 강의실 칸의 값이 `온라인 강의` 인가 — 라벨 바로 뒤만 본다 (한 글자 오인식 허용) */
function roomValueIsOnline(compact: string): boolean {
  for (const m of compact.matchAll(ROOM_LABEL)) {
    const at = (m.index ?? 0) + m[0].length;
    if (fuzzyIncludes(compact.slice(at, at + 8), RECEIPT.online, 1)) return true;
  }
  return false;
}

/**
 * 종합 / 단과 — 강좌명 `[종합반]` · `[LC]` · `[RC]`. 꺾쇠가 괄호 · 막대로 읽혀도 받는다.
 * 하나만 읽혔을 때만 정한다. 둘 이상이면 null (경고) — 반 대조는 시간 · 레벨로 이어 가되 자동 승인하지 않는다.
 */
function parseKind(compact: string): { kind: Kind | null; found: Kind[] } {
  const upper = compact.toUpperCase();
  const word = (w: string) => new RegExp(String.raw`[\[(|]${w}|${w}[\])|]`).test(upper);
  const found = new Set<Kind>();
  if (compact.includes(RECEIPT.kindWords.full)) found.add("full");
  if (word(RECEIPT.kindWords.lc)) found.add("lc");
  if (word(RECEIPT.kindWords.rc)) found.add("rc");
  // 한국어 모델이 영문을 한글 · 숫자로 읽은 꼴 — **브랜드 바로 뒤 꺾쇠 안**에서만 본다 (`벨라토익 [ㄴㅇ]` = LC · `[80]` = RC, 실측).
  // 틀리게 읽어도 오배정은 없다: 지금 시간표는 레벨 · 시간이 같으면 종합 · LC · RC 가 겹치지 않아, 틀린 종류면 "맞는 반 없음" 으로 검토에 간다
  if (found.size === 0) {
    const token = compact.match(/라토.?\[+([^\]\[]{1,4})\]/)?.[1]?.toUpperCase();
    // 정규화(NFKC)가 낱자 `ㄴ` · `ㅇ` · `ㄷ` 을 조합용 자모(U+1102 · U+110B · U+1103)로 바꾸므로 두 꼴을 다 받는다
    const C = "CㅇㄷO0\u110B\u1103\u11BC";
    if (token && new RegExp(`^[Lㄴ|\u1102\u11AB][${C}]$`).test(token)) found.add("lc");
    else if (token && new RegExp(`^[R8][${C}]$`).test(token)) found.add("rc");
  }
  const list = [...found];
  return { kind: list.length === 1 ? list[0] : null, found: list };
}

/**
 * 요일(트랙) — **회차 표기가 1순위** (`월16회` = 주 4일 · `월8회` = 격일). 숫자라 또렷하게 읽힌다.
 * 격일은 요일 글자(`월수` · `화목`)로 가른다 — 두 글자 낱말이라 편집거리 없이 그대로 찾는다 (`월?` 아무거나 걸리지 않게).
 * `월화수목` 안에는 `월수` · `화목` 이 들어 있지 않다. `월수금` · `화목금`(다른 강좌 표기)은 격일이 아니다.
 */
function parseTrack(compact: string, warnings: string[]): Track | null {
  const has16 = compact.includes(RECEIPT.sessions.w4);
  const has8 = compact.includes(RECEIPT.sessions.alt);
  const w4 = fuzzyIncludes(compact, RECEIPT.days.w4, 1);
  const mw = new RegExp(`${RECEIPT.days.mw}(?!금)`).test(compact);
  const tt = new RegExp(`${RECEIPT.days.tt}(?!금)`).test(compact);
  if (has16 && has8) {
    warnings.push("월16회(주 4일)와 월8회(격일)가 함께 읽혔어요");
    return null;
  }
  if (has16) return "w4";
  const alternate = (): Track | null => {
    if (mw && tt) {
      warnings.push("월수 · 화목이 함께 읽혀 첫 달 요일을 모르겠어요");
      return null;
    }
    return mw ? "mw" : tt ? "tt" : null;
  };
  if (has8) {
    const t = alternate();
    if (!t && !(mw && tt)) warnings.push("격일(월8회)인데 요일(월수/화목)을 못 읽었어요");
    return t;
  }
  if (w4 && (mw || tt)) {
    warnings.push("주 4일과 격일 요일이 함께 읽혔어요");
    return null;
  }
  if (w4) return "w4";
  const t = alternate();
  if (!t && !(mw && tt)) warnings.push("요일(월화수목/월수/화목)을 찾지 못했어요");
  return t;
}

/* ─── 판독 ───────────────────────────────────────────────────────────────── */

export function parseReceipt(raw: string): ParsedReceipt {
  const { text, compact } = normalizeReceiptText(raw);
  const warnings: string[] = [];

  const gates = { academy: passesAcademyGate(compact), brand: passesBrandGate(compact) };
  if (!gates.academy) warnings.push("수강센터(부산 서면센터) 줄을 찾지 못했어요");
  if (!gates.brand) warnings.push("벨라토익 또는 강사명을 찾지 못했어요");

  // 수강 방식 — 강의실 칸의 값이 먼저. 칸 밖의 `라이브방송` · `온라인 강의` 글자로 정한 것은 짐작(live)이라 자동 승인하지 않는다
  const online = roomValueIsOnline(compact);
  const room = new RegExp(String.raw`${GANG}의실.{0,8}?\d{3,4}호`).test(compact);
  const liveWords = fuzzyIncludes(compact, RECEIPT.live, 1) || fuzzyIncludes(compact, RECEIPT.online, 1);
  const modeEvidence: ParsedReceipt["modeEvidence"] = online ? "online" : room ? "room" : liveWords ? "live" : null;
  const mode: EnrollMode = modeEvidence === "online" || modeEvidence === "live" ? "live" : "onsite";
  if (!modeEvidence) warnings.push("강의실(온라인 강의/호실)을 못 읽어 수강 방식을 현장으로 두었어요");
  else if (modeEvidence === "live") warnings.push("강의실 칸을 못 읽어 칸 밖의 글자로 불라방으로 봤어요");

  const card =
    text.split("\n").some((l) => studentLabelEnd(l.replace(/\s+/g, "")) >= 0) &&
    CARD_LABELS.filter((l) => l !== "수강생").every((l) => fuzzyIncludes(compact, l, 1) || (l === "수강시간" && STUDY_TIME_LABEL.test(compact)));
  if (!card) warnings.push(`수강증 카드의 칸(${CARD_LABELS.join("·")})이 다 보이지 않아요`);

  // 벨라토익 실물 수강증 8장(2026-11-25): 큰 제목의 첫 글자를 `렐`·`켈`·`킬`로 자주 틀리게 읽고, 바로 아래 `강사 벨라(김지민)` 칸은 8장 모두 정확했다.
  // 그래서 제목이 한 글자만 다르면 **강사 칸이 정확히 벨라(김지민)일 때만** 그대로 읽은 것으로 본다 (다른 강사 수강증에는 이 칸이 없다).
  const brandExact =
    compact.includes(RECEIPT.brand) ||
    dropFinals(compact).includes(dropFinals(RECEIPT.brand)) ||
    (fuzzyIncludes(compact, RECEIPT.brand, 1) && RECEIPT.instructorField.test(compact));

  const { kind, found } = parseKind(compact);
  if (found.length === 0) warnings.push("종합반 / LC / RC 표기를 찾지 못했어요");
  else if (found.length > 1) warnings.push(`종합 · 단과 표기가 여럿 읽혔어요: ${found.map((k) => KIND_LABEL[k]).join(", ")}`);

  const track = parseTrack(compact, warnings);
  const twoMonth = RECEIPT.alternateDayMonths === 2 && (track === "mw" || track === "tt");

  const period = parsePeriodWeeks(compact);
  if (period.conflict) warnings.push("수강 기간 숫자(N주)가 여럿 읽혔어요");

  const program: Program = RECEIPT.premierWords.some((w) => fuzzyIncludes(compact, w, 1)) ? "premier" : "score";
  const courseLevel = Object.entries(RECEIPT.premierLevelWords).find(([w]) => fuzzyIncludes(compact, w, 1))?.[1] ?? null;

  const { levels, font7, foreign } = parseLevels(compact);
  if (font7) warnings.push("레벨 칸의 7 이 글꼴 때문에 비틀려 읽혀(150 꼴) 750 으로 봤어요");
  if (foreign.length > 0) warnings.push(`벨라토익 레벨이 아닌 숫자가 적혀 있어요: ${foreign.join(", ")}`);
  let level = levels[0] ?? null;
  if (level == null && courseLevel != null && foreign.length === 0) {
    level = courseLevel;
    warnings.push(`레벨 숫자는 못 읽었지만 과정명으로 ${courseLevel} 으로 봤어요`);
  } else if (level == null) {
    warnings.push(`레벨(${RECEIPT.levels.join("/")})을 찾지 못했어요`);
  }
  if (levels.length > 1) warnings.push(`레벨이 여러 개 적혀 있어요: ${levels.join(", ")}`);
  if (courseLevel != null && level != null && courseLevel !== level) warnings.push(`과정명(실전속성 = ${courseLevel})과 레벨 숫자(${level})가 달라요`);

  // 수업 시간은 수강시간 칸의 값. 칸을 못 읽었을 때 시간이 하나뿐이면 그것, 여럿이면 비워 둔다 (첫 번째를 골라 엉뚱한 반에 붙이지 않게)
  const times = parseTimes(compact);
  const labeled = compact.match(new RegExp(String.raw`수${GANG}${SIGAN}[^\d]{0,3}(\d{1,2}:\d{2}~\d{1,2}:\d{2})`));
  const time = (labeled ? parseTimes(labeled[1])[0] : undefined) ?? (times.length === 1 ? times[0] : null);
  if (times.length === 0) warnings.push("수업 시간(HH:MM~HH:MM)을 찾지 못했어요");
  else if (!time) warnings.push(`수업 시간이 여러 개라 어느 것인지 모르겠어요: ${times.map((t) => t.timeBlock).join(", ")}`);

  return {
    text,
    compact,
    gates,
    mode,
    modeEvidence,
    card,
    brandExact,
    kind,
    track,
    twoMonth,
    levels,
    level,
    courseLevel,
    program,
    weeks: period.weeks,
    times,
    time,
    months: parseReceiptMonths(text.replace(CAPTURE_STAMP, " ")),
    courseMonth: parseCourseMonth(text),
    startMonth: parseStartMonth(compact),
    capturedOn: parseCapturedOn(text),
    capturedAt: parseCapturedAt(text),
    tuition: parseTuition(compact),
    warnings,
  };
}

/** 판정 키가 전부 읽혔나 — OCR 이 값싼 변형부터 읽다가 여기서 true 면 나머지(더 느린) 변형을 건너뛴다 */
export function parsedComplete(p: ParsedReceipt): boolean {
  return (
    p.gates.academy &&
    p.brandExact &&
    p.card &&
    p.kind != null &&
    p.level != null &&
    p.track != null &&
    p.time != null &&
    p.courseMonth != null &&
    p.capturedAt != null &&
    (p.modeEvidence === "online" || p.modeEvidence === "room")
  );
}

/** 운영의 "여기서 읽기를 멈춰도 되나" — 판정 키에 더해 **학생 이름**까지 (이름이 자동 승인 조건이다) */
export function readEnoughFor(studentName: string | null | undefined): (text: string) => boolean {
  return (text) => {
    const p = parseReceipt(text);
    if (!parsedComplete(p)) return false;
    return !studentName || receiptHasName(text, studentName);
  };
}

/** DB 에 남기는 판독 결과 — 원문(text · compact)은 ocr 칸에 따로 있다. `capturedAt` 은 같은 초 검사가 다시 읽으니 꼭 남긴다 */
export type StoredParsed = Omit<ParsedReceipt, "text" | "compact"> & { nameMatches: boolean | null };

export function storedParsed(p: ParsedReceipt, nameMatches: boolean | null): StoredParsed {
  const { text: _t, compact: _c, ...rest } = p;
  return { ...rest, nameMatches };
}
