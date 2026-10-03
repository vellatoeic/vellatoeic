// ───────────────────────────────────────────────
// 가격·교재·반 정보는 여기서만 고치면 홈페이지 전체에 반영돼요.
// ───────────────────────────────────────────────

export const BOOK_PRICE = 10000; // 교재 1권당 가격
export const SHIPPING_FEE = 4000; // 택배비

export type BookId = "concept" | "start_rc" | "start_lc" | "solve_rc" | "solve_lc";
export type CourseId = "start" | "solve";
export type Track = "all" | "rc" | "lc" | "alt"; // alt = 격일반 (종합만)
export type Kind = "onsite" | "online";
export type Pickup = "classroom" | "delivery";
export type Status = "pending" | "paid" | "shipped";

export const BOOKS: Record<BookId, string> = {
  concept: "개념집",
  start_rc: "시작반 RC",
  start_lc: "시작반 LC",
  solve_rc: "문풀반 RC",
  solve_lc: "문풀반 LC",
};

export const TRACKS: Record<Track, string> = {
  all: "주 4일(종합반)",
  rc: "RC 단과",
  lc: "LC 단과",
  alt: "주 2일(격일반)",
};

// 반 × 수강 과목별 지급 교재 (일괄 지급)
export const COURSES: Record<CourseId, { label: string; books: Record<Track, BookId[]> }> = {
  start: {
    label: "시작반",
    books: { all: ["concept", "start_rc", "start_lc"], rc: ["concept", "start_rc"], lc: ["start_lc"], alt: ["concept", "start_rc", "start_lc"] },
  },
  solve: {
    label: "문풀반",
    books: { all: ["solve_rc", "solve_lc"], rc: ["solve_rc"], lc: ["solve_lc"], alt: ["solve_rc", "solve_lc"] },
  },
};

export const CLASSROOM = "703호"; // 현장 수업 강의실

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
export const TRACK_PARTS: Record<Track, Part[]> = { all: ["rc", "lc"], rc: ["rc"], lc: ["lc"], alt: ["rc", "lc"] };

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
// 수업 단위: 시작반 / 시작반 격일반 / 문풀반 / 문풀반 격일반 (단과는 같은 시간 수업이라 매일반에 포함)
export type Klass = "start-daily" | "start-alt" | "solve-daily" | "solve-alt";
export const KLASSES: Record<Klass, string> = {
  "start-daily": "시작반",
  "start-alt": "시작반 격일반",
  "solve-daily": "문풀반",
  "solve-alt": "문풀반 격일반",
};
export function klassOf(a: { course: CourseId; track: Track }): Klass {
  return `${a.course}-${a.track === "alt" ? "alt" : "daily"}` as Klass;
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

// 격일반은 같은 시간에 수업하고 수업 일수만 달라요
export const KLASS_TIME: Record<Klass, Slot[]> = {
  "start-daily": START_TIME,
  "start-alt": START_TIME,
  "solve-daily": SOLVE_TIME,
  "solve-alt": SOLVE_TIME,
};

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
