// ───────────────────────────────────────────────
// 가격·교재·반 정보는 여기서만 고치면 홈페이지 전체에 반영돼요.
// ───────────────────────────────────────────────

export const BOOK_PRICE = 10000; // 교재 1권당 가격
export const SHIPPING_FEE = 4000; // 택배비

export type BookId = "concept" | "start_rc" | "solve_rc1" | "solve_rc2" | "lc1" | "lc2";
export type CourseId = "start" | "solve" | "intensive";
// alt_mw·alt_tt = 주 2일 격일반(월수·화목)
// alt = 요일을 아직 정하지 않은 기존 격일반 신청 (관리 페이지에서 월수·화목으로 지정)
export type Track = "all" | "rc" | "lc" | "alt_mw" | "alt_tt" | "alt";
export type Kind = "onsite" | "online";
export type Pickup = "classroom" | "delivery";
export type Status = "pending" | "paid" | "shipped";
export type TimeSlot = "am" | "pm";

// 매달 같은 책: 개념집, 시작반 RC / 달마다 번갈아 바뀌는 책: 문풀반 RC 1·2, LC 1·2
// LC는 시작반·문풀반 공통 수업이라 교재도 하나예요.
export const BOOKS: Record<BookId, string> = {
  concept: "개념집",
  start_rc: "시작반 RC",
  solve_rc1: "문풀반 RC 1",
  solve_rc2: "문풀반 RC 2",
  lc1: "LC 1",
  lc2: "LC 2",
};

export const TRACKS: Record<Track, string> = {
  all: "주 4일(종합반)",
  rc: "RC 단과",
  lc: "LC 단과",
  alt_mw: "주 2일(격일반) 월수",
  alt_tt: "주 2일(격일반) 화목",
  alt: "주 2일(격일반) 요일 미지정",
};

// 반별로 고를 수 있는 과정 (속성반은 주 4일만)
// alt는 기존 신청용이라 새로 고를 수 없어요.
export const COURSES: Record<CourseId, { label: string; tracks: Track[] }> = {
  start: { label: "시작반", tracks: ["all", "rc", "lc", "alt_mw", "alt_tt"] },
  solve: { label: "문풀반", tracks: ["all", "rc", "lc", "alt_mw", "alt_tt"] },
  intensive: { label: "속성반", tracks: ["all"] },
};

export const isAlt = (t: Track) => t === "alt_mw" || t === "alt_tt" || t === "alt";

// 강의 영상을 올릴 때 고르는 구분. 속성반은 시작반·문풀반 영상을 함께 보는 반이라
// 별도 강의 구분이 없어요.
export const LECTURE_COURSES: CourseId[] = ["start", "solve"];

// ── 교재 회차 ────────────────────────────────────
// 2026-09 = 1회차, 2026-10 = 2회차, 2026-11 = 1회차 … 달마다 번갈아요.
// 관리 페이지에서 기수별로 직접 바꿀 수도 있어요(settings의 round_<기수>).
export function roundOf(cohort: string): 1 | 2 {
  const m = /^(\d{4})-(\d{2})$/.exec(cohort);
  if (!m) return 1;
  return (Number(m[1]) * 12 + Number(m[2])) % 2 === 1 ? 1 : 2;
}

// 반·과정·회차로 지급 교재가 자동으로 정해져요 (학생이 교재를 고르는 화면은 없음)
// continuing = 시작반 격일반을 지난달에 이어 듣는 경우 (LC만 새로 받음)
export function booksFor(course: CourseId, track: Track, round: 1 | 2, continuing = false): BookId[] {
  const lc: BookId = round === 1 ? "lc1" : "lc2";
  const solveRc: BookId = round === 1 ? "solve_rc1" : "solve_rc2";
  if (course === "intensive") return ["concept", "start_rc", solveRc, lc];
  if (course === "start") {
    if (track === "rc") return ["concept", "start_rc"];
    if (track === "lc") return [lc];
    if (isAlt(track) && continuing) return [lc];
    return ["concept", "start_rc", lc];
  }
  if (track === "rc") return [solveRc];
  if (track === "lc") return [lc];
  // 문풀반 격일반은 매달 교재가 바뀌므로 이어들어도 새 교재 전부 구매해요.
  return [solveRc, lc];
}

export const CLASSROOM = "703호"; // 현장 수업 강의실
export const SITE_URL = "https://vellatoeic.vercel.app"; // 학생에게 안내하는 정식 주소 (출석 QR에 들어가요)

export const KINDS: Record<Kind, { label: string; short: string }> = {
  onsite: { label: "현장 수강생", short: "현장" },
  online: { label: "불라방 수강생", short: "불라방" },
};

// 불라방 수령 방법
export const PICKUPS: Record<Pickup, { label: string; desc: string }> = {
  classroom: { label: "1층 데스크 수령", desc: "직접 방문해서 수령" },
  delivery: { label: "택배 수령", desc: `택배비 ${SHIPPING_FEE.toLocaleString("ko-KR")}원` },
};

export function pickupLabel(kind: Kind, pickup: Pickup) {
  if (kind === "onsite") return `첫 수업 날 ${CLASSROOM}에서 일괄 지급`;
  return PICKUPS[pickup].label;
}

// 불라방 교재 진행 상태 (현장은 첫 수업 날 일괄 지급이라 따로 없어요)
export function bookStatusLabel(a: { kind: Kind; pickup: Pickup; status: Status }) {
  if (a.kind === "onsite") return "첫날 지급";
  const delivery = a.pickup === "delivery";
  if (a.status === "pending") return "납부 후 진행";
  if (a.status === "paid") return delivery ? "발송 대기" : "수령 대기";
  return delivery ? "발송 완료" : "수령 완료";
}

export const STATUS_LABEL: Record<Status, string> = {
  pending: "입금 확인 중",
  paid: "납부 완료",
  shipped: "교재 발송 완료",
};

export const INSTAGRAM_URL = "https://www.instagram.com/vella_toeic/";

export function calcAmount(books: BookId[], pickup: Pickup) {
  return books.length * BOOK_PRICE + (pickup === "delivery" ? SHIPPING_FEE : 0);
}

export function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

// ── 강의실 ──────────────────────────────────────
export type Part = "rc" | "lc";
export const PARTS: Record<Part, string> = { rc: "RC", lc: "LC" };

// 수강 과목별로 볼 수 있는 강의 파트
// 격일반은 종합반과 같은 강의 영상을 봐요
export const TRACK_PARTS: Record<Track, Part[]> = {
  all: ["rc", "lc"],
  rc: ["rc"],
  lc: ["lc"],
  alt_mw: ["rc", "lc"],
  alt_tt: ["rc", "lc"],
  alt: ["rc", "lc"],
};

// 기수 표기: "2026-10" → "2026년 10월"
export function cohortLabel(c: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(c);
  return m ? `${m[1]}년 ${Number(m[2])}월` : c;
}

export function thisMonthKST() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 유튜브 주소에서 영상 ID만 뽑기 (youtu.be / watch?v= / shorts / live / embed 모두 지원)
export function youtubeId(url: string): string | null {
  const s = url.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m =
    /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/.exec(s);
  return m ? m[1] : null;
}

// ── 출석·숙제 스티커 ─────────────────────────────
// 수업 단위: 시작반 / 시작반 격일반 / 문풀반 / 문풀반 격일반 / 속성반 / LC 공통
export type Klass = "start-daily" | "start-alt" | "solve-daily" | "solve-alt" | "intensive-daily" | "lc-common";
export const KLASSES: Record<Klass, string> = {
  "start-daily": "시작반",
  "start-alt": "시작반 격일반",
  "solve-daily": "문풀반",
  "solve-alt": "문풀반 격일반",
  "intensive-daily": "속성반",
  "lc-common": "LC 공통",
};
export function klassOf(a: { course: CourseId; track: Track }): Klass {
  if (a.course === "intensive") return "intensive-daily";
  return `${a.course}-${isAlt(a.track) ? "alt" : "daily"}` as Klass;
}
export function takesSharedLc(a: { course: CourseId; track: Track }) {
  return a.course === "intensive" || a.track !== "rc";
}
export function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
export function dayLabel(d: string) {
  const [, m, dd] = d.split("-");
  return `${Number(m)}/${Number(dd)}`;
}

// ── 출석 가능 시간 ───────────────────────────────
// 강의실에 붙여 둔 QR은 이 시간에만 출석으로 인정돼요. 시간표가 바뀌면 여기만 고치면 돼요.
// 반마다 오전반·저녁반이 있고, 둘 중 어느 쪽에 와도 출석으로 인정해요.
//
// 요일 제한은 일부러 두지 않았어요. 크게는 월~목이지만 매달 시간표가 바뀌어서,
// 요일을 고정하면 바뀐 달에 수강생 출석이 막혀요. 그래서 매일 열어두고 시간대만 봐요.
export type Slot = { label: string; from: string; to: string; detail: string };

const START_TIME: Slot[] = [
  { label: "오전반", from: "10:00", to: "12:10", detail: "RC 10:00~11:00 · LC 11:00~12:10" },
  { label: "저녁반", from: "19:10", to: "21:20", detail: "LC 19:10~20:10 · RC 20:20~21:20" },
];
const SOLVE_TIME: Slot[] = [
  { label: "오전반", from: "11:10", to: "13:20", detail: "LC 11:10~12:10 · RC 12:20~13:20" },
  { label: "저녁반", from: "18:00", to: "20:10", detail: "RC 18:00~19:00 · LC 19:10~20:10" },
];
// 속성반은 시작반 RC + LC 공통 + 문풀반 RC를 이어서 들어요
const INTENSIVE_TIME: Slot[] = [
  { label: "오전반", from: "10:00", to: "13:20", detail: "시작 RC 10:00 · LC 11:10 · 문풀 RC 12:20" },
  { label: "저녁반", from: "18:00", to: "21:20", detail: "문풀 RC 18:00 · LC 19:10 · 시작 RC 20:20" },
];

// 격일반은 같은 시간에 수업하고 수업 일수만 달라요
export const KLASS_TIME: Record<Klass, Slot[]> = {
  "start-daily": START_TIME,
  "start-alt": START_TIME,
  "solve-daily": SOLVE_TIME,
  "solve-alt": SOLVE_TIME,
  "intensive-daily": INTENSIVE_TIME,
  "lc-common": [
    { label: "오전 공통 LC", from: "11:10", to: "12:10", detail: "시작반·문풀반 공통 수업" },
    { label: "저녁 공통 LC", from: "19:10", to: "20:10", detail: "시작반·문풀반 공통 수업" },
  ],
};

// 수강 시간 (신청서에서 오전반/저녁반 선택)
export const TIME_SLOTS: Record<TimeSlot, string> = { am: "오전반", pm: "저녁반" };
export const isTimeSlot = (v: string): v is TimeSlot => v === "am" || v === "pm";
// 예: "시작반 주 4일(종합반) · 오전반"
export function klassLabel(a: { course: CourseId; track: Track; slot: TimeSlot | null }) {
  return `${COURSES[a.course].label} ${TRACKS[a.track]}${a.slot ? ` · ${TIME_SLOTS[a.slot]}` : ""}`;
}

// 예: "오전반 10:00~12:10"
export function slotLabel(a: { course: CourseId; track: Track }, slot: TimeSlot) {
  const s = KLASS_TIME[klassOf(a)][slot === "am" ? 0 : 1];
  return `${TIME_SLOTS[slot]} ${s.from}~${s.to}`;
}

// 수업 시작 전·종료 후로 이만큼 여유를 둬요 (지각·늦은 로그인 대비)
export const CHECK_GRACE_MIN = 20;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// "오전반 10:00~12:10 · 저녁반 19:10~21:20"
export function klassTimeLabel(k: Klass) {
  return KLASS_TIME[k].map((s) => `${s.label} ${s.from}~${s.to}`).join(" · ");
}

export function isCheckOpen(k: Klass, nowMs = Date.now()) {
  const kst = new Date(nowMs + 9 * 3600 * 1000);
  const now = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return KLASS_TIME[k].some((s) => now >= toMin(s.from) - CHECK_GRACE_MIN && now <= toMin(s.to) + CHECK_GRACE_MIN);
}

// 지각은 해당 수업의 첫 시작 시각을 넘긴 경우예요.
const CLASS_STARTS: Record<Klass, string[]> = {
  "start-daily": ["10:00", "20:20"],
  "start-alt": ["10:00", "20:20"],
  "solve-daily": ["11:10", "18:00"],
  "solve-alt": ["11:10", "18:00"],
  "intensive-daily": ["10:00", "18:00"],
  "lc-common": ["11:10", "19:10"],
};

export function isLate(k: Klass, nowMs = Date.now()) {
  const kst = new Date(nowMs + 9 * 3600 * 1000);
  const now = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return KLASS_TIME[k].some((slot, i) => {
    const from = toMin(slot.from);
    const to = toMin(slot.to);
    const inSlot = now >= from - CHECK_GRACE_MIN && now <= to + CHECK_GRACE_MIN;
    return inSlot && now > toMin(CLASS_STARTS[k][i]);
  });
}
