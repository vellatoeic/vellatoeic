/**
 * 수강증 판독 결과 → 배정할 반. **점수를 매기지 않고 키로 거른다.**
 *
 * 그 시점에 열린 반은 기껏 20여 개라, 수강증 글자로 "어느 반이냐" 만 가리면 된다:
 * 레벨 · 과정(속성반) · 종합/단과 · 시간(문자열 정확 일치) · 요일 · 수강월.
 * **딱 맞는 반이 정확히 하나 남을 때만 `match`** 다. 0 개 · 여러 개면 강사 검토 — 애매한데 골라 넣으면 오배정이고,
 * 오배정은 학생이 남의 반 강의실 · 다시보기를 보게 한다.
 *
 * 격일반 2개월 과정 (config.alternateDayMonths = 2): 배지 달 M 은 수강증의 요일, M+1 은 반대 요일 반이다.
 * 둘 중 **열려 있는 달은 다 배정**하고, 아직 안 열린 둘째 달은 `followUp` 으로 남겨 그 달 반이 열리면 같은 조건으로 붙인다.
 */
import { otherAlternate, receiptCourseMonth, TRACK_LABEL, KIND_LABEL, type Kind, type ParsedReceipt, type Program, type Track } from "./receipt";

/** 열린 반 하나 — 각자 DB 의 반 표를 이 꼴로 바꿔 넘긴다 (Store.listOpenSections) */
export type Section = {
  id: string;
  /** 기수 "2026-12" */
  term: string;
  kind: Kind;
  /** 650 · 750 */
  level: number;
  /** score = 시작반 · 문풀반 · 단과, premier = 속성반 */
  program: Program;
  track: Track;
  /** "18:00~20:10" — 수강증의 수강시간과 글자 그대로 같아야 한다 */
  timeBlock: string;
  /** 개강일 (YYYY-MM-DD) — 그 전에 승인되면 예비등록, 개강일에 수강생 */
  startsOn?: string | null;
  /** 종강일 (YYYY-MM-DD) */
  endsOn?: string | null;
  /** 화면에 보일 이름 ("12월 문풀반 주 4일 18:00~20:10") — 없으면 만들어 쓴다 */
  label?: string | null;
};

export type MatchInput = Pick<ParsedReceipt, "level" | "levels" | "courseLevel" | "program" | "kind" | "track" | "twoMonth" | "time" | "courseMonth" | "startMonth">;

export type FollowUp = { month: number; track: Track; level: number; program: Program; kind: Kind | null; timeBlock: string };

export type MatchResult =
  | {
      kind: "match";
      sectionIds: string[];
      /** 배정한 기수들 (격일반 두 달이 다 열려 있으면 둘) */
      terms: string[];
      /** 격일반의 아직 안 열린 둘째 달 — 그 달 반이 열리면 붙인다 (`rematch`) */
      followUp?: FollowUp;
      /** 수강월을 못 읽어 열린 기수 하나로 골랐다 — 다음 달 수강증일 수 있어 자동 승인하지 않는다 */
      monthUnclear?: true;
      /** 종합/단과 표기를 못 읽어 시간 · 레벨로만 골랐다 — 자동 승인하지 않는다 */
      kindUnclear?: true;
    }
  | { kind: "none" | "ambiguous"; reason: string };

/** 승인 화면용 대조 기록 — 같은 레벨 반마다 어느 키가 맞았는지 */
export type MatchLog = { sectionId: string; term: string; track: Track; timeBlock: string; kind: Kind; program: Program; match: { time: boolean; program: boolean; kind: boolean; term: boolean; track: boolean } };

export const termMonth = (term: string) => Number(term.split("-")[1]);
const nextMonth = (m: number) => (m % 12) + 1;

export function sectionLabel(s: Section, mode?: "onsite" | "live"): string {
  if (s.label) return mode ? `${s.label} · ${mode === "live" ? "불라방" : "현장"}` : s.label;
  const cls = s.program === "premier" ? "속성반" : s.level === 750 ? "문풀반" : s.level === 650 ? "시작반" : `${s.level}`;
  const kind = s.kind === "full" ? "" : ` ${KIND_LABEL[s.kind]}`;
  const days = s.track === "w4" ? "주 4일" : `격일 ${TRACK_LABEL[s.track]}`;
  const base = `${termMonth(s.term)}월 ${cls}${kind} ${days} ${s.timeBlock}`;
  return mode ? `${base} · ${mode === "live" ? "불라방" : "현장"}` : base;
}

/**
 * 수강증이 말하는 달들과 그 달의 요일 — 보통 [{M, 요일}], 격일반 2개월 과정이면 [{M, 요일}, {M+1, 반대 요일}].
 * 수강월을 못 읽었으면 null.
 */
export function receiptMonths(parsed: Pick<MatchInput, "courseMonth" | "startMonth" | "track" | "twoMonth">): { month: number; track: Track }[] | null {
  const month = receiptCourseMonth(parsed);
  if (month == null || !parsed.track) return null;
  const out = [{ month, track: parsed.track }];
  const second = otherAlternate(parsed.track);
  if (parsed.twoMonth && second) out.push({ month: nextMonth(month), track: second });
  return out;
}

/**
 * 받아 둔 수강증을 다시 맞출 때는 부르는 쪽(`rematch`)이 받아 둔 달을 `courseMonth` 로 채워 넘긴다 — 그때는 짐작이 아니다.
 */
export function matchSections(parsed: MatchInput, sections: readonly Section[]): { result: MatchResult; log: MatchLog[] } {
  if (parsed.level == null) return { result: { kind: "none", reason: "레벨을 읽지 못했어요" }, log: [] };
  if (!parsed.time) return { result: { kind: "none", reason: "수업 시간을 읽지 못했어요" }, log: [] };
  if (!parsed.track) return { result: { kind: "none", reason: "요일(주 4일 / 격일 월수 · 화목)을 읽지 못했어요" }, log: [] };
  const time = parsed.time.timeBlock;

  const sameLevel = sections.filter((s) => s.level === parsed.level);
  const byKey = sameLevel.filter((s) => s.program === parsed.program && s.timeBlock === time && (parsed.kind == null || s.kind === parsed.kind));

  // 수강월 → 그 달(들)의 요일 (격일반 2개월이면 두 달)
  const wanted = receiptMonths(parsed);
  const openTerms = [...new Set(byKey.map((s) => s.term))].sort();
  const candidateTerms = wanted == null ? openTerms : openTerms.filter((t) => wanted.some((w) => w.month === termMonth(t)));

  const log: MatchLog[] = sameLevel.map((s) => ({
    sectionId: s.id,
    term: s.term,
    track: s.track,
    timeBlock: s.timeBlock,
    kind: s.kind,
    program: s.program,
    match: {
      time: s.timeBlock === time,
      program: s.program === parsed.program,
      kind: parsed.kind == null || s.kind === parsed.kind,
      term: candidateTerms.includes(s.term),
      track: (wanted ?? [{ month: termMonth(s.term), track: parsed.track! }]).some((w) => w.month === termMonth(s.term) && w.track === s.track),
    },
  }));

  // 레벨이 흔들리면 대조를 멈춘다 — 앞의 숫자를 골라 다른 레벨 반에 넣지 않는다
  if (parsed.courseLevel != null && parsed.courseLevel !== parsed.level) {
    return { result: { kind: "ambiguous", reason: `과정명의 레벨(${parsed.courseLevel})과 레벨 숫자(${parsed.level})가 달라요` }, log };
  }
  if (parsed.levels.length > 1) return { result: { kind: "ambiguous", reason: `레벨 숫자가 여러 개 읽혔어요 (${parsed.levels.join(", ")})` }, log };

  const what = `${parsed.level} ${parsed.program === "premier" ? "속성반 " : ""}${parsed.kind ? KIND_LABEL[parsed.kind] + " " : ""}${time}`;
  if (byKey.length === 0) return { result: { kind: "none", reason: `${what} 에 열린 반이 없어요` }, log };
  if (candidateTerms.length === 0) {
    const m = wanted?.map((w) => `${w.month}월`).join(" · ");
    return { result: { kind: "none", reason: `${m} ${what} 반이 아직 없어요` }, log };
  }
  if (wanted == null && candidateTerms.length !== 1) {
    return { result: { kind: "ambiguous", reason: `수강월을 읽지 못해 어느 달인지 가릴 수 없어요 (${candidateTerms.map((t) => `${termMonth(t)}월`).join(", ")})` }, log };
  }

  const picked: string[] = [];
  const terms: string[] = [];
  for (const term of candidateTerms) {
    const track = wanted ? wanted.find((w) => w.month === termMonth(term))!.track : parsed.track;
    const hit = byKey.filter((s) => s.term === term && s.track === track);
    if (hit.length !== 1) {
      const reason = hit.length === 0 ? `${termMonth(term)}월 ${TRACK_LABEL[track]} ${what} 반이 없어요` : `${termMonth(term)}월 ${TRACK_LABEL[track]} ${what} 반이 여러 개예요`;
      return { result: { kind: hit.length === 0 ? "none" : "ambiguous", reason }, log };
    }
    picked.push(hit[0].id);
    terms.push(term);
  }

  // 격일반의 둘째 달이 아직 안 열렸으면 남겨 둔다 — 첫 달이 열려 배정됐을 때만 (첫 달이 이미 지나 둘째 달만 열렸으면 남길 것이 없다)
  const missing =
    wanted && wanted.length > 1 && terms.some((t) => termMonth(t) === wanted[0].month)
      ? wanted.slice(1).find((w) => !terms.some((t) => termMonth(t) === w.month))
      : undefined;
  const followUp: FollowUp | undefined = missing ? { month: missing.month, track: missing.track, level: parsed.level, program: parsed.program, kind: parsed.kind, timeBlock: time } : undefined;

  return {
    result: {
      kind: "match",
      sectionIds: picked,
      terms,
      ...(followUp ? { followUp } : {}),
      ...(wanted == null ? { monthUnclear: true as const } : {}),
      ...(parsed.kind == null ? { kindUnclear: true as const } : {}),
    },
    log,
  };
}

/** 격일반 둘째 달 붙이기 — `FollowUp` 을 반 대조 입력으로 */
export function followUpInput(f: FollowUp): MatchInput {
  return {
    level: f.level,
    levels: [f.level],
    courseLevel: null,
    program: f.program,
    kind: f.kind,
    track: f.track,
    twoMonth: false,
    time: { start: f.timeBlock.slice(0, 5), end: f.timeBlock.slice(6), minutes: 0, timeBlock: f.timeBlock },
    courseMonth: f.month,
    startMonth: null,
  };
}
