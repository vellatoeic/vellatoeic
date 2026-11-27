import "server-only";
import { randomStudentNo, type MatchStatus } from "./mockScores";
import { forget, memo } from "./requestMemo";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { TestDouble, TestKind, TestOverride } from "./tests";
import type { Notice } from "./notices";
import { thisMonthKST, roundOf, type BookId, type CourseId, type Kind, type Part, type Pickup, type Status, type TimeSlot, type Track, type DepositStatus } from "./config";

export type Application = {
  id: string;
  cohort: string;
  kind: Kind;
  course: CourseId;
  track: Track;
  continuing: boolean; // 격일반을 지난달에 이어 듣는 수강생 (LC만 새로 받음)
  slot: TimeSlot | null; // 수강 시간 (오전반/저녁반). 시간 추가 전 신청은 비어 있어요.
  pickup_date: string | null; // 불라방 현장(데스크) 수령 희망 날짜
  pickup_time: string | null; // 불라방 현장(데스크) 수령 희망 시간 (예: 14:00)
  books: BookId[];
  pickup: Pickup;
  name: string;
  phone: string | null;
  depositor: string;
  address: string | null;
  address_detail?: string | null; // 택배 상세주소 (SQL 41부터, 예전 신청은 비어 있어요 → lib/address.ts가 address에서 나눠요)
  amount: number;
  status: Status;
  pin_hash: string | null;
  created_at: string;
  paid_at?: string | null; // 납부 확인 시각 (LC 음원 기간 시작에 써요)
  cancelled_at?: string | null; // 취소된 시각
  cancel_reason?: "timeout" | "admin" | null; // timeout = 30분 안에 입금 미확인(자동), admin = 관리자 취소
  pending_from?: string | null; // 30분 입금 타이머 시작 (비어 있으면 신청 시각, 관리자가 되살리면 그 시각)
  books_adjusted?: boolean; // 관리자가 교재를 직접 고른 신청 (회차 재계산·반 변경에서 교재를 자동으로 바꾸지 않아요)
  audio_extended_until?: string | null; // 관리자가 음원 기간을 다시 열어준 마지막 날
  account_id?: string | null; // 구글·카카오 로그인으로 묶인 학생 번호 (연결 전 신청은 비어 있어요, SQL 39)
  receipt_status?: ReceiptStatus | null; // 수강증 확인 (비어 있음 = 수강증 없이 받은 예전 신청)
  student_no?: string | null; // 개인번호 6자리 (모의고사 답안지 '수험번호' 칸, 같은 학생 = 같은 번호, SQL 43)
};

export type NewApplication = Omit<Application, "id" | "status" | "created_at">;

// 신청 조회에 쓰는 칸 (비밀번호 해시 pin_hash는 로그인 확인 때만 읽어요)
const APP_COLS = "id,cohort,kind,course,track,continuing,slot,pickup_date,pickup_time,books,pickup,name,phone,depositor,address,amount,status,created_at,paid_at,cancelled_at,cancel_reason,pending_from,books_adjusted,audio_extended_until,account_id,receipt_status,address_detail,student_no";

// ── 수강증 자동 확인 (SQL 40) ──
// auto = 수강증대로 자동 확인 · review = 선생님 확인 필요 · approved = 선생님이 확인함
export type ReceiptStatus = "auto" | "review" | "approved";
export type ReceiptCheck = {
  id: string;
  created_at: string;
  application_id: string | null;
  status: "read" | ReceiptStatus; // read = 읽기만 함(제출 전)
  outcome: "match" | "review" | "reject" | "skipped";
  cohorts: string[];
  classes: { cohort: string; course: CourseId; track: Track; slot: TimeSlot }[];
  kind: Kind | null;
  receipt_name: string | null;
  captured_at: string | null;
  image_hash: string | null;
  reading: Record<string, unknown>;
  reasons: string[];
  ocr_text: string | null;
  ocr_ms: number | null;
  image_path: string | null;
  image_bytes: number | null;
  image_deleted_at: string | null;
  decided_at: string | null;
};

export type Lecture = {
  id: string;
  cohort: string;
  course: CourseId;
  part: Part;
  slot: TimeSlot | null; // 오전반/저녁반 수업 링크 (구분 추가 전 강의는 비어 있어요)
  title: string;
  youtube_id: string;
  created_at: string;
};

export type TestResult = {
  id: string;
  app_id: string;
  cohort: string;
  day: string;
  kind: TestKind;
  test_no: number;
  questions: number;
  score: number;
  wrong: number[];
  late: boolean;
  submitted_at: string;
};

export type YbmOrder = {
  id: string;
  name: string;
  phone: string;
  address: string;
  address_detail?: string | null; // 상세주소 (SQL 41)
  depositor: string;
  amount: number;
  status: "pending" | "paid" | "shipped" | "cancelled";
  proof_path: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  created_at: string;
  cancelled_at?: string | null;
  cancel_reason?: "timeout" | "admin" | null;
  pending_from?: string | null;
};

export type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  published: boolean;
  sort_order: number;
  created_at: string;
};

export type StudentQuestion = {
  id: string;
  app_id: string | null;
  name: string;
  kind: "question" | "suggestion";
  content: string;
  checked: boolean;
  created_at: string;
};

export type LcAudio = {
  id: string;
  cohort: string;
  book: "lc1" | "lc2"; // LC 교재에 따라 음원이 달라요
  title: string;
  storage_path: string | null; // 예전 방식(보관함 파일). 새 음원은 비어 있어요.
  link_url?: string | null; // 구글 드라이브 공유 링크 (지금 방식)
  size_bytes: number;
  sort_order: number;
  created_at: string;
};

export type Mission = {
  app_id: string;
  prev_score: string | null;
  target_score: string | null;
  exam_month: string | null;
  affiliation: string | null;
  instagram: string | null;
  message: string | null;
  intro_at: string | null;
  cafe_at: string | null;
  blog_at: string | null;
  insta_at: string | null;
  updated_at: string;
};

export type SpecialLecture = {
  id: string;
  event_date: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  youtube_id: string | null;
  registration_deadline: string | null; // 비어 있으면 특강 전날 17:00
  material_note: string | null; // 불라방 자료 위에 보여줄 안내 문구 (여러 줄)
  published?: boolean; // false = 자동으로 만든 초안 (공개 전에는 학생에게 안 보여요)
  created_at: string;
};

export type SpecialRegistration = {
  id: string;
  special_lecture_id: string;
  application_id: string | null;
  mode: "onsite" | "online";
  name: string;
  deposit: DepositStatus | null; // 현장 신청 보증금 (불라방은 없음)
  deposit_paid_at: string | null;
  deposit_refunded_at?: string | null; // 수강 환불로 보증금을 돌려준 시각
  created_at: string;
};

export type SpecialMaterial = {
  id: string;
  special_lecture_id: string;
  file_name: string; // 자료 제목
  storage_path: string | null; // 예전 방식(보관함 파일). 새 자료는 비어 있어요.
  link_url?: string | null; // 구글 드라이브 공유 링크 (지금 방식)
  created_at: string;
};

// Supabase 연결 정보가 없으면(미리보기) 메모리에 임시 저장해요.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export const isPreview = !sb;

export type Stamp = { app_id: string; day: string };
export type Attendance = Stamp & { late?: boolean };
export type Homework = Stamp & { photo_path: string | null; created_at: string };

type Mem = {
  apps: Application[];
  lectures: Lecture[];
  settings: Record<string, string>;
  attendance: Attendance[];
  homework: Homework[];
  photos: Record<string, string>;
  specialLectures: SpecialLecture[];
  specialRegistrations: SpecialRegistration[];
  specialMaterials: SpecialMaterial[];
  missions: Mission[];
  audios: LcAudio[];
  faq: FaqItem[];
  questions: StudentQuestion[];
  depositEvents: DepositEvent[];
  testResults: TestResult[];
  testOverrides: TestOverride[];
  testDoubles: TestDouble[];
  notices: Notice[];
  noticeReads: NoticeRead[];
  ybmOrders: YbmOrder[];
  loginLinks: LoginLink[];
  receiptChecks: ReceiptCheck[];
  studentNumbers?: string[];
  examResults?: ExamResultRow[];
  profiles?: StudentProfile[];
};
const g = globalThis as unknown as { __vellaMem?: Mem };
const mem: Mem = (g.__vellaMem ??= { apps: [], lectures: [], settings: {}, attendance: [], homework: [], photos: {}, specialLectures: [], specialRegistrations: [], specialMaterials: [], missions: [], audios: [], faq: [], questions: [], depositEvents: [], testResults: [], testOverrides: [], testDoubles: [], notices: [], noticeReads: [], ybmOrders: [], loginLinks: [], receiptChecks: [] });
mem.specialLectures ??= [];
mem.specialRegistrations ??= [];
mem.specialMaterials ??= [];
mem.lectures ??= [];
mem.attendance ??= [];
mem.homework ??= [];
mem.photos ??= {};
mem.missions ??= [];
mem.audios ??= [];
mem.faq ??= [];
mem.questions ??= [];
mem.depositEvents ??= [];
mem.testResults ??= [];
mem.testOverrides ??= [];
mem.notices ??= [];
mem.noticeReads ??= [];
mem.ybmOrders ??= [];
mem.loginLinks ??= [];
mem.receiptChecks ??= [];
mem.studentNumbers ??= [];
mem.examResults ??= [];

// 그 달 날짜 범위: 1일 이상 ~ 다음 달 1일 미만 (11월처럼 30일까지인 달에 '-31'을 만들면 DB 오류가 나요)
export function monthRange(cohort: string) {
  const [y, m] = cohort.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return { from: `${cohort}-01`, to: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01` };
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// Supabase는 한 번에 최대 1,000줄만 돌려줘요. 학생이 수백 명이면 기록이 잘리지 않게 1,000줄씩 끝까지 읽어요.
// (make는 매번 새 쿼리를 만들어야 해요. 순서가 정해진 쿼리여야 페이지가 겹치지 않아요)
const PAGE = 1000;
type Res = PromiseLike<{ data: unknown; error: unknown }>;
async function allRows<T>(make: (from: number, to: number) => Res): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
// id가 많으면 주소가 너무 길어져서 100개씩 나눠 읽어요.
async function inChunks<T>(ids: string[], run: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) out.push(...(await run(ids.slice(i, i + 100))));
  return out;
}

// ── 신청 ───────────────────────────────────────
export async function createApplication(a: NewApplication): Promise<string> {
  forget("apps:");
  if (sb) {
    const { data, error } = await sb.from("applications").insert(a).select("id").single();
    if (error) throw error;
    return data.id as string;
  }
  const id = crypto.randomUUID();
  mem.apps.unshift({ ...a, id, status: "pending", created_at: new Date().toISOString() });
  return id;
}

export async function getApplication(id: string): Promise<Application | null> {
  if (!isUuid(id)) return null;
  if (sb) {
    const { data } = await sb.from("applications").select(APP_COLS).eq("id", id).maybeSingle();
    return (data as Application) ?? null;
  }
  return mem.apps.find((x) => x.id === id) ?? null;
}

// 한 요청 안에서 같은 id 묶음은 한 번만 읽어요 (강의실·레이아웃 공지·팝업이 함께 써요)
export function getApplications(ids: string[]): Promise<Application[]> {
  const ok = ids.filter(isUuid);
  return memo(`apps:ids:${[...ok].sort().join(",")}`, () => getApplicationsRaw(ok));
}
async function getApplicationsRaw(ok: string[]): Promise<Application[]> {
  if (ok.length === 0) return [];
  if (sb) {
    const db = sb;
    return inChunks(ok, async (chunk) => {
      const { data, error } = await db.from("applications").select(APP_COLS).in("id", chunk);
      if (error) throw error;
      return data as Application[];
    });
  }
  return mem.apps.filter((x) => ok.includes(x.id));
}

export async function findApplicationsByName(name: string): Promise<Application[]> {
  if (sb) {
    const { data, error } = await sb.from("applications").select("*").eq("name", name);
    if (error) throw error;
    return data as Application[];
  }
  return mem.apps.filter((x) => x.name === name);
}

export const listApplications = () => memo("apps:list", listApplicationsRaw);
async function listApplicationsRaw(): Promise<Application[]> {
  if (sb) {
    const db = sb;
    return allRows<Application>((from, to) => db.from("applications").select(APP_COLS).order("created_at", { ascending: false }).order("id").range(from, to));
  }
  return mem.apps;
}

// 한 기수 신청만 (전체를 읽지 않아요)
export const listCohortApplications = (cohort: string) => memo(`apps:cohort:${cohort}`, () => listCohortApplicationsRaw(cohort));
async function listCohortApplicationsRaw(cohort: string): Promise<Application[]> {
  if (sb) {
    const db = sb;
    return allRows<Application>((from, to) => db.from("applications").select(APP_COLS).eq("cohort", cohort).order("created_at", { ascending: false }).order("id").range(from, to));
  }
  return mem.apps.filter((a) => a.cohort === cohort);
}

type ApplicationPatch = Partial<Pick<Application, "status" | "pin_hash" | "course" | "track" | "continuing" | "slot" | "books" | "amount" | "cohort" | "audio_extended_until" | "cancelled_at" | "cancel_reason" | "pending_from" | "books_adjusted" | "account_id" | "receipt_status" | "student_no">>;

export async function updateApplication(id: string, patch: ApplicationPatch) {
  await updateApplications([id], patch);
}

export async function deleteApplication(id: string) {
  forget("apps:");
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("applications").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  mem.apps = mem.apps.filter((x) => x.id !== id);
}

// ── 명단에서 체크한 여러 건 한 번에 ───────────────
export async function updateApplications(ids: string[], patch: ApplicationPatch) {
  forget("apps:");
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  if (sb) {
    const db = sb;
    await inChunks(ok, async (chunk) => {
      const { error } = await db.from("applications").update(patch).in("id", chunk);
      if (error) throw error;
      // 처음 납부 확인된 시각을 남겨요 (되돌렸다가 다시 확인해도 처음 시각 유지)
      if (patch.status === "paid") {
        const r = await db.from("applications").update({ paid_at: new Date().toISOString() }).in("id", chunk).is("paid_at", null);
        if (r.error) throw r.error;
      }
      return [];
    });
    return;
  }
  for (const a of mem.apps) if (ok.includes(a.id)) {
    Object.assign(a, patch);
    if (patch.status === "paid" && !a.paid_at) a.paid_at = new Date().toISOString();
  }
}

export async function deleteApplications(ids: string[]) {
  forget("apps:");
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  if (sb) {
    const db = sb;
    await inChunks(ok, async (chunk) => {
      const { error } = await db.from("applications").delete().in("id", chunk);
      if (error) throw error;
      return [];
    });
    return;
  }
  mem.apps = mem.apps.filter((x) => !ok.includes(x.id));
  // DB처럼 입금 기록은 남기고 연결만 풀어요 (on delete set null)
  for (const e of mem.depositEvents) if (e.application_id && ok.includes(e.application_id)) e.application_id = null;
}

// ── 강의 ───────────────────────────────────────
// cohort: 한 기수 또는 여러 기수 (비우면 전체 = 관리자용)
export const listLectures = (cohort?: string | string[]) => {
  const list = cohort === undefined ? undefined : [...new Set(typeof cohort === "string" ? [cohort] : cohort)].sort();
  return memo(`lectures:${list ? list.join(",") : "*"}`, () => listLecturesRaw(list));
};
async function listLecturesRaw(cohorts?: string[]): Promise<Lecture[]> {
  if (cohorts && cohorts.length === 0) return [];
  if (sb) {
    let q = sb.from("lectures").select("id,cohort,course,part,slot,title,youtube_id,created_at").order("created_at", { ascending: true });
    if (cohorts) q = q.in("cohort", cohorts);
    const { data, error } = await q;
    if (error) throw error;
    return data as Lecture[];
  }
  return mem.lectures.filter((l) => !cohorts || cohorts.includes(l.cohort));
}

export async function getLecture(id: string): Promise<Lecture | null> {
  if (!isUuid(id)) return null;
  if (sb) {
    const { data } = await sb.from("lectures").select("*").eq("id", id).maybeSingle();
    return (data as Lecture) ?? null;
  }
  return mem.lectures.find((l) => l.id === id) ?? null;
}

export async function addLecture(l: Omit<Lecture, "id" | "created_at">) {
  forget("lectures:");
  if (sb) {
    const { error } = await sb.from("lectures").insert(l);
    if (error) throw error;
    return;
  }
  mem.lectures.push({ ...l, id: crypto.randomUUID(), created_at: new Date().toISOString() });
}

export async function updateLecture(id: string, patch: Omit<Lecture, "id" | "created_at">) {
  forget("lectures:");
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("lectures").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const lecture = mem.lectures.find((l) => l.id === id);
  if (lecture) Object.assign(lecture, patch);
}

export async function deleteLecture(id: string) {
  forget("lectures:");
  if (sb) {
    const { error } = await sb.from("lectures").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  mem.lectures = mem.lectures.filter((l) => l.id !== id);
}

// ── YBM 인강 교재 주문 ─────────────────────────
const YBM_BUCKET = "ybm-proofs";

export async function createYbmOrder(o: Pick<YbmOrder, "name" | "phone" | "address" | "address_detail" | "depositor" | "amount">, proof: { data: Buffer; type: string }): Promise<string> {
  const id = crypto.randomUUID();
  const path = `${id}.${proof.type === "image/png" ? "png" : proof.type === "image/webp" ? "webp" : "jpg"}`;
  if (sb) {
    const up = await sb.storage.from(YBM_BUCKET).upload(path, proof.data, { contentType: proof.type, upsert: false });
    if (up.error) throw up.error;
    const { error } = await sb.from("ybm_orders").insert({ ...o, id, proof_path: path });
    if (error) {
      await sb.storage.from(YBM_BUCKET).remove([path]);
      throw error;
    }
    return id;
  }
  mem.photos[path] = `data:${proof.type};base64,${proof.data.toString("base64")}`;
  mem.ybmOrders.push({ ...o, id, status: "pending", proof_path: path, paid_at: null, shipped_at: null, created_at: new Date().toISOString() });
  return id;
}

export async function listYbmOrders(): Promise<YbmOrder[]> {
  if (sb) {
    const db = sb;
    return allRows<YbmOrder>((from, to) => db.from("ybm_orders").select("*").order("created_at", { ascending: false }).order("id").range(from, to));
  }
  return [...mem.ybmOrders].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getYbmOrder(id: string): Promise<YbmOrder | null> {
  if (!isUuid(id)) return null;
  if (sb) {
    const { data, error } = await sb.from("ybm_orders").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as YbmOrder) ?? null;
  }
  return mem.ybmOrders.find((o) => o.id === id) ?? null;
}

export async function updateYbmOrders(ids: string[], patch: Partial<Pick<YbmOrder, "status" | "paid_at" | "shipped_at" | "proof_path" | "cancelled_at" | "cancel_reason" | "pending_from">>) {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  if (sb) {
    const db = sb;
    await inChunks(ok, async (chunk) => {
      const { error } = await db.from("ybm_orders").update(patch).in("id", chunk);
      if (error) throw error;
      return [];
    });
    return;
  }
  for (const o of mem.ybmOrders) if (ok.includes(o.id)) Object.assign(o, patch);
}

export async function ybmProofUrl(path: string): Promise<string | null> {
  if (sb) {
    const { data, error } = await sb.storage.from(YBM_BUCKET).createSignedUrl(path, 60 * 10);
    if (error) throw error;
    return data?.signedUrl ?? null;
  }
  return mem.photos[path] ?? null;
}

// 개인정보 보호: 발송 완료 후 30일이 지난 주문의 수강증 사진을 지워요.
export async function cleanupYbmProofs(days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const old = (await listYbmOrders()).filter((o) => o.status === "shipped" && o.proof_path && o.shipped_at && o.shipped_at < cutoff);
  if (old.length === 0) return;
  if (sb) await sb.storage.from(YBM_BUCKET).remove(old.map((o) => o.proof_path!));
  else for (const o of old) delete mem.photos[o.proof_path!];
  await updateYbmOrders(old.map((o) => o.id), { proof_path: null });
}

// 개인정보 보호: 발송 완료 후 3개월(90일)이 지난 주문은 이름·연락처·주소째로 지워요.
export async function cleanupYbmOrders(days = 90) {
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const old = (await listYbmOrders()).filter((o) => o.status === "shipped" && o.shipped_at && o.shipped_at < cutoff);
  if (old.length === 0) return;
  const photos = old.flatMap((o) => (o.proof_path ? [o.proof_path] : []));
  if (sb) {
    if (photos.length) await sb.storage.from(YBM_BUCKET).remove(photos);
    const { error } = await sb.from("ybm_orders").delete().in("id", old.map((o) => o.id));
    if (error) throw error;
    return;
  }
  for (const p of photos) delete mem.photos[p];
  mem.ybmOrders = mem.ybmOrders.filter((o) => !old.some((x) => x.id === o.id));
}

// ── 수강증 자동 확인 (SQL 40) ───────────────────
// 사진은 선생님 확인이 필요할 때만 줄여서 저장해요(receipts 비공개 보관함). 자동 확인된 수강증은 사진을 남기지 않아요.
const RECEIPT_BUCKET = "receipts";
type NewReceiptCheck = Pick<ReceiptCheck, "outcome" | "cohorts" | "classes" | "kind" | "receipt_name" | "captured_at" | "image_hash" | "reading" | "reasons" | "ocr_text" | "ocr_ms">;

export async function createReceiptCheck(c: NewReceiptCheck, image?: Buffer): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const path = image ? `${now.slice(0, 7)}/${id}.jpg` : null;
  const row = { ...c, id, image_path: path, image_bytes: image ? image.length : null };
  if (sb) {
    if (image && path) {
      const up = await sb.storage.from(RECEIPT_BUCKET).upload(path, image, { contentType: "image/jpeg", upsert: false });
      if (up.error) throw up.error;
    }
    const { error } = await sb.from("receipt_checks").insert(row);
    if (error) {
      if (path) await sb.storage.from(RECEIPT_BUCKET).remove([path]);
      throw error;
    }
    return id;
  }
  if (image && path) mem.photos[path] = `data:image/jpeg;base64,${image.toString("base64")}`;
  mem.receiptChecks.push({ ...row, created_at: now, application_id: null, status: "read", image_deleted_at: null, decided_at: null });
  return id;
}

export async function getReceiptCheck(id: string): Promise<ReceiptCheck | null> {
  if (!isUuid(id)) return null;
  if (sb) {
    const { data, error } = await sb.from("receipt_checks").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as ReceiptCheck) ?? null;
  }
  return mem.receiptChecks.find((c) => c.id === id) ?? null;
}

type ReceiptPatch = Partial<Pick<ReceiptCheck, "application_id" | "status" | "reasons" | "ocr_text" | "image_path" | "image_deleted_at" | "decided_at">>;
export async function updateReceiptChecks(ids: string[], patch: ReceiptPatch) {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  if (sb) {
    const db = sb;
    await inChunks(ok, async (chunk) => {
      const { error } = await db.from("receipt_checks").update(patch).in("id", chunk);
      if (error) throw error;
      return [];
    });
    return;
  }
  for (const c of mem.receiptChecks) if (ok.includes(c.id)) Object.assign(c, patch);
}

// 수강증 사진만 바로 지워요 (자동 확인된 수강증 · 기록과 읽은 값은 남아요)
export async function dropReceiptImage(id: string, path: string | null) {
  if (!path) return;
  if (sb) await sb.storage.from(RECEIPT_BUCKET).remove([path]);
  else delete mem.photos[path];
  await updateReceiptChecks([id], { image_path: null, image_deleted_at: new Date().toISOString() });
}

// 신청서에 연결된 수강증 기록 (관리 화면)
export async function receiptChecksFor(appIds: string[]): Promise<ReceiptCheck[]> {
  const ok = appIds.filter(isUuid);
  if (ok.length === 0) return [];
  if (sb) {
    const db = sb;
    return inChunks(ok, async (chunk) => {
      const { data, error } = await db.from("receipt_checks").select("*").in("application_id", chunk);
      if (error) throw error;
      return (data ?? []) as ReceiptCheck[];
    });
  }
  return mem.receiptChecks.filter((c) => c.application_id && ok.includes(c.application_id));
}

// 확인이 필요한 수강증 (최신순)
export async function listReceiptChecks(status: ReceiptCheck["status"]): Promise<ReceiptCheck[]> {
  if (sb) {
    const db = sb;
    return allRows<ReceiptCheck>((from, to) => db.from("receipt_checks").select("*").eq("status", status).order("created_at", { ascending: false }).order("id").range(from, to));
  }
  return mem.receiptChecks.filter((c) => c.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// 같은 사진(지문)이나 같은 초에 캡처한 수강증으로 낸 다른 신청 찾기
export async function findReceiptTwins(hash: string | null, capturedAt: string | null): Promise<ReceiptCheck[]> {
  const out: ReceiptCheck[] = [];
  for (const [col, value] of [["image_hash", hash], ["captured_at", capturedAt]] as const) {
    if (!value) continue;
    if (sb) {
      const { data, error } = await sb.from("receipt_checks").select("*").eq(col, value).not("application_id", "is", null).limit(20);
      if (error) throw error;
      out.push(...((data ?? []) as ReceiptCheck[]));
    } else out.push(...mem.receiptChecks.filter((c) => c[col] === value && c.application_id));
  }
  return [...new Map(out.map((c) => [c.id, c])).values()];
}

export async function receiptImageUrl(path: string): Promise<string | null> {
  if (sb) {
    const { data, error } = await sb.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 60 * 10);
    if (error) throw error;
    return data?.signedUrl ?? null;
  }
  return mem.photos[path] ?? null;
}

// 지금 보관 중인 수강증 사진 수·용량 (관리 화면 용량 표시)
export async function receiptImageUsage(): Promise<{ images: number; bytes: number }> {
  if (sb) {
    const db = sb;
    const rows = await allRows<{ image_bytes: number | null }>((from, to) => db.from("receipt_checks").select("image_bytes").not("image_path", "is", null).order("id").range(from, to));
    return { images: rows.length, bytes: rows.reduce((s, r) => s + (r.image_bytes ?? 0), 0) };
  }
  const rows = mem.receiptChecks.filter((c) => c.image_path);
  return { images: rows.length, bytes: rows.reduce((s, r) => s + (r.image_bytes ?? 0), 0) };
}

// 자동 정리 (관리 화면을 열 때): ① 제출하지 않은 기록은 하루 뒤 기록째 삭제 ② 확인이 끝난 수강증은 7일 뒤 사진·원문만 삭제
// ③ 신청이 지워져 연결이 풀린 기록은 7일 뒤 삭제. 읽은 값·까닭은 남겨요(같은 수강증 다시 쓰기 확인용).
export async function purgeReceipts(nowMs = Date.now(), keepDays = 7) {
  const day = 24 * 3600 * 1000;
  const unsentBefore = new Date(nowMs - day).toISOString();
  const decidedBefore = new Date(nowMs - keepDays * day).toISOString();
  let rows: ReceiptCheck[];
  if (sb) {
    const db = sb;
    rows = await allRows<ReceiptCheck>((from, to) => db.from("receipt_checks").select("id,status,application_id,created_at,decided_at,image_path,ocr_text").or("image_path.not.is.null,ocr_text.not.is.null,application_id.is.null").order("id").range(from, to));
  } else rows = [...mem.receiptChecks];
  const drop = rows.filter((c) => (c.status === "read" && c.created_at < unsentBefore) || (c.status !== "read" && !c.application_id && c.created_at < decidedBefore));
  const strip = rows.filter((c) => !drop.includes(c) && (c.status === "approved" || c.status === "auto") && (c.image_path || c.ocr_text) && (c.decided_at ?? c.created_at) < decidedBefore);
  const paths = [...drop, ...strip].flatMap((c) => (c.image_path ? [c.image_path] : []));
  if (paths.length) {
    if (sb) await sb.storage.from(RECEIPT_BUCKET).remove(paths);
    else for (const p of paths) delete mem.photos[p];
  }
  if (drop.length) {
    if (sb) {
      const db = sb;
      await inChunks(drop.map((c) => c.id), async (chunk) => {
        const { error } = await db.from("receipt_checks").delete().in("id", chunk);
        if (error) throw error;
        return [];
      });
    } else mem.receiptChecks = mem.receiptChecks.filter((c) => !drop.includes(c));
  }
  if (strip.length) await updateReceiptChecks(strip.map((c) => c.id), { image_path: null, ocr_text: null, image_deleted_at: new Date(nowMs).toISOString() });
  return { dropped: drop.length, stripped: strip.length };
}

// ── 공지 ───────────────────────────────────────
export type NoticeRead ={ notice_id: string; app_id: string; read_at?: string; cohort?: string | null };
export type NoticeFields = Omit<Notice, "id" | "created_at">;

export const listNotices = () => memo("notices", listNoticesRaw);
async function listNoticesRaw(): Promise<Notice[]> {
  if (sb) {
    const { data, error } = await sb.from("site_notices").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data as Notice[];
  }
  return [...mem.notices].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// 학생 화면용: 시작했고 아직 안 끝난 공지만 (매달 반복 공지는 항상)
export const listCurrentNotices = (today: string) => memo(`notices:current:${today}`, async (): Promise<Notice[]> => {
  if (sb) {
    const { data, error } = await sb.from("site_notices").select("*").lte("starts_on", today).or(`repeat_monthly.eq.true,ends_on.gte.${today}`).order("created_at", { ascending: false });
    if (error) throw error;
    return data as Notice[];
  }
  return (await listNoticesRaw()).filter((n) => n.starts_on <= today && (n.repeat_monthly || n.ends_on >= today));
});

export async function createNotice(n: NoticeFields) {
  forget("notices");
  if (sb) {
    const { error } = await sb.from("site_notices").insert(n);
    if (error) throw error;
    return;
  }
  mem.notices.push({ ...n, id: crypto.randomUUID(), created_at: new Date().toISOString() });
}

export async function updateNotice(id: string, n: Partial<NoticeFields>) {
  forget("notices");
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("site_notices").update(n).eq("id", id);
    if (error) throw error;
    return;
  }
  const x = mem.notices.find((m) => m.id === id);
  if (x) Object.assign(x, n);
}

export async function deleteNotice(id: string) {
  forget("notices");
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("site_notices").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  mem.notices = mem.notices.filter((n) => n.id !== id);
  mem.noticeReads = mem.noticeReads.filter((r) => r.notice_id !== id);
}

export async function listNoticeReads(filter: { appIds?: string[] } = {}): Promise<NoticeRead[]> {
  const ids = filter.appIds?.filter(isUuid);
  if (ids && ids.length === 0) return [];
  if (sb) {
    const db = sb;
    const run = (chunk?: string[]) => allRows<NoticeRead>((from, to) => {
      let q = db.from("site_notice_reads").select("notice_id,app_id,cohort").order("notice_id").order("app_id");
      if (chunk) q = q.in("app_id", chunk);
      return q.range(from, to);
    });
    return ids ? inChunks(ids, run) : run();
  }
  return mem.noticeReads.filter((r) => !ids || ids.includes(r.app_id));
}

// [확인했어요] 기록. 기수도 함께 남겨서 매달 반복 공지는 기수마다 다시 떠요.
export async function markNoticeRead(noticeId: string, apps: { id: string; cohort: string }[]) {
  const ok = apps.filter((a) => isUuid(a.id));
  if (!isUuid(noticeId) || ok.length === 0) return;
  const rows = ok.map((a) => ({ notice_id: noticeId, app_id: a.id, cohort: a.cohort, read_at: new Date().toISOString() }));
  if (sb) {
    const { error } = await sb.from("site_notice_reads").upsert(rows, { onConflict: "notice_id,app_id" });
    if (error) throw error;
    return;
  }
  for (const r of rows) {
    const old = mem.noticeReads.find((x) => x.notice_id === r.notice_id && x.app_id === r.app_id);
    if (old) Object.assign(old, r);
    else mem.noticeReads.push(r);
  }
}

// ── 문풀반 데일리 테스트 ───────────────────────
export async function listTestOverrides(cohort: string): Promise<TestOverride[]> {
  const { from, to } = monthRange(cohort); // 말일(30·31일)을 직접 만들지 않아요
  if (sb) {
    const { data, error } = await sb.from("test_overrides").select("*").gte("day", from).lt("day", to);
    if (error) throw error;
    return data as TestOverride[];
  }
  return mem.testOverrides.filter((o) => o.day.startsWith(cohort));
}

// 두 개 보는 날 (그날 그 종류 테스트 2개, 이후 번호가 밀려요)
export async function listTestDoubles(cohort: string): Promise<TestDouble[]> {
  const { from, to } = monthRange(cohort); // 말일(30·31일)을 직접 만들지 않아요
  if (sb) {
    const { data, error } = await sb.from("test_doubles").select("day,kind").gte("day", from).lt("day", to);
    if (error) throw error;
    return data as TestDouble[];
  }
  return mem.testDoubles.filter((o) => o.day.startsWith(cohort));
}

export async function setTestDouble(d: TestDouble, on: boolean) {
  if (sb) {
    const { error } = on
      ? await sb.from("test_doubles").upsert(d, { onConflict: "day,kind" })
      : await sb.from("test_doubles").delete().eq("day", d.day).eq("kind", d.kind);
    if (error) throw error;
    return;
  }
  mem.testDoubles = mem.testDoubles.filter((x) => !(x.day === d.day && x.kind === d.kind));
  if (on) mem.testDoubles.push(d);
}

export async function saveTestOverride(o: TestOverride) {
  if (sb) {
    const { error } = await sb.from("test_overrides").upsert(o, { onConflict: "day,kind" });
    if (error) throw error;
    return;
  }
  mem.testOverrides = [...mem.testOverrides.filter((x) => !(x.day === o.day && x.kind === o.kind)), o];
}

export async function deleteTestOverride(day: string, kind: TestKind) {
  if (sb) {
    const { error } = await sb.from("test_overrides").delete().eq("day", day).eq("kind", kind);
    if (error) throw error;
    return;
  }
  mem.testOverrides = mem.testOverrides.filter((x) => !(x.day === day && x.kind === kind));
}

export async function listTestResults(filter: { cohort?: string; day?: string; appIds?: string[] }): Promise<TestResult[]> {
  const ids = filter.appIds?.filter(isUuid);
  if (ids && ids.length === 0) return [];
  if (sb) {
    const db = sb;
    const run = (chunk?: string[]) => allRows<TestResult>((from, to) => {
      let q = db.from("test_results").select("*").order("day").order("kind").order("id");
      if (filter.cohort) q = q.eq("cohort", filter.cohort);
      if (filter.day) q = q.eq("day", filter.day);
      if (chunk) q = q.in("app_id", chunk);
      return q.range(from, to);
    });
    return ids ? inChunks(ids, run) : run();
  }
  return mem.testResults.filter((r) => (!filter.cohort || r.cohort === filter.cohort) && (!filter.day || r.day === filter.day) && (!ids || ids.includes(r.app_id)));
}

export async function saveTestResult(r: Omit<TestResult, "id" | "submitted_at">) {
  const row = { ...r, submitted_at: new Date().toISOString() };
  if (sb) {
    const { error } = await sb.from("test_results").upsert(row, { onConflict: "app_id,day,kind,test_no" });
    if (error) throw error;
    return;
  }
  const old = mem.testResults.find((x) => x.app_id === r.app_id && x.day === r.day && x.kind === r.kind && x.test_no === r.test_no);
  if (old) Object.assign(old, row);
  else mem.testResults.push({ ...row, id: crypto.randomUUID() });
}

// ── 자주 묻는 질문 · 질문함 ─────────────────────────
export async function listFaq(): Promise<FaqItem[]> {
  if (sb) {
    const { data, error } = await sb.from("faq_items").select("*").order("sort_order").order("created_at");
    if (error) throw error;
    return data as FaqItem[];
  }
  return [...mem.faq].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export async function getFaq(id: string): Promise<FaqItem | null> {
  if (!isUuid(id)) return null;
  if (sb) {
    const { data, error } = await sb.from("faq_items").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as FaqItem) ?? null;
  }
  return mem.faq.find((f) => f.id === id) ?? null;
}

export async function createFaq(item: Pick<FaqItem, "category" | "question" | "answer" | "published" | "sort_order">) {
  if (sb) {
    const { error } = await sb.from("faq_items").insert(item);
    if (error) throw error;
    return;
  }
  mem.faq.push({ ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() });
}

export async function updateFaq(id: string, patch: Partial<Pick<FaqItem, "category" | "question" | "answer" | "published" | "sort_order">>) {
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("faq_items").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const item = mem.faq.find((f) => f.id === id);
  if (item) Object.assign(item, patch);
}

export async function deleteFaq(id: string) {
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("faq_items").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  mem.faq = mem.faq.filter((f) => f.id !== id);
}

export async function listQuestions(): Promise<StudentQuestion[]> {
  if (sb) {
    const { data, error } = await sb.from("student_questions").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data as StudentQuestion[];
  }
  return [...mem.questions].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createQuestion(q: Pick<StudentQuestion, "app_id" | "name" | "kind" | "content">) {
  if (sb) {
    const { error } = await sb.from("student_questions").insert(q);
    if (error) throw error;
    return;
  }
  mem.questions.push({ ...q, id: crypto.randomUUID(), checked: false, created_at: new Date().toISOString() });
}

export async function updateQuestion(id: string, patch: Partial<Pick<StudentQuestion, "checked">>) {
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("student_questions").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const q = mem.questions.find((x) => x.id === id);
  if (q) Object.assign(q, patch);
}

export async function getQuestion(id: string): Promise<StudentQuestion | null> {
  if (!isUuid(id)) return null;
  if (sb) {
    const { data, error } = await sb.from("student_questions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as StudentQuestion) ?? null;
  }
  return mem.questions.find((x) => x.id === id) ?? null;
}

// ── LC 음원 zip (파일은 비공개 보관함에 브라우저에서 바로 올려요) ──────
export const AUDIO_BUCKET = "lc-audio";
const sortAudios = (list: LcAudio[]) => [...list].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

export async function listAudios(cohort?: string): Promise<LcAudio[]> {
  if (sb) {
    let query = sb.from("lc_audios").select("*").order("sort_order").order("created_at");
    if (cohort) query = query.eq("cohort", cohort);
    const { data, error } = await query;
    if (error) throw error;
    return data as LcAudio[];
  }
  return sortAudios(mem.audios.filter((a) => !cohort || a.cohort === cohort));
}

export async function getAudio(id: string): Promise<LcAudio | null> {
  if (!isUuid(id)) return null;
  if (sb) {
    const { data, error } = await sb.from("lc_audios").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as LcAudio) ?? null;
  }
  return mem.audios.find((a) => a.id === id) ?? null;
}

// 음원 링크 추가 (제목 + 구글 드라이브 공유 링크)
export async function createAudioLink(audio: Pick<LcAudio, "cohort" | "book" | "title" | "sort_order"> & { link_url: string }) {
  if (sb) {
    const { error } = await sb.from("lc_audios").insert({ ...audio, storage_path: null, size_bytes: 0 });
    if (error) throw error;
    return;
  }
  mem.audios.push({ ...audio, storage_path: null, size_bytes: 0, id: crypto.randomUUID(), created_at: new Date().toISOString() });
}

export async function setAudioOrder(id: string, sort_order: number) {
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("lc_audios").update({ sort_order }).eq("id", id);
    if (error) throw error;
    return;
  }
  const audio = mem.audios.find((a) => a.id === id);
  if (audio) audio.sort_order = sort_order;
}

// 음원 기록을 지워요. 예전 방식 음원은 보관함 파일도 함께 지워요.
export async function deleteAudios(list: LcAudio[]) {
  if (list.length === 0) return;
  const ids = list.map((a) => a.id);
  if (sb) {
    const paths = list.flatMap((a) => (a.storage_path ? [a.storage_path] : []));
    if (paths.length) {
      const { error: removeError } = await sb.storage.from(AUDIO_BUCKET).remove(paths);
      if (removeError) throw removeError;
    }
    const { error } = await sb.from("lc_audios").delete().in("id", ids);
    if (error) throw error;
    return;
  }
  mem.audios = mem.audios.filter((a) => !ids.includes(a.id));
}

// 짧게 만료되는 다운로드 주소 (링크 공유 방지)
export async function audioDownloadUrl(path: string, fileName: string): Promise<string | null> {
  if (!sb) return null;
  const { data, error } = await sb.storage.from(AUDIO_BUCKET).createSignedUrl(path, 60, { download: fileName });
  if (error) throw error;
  return data?.signedUrl ?? null;
}

// ── 첫 수업 미션 ─────────────────────────────────
export async function listMissions(appIds: string[]): Promise<Mission[]> {
  const ok = appIds.filter(isUuid);
  if (ok.length === 0) return [];
  if (sb) {
    const db = sb;
    return inChunks(ok, (chunk) => allRows<Mission>((from, to) => db.from("student_missions").select("*").in("app_id", chunk).order("app_id").range(from, to)));
  }
  return mem.missions.filter((m) => ok.includes(m.app_id));
}

export async function saveMission(mission: Omit<Mission, "updated_at">) {
  const row = { ...mission, updated_at: new Date().toISOString() };
  if (sb) {
    const { error } = await sb.from("student_missions").upsert(row, { onConflict: "app_id" });
    if (error) throw error;
    return;
  }
  mem.missions = [...mem.missions.filter((m) => m.app_id !== row.app_id), row];
}

// ── 특강 ────────────────────────────────────────
const SPECIAL_BUCKET = "special-lecture-materials";
type SpecialLectureFields = Pick<SpecialLecture, "event_date" | "title" | "starts_at" | "ends_at" | "registration_deadline"> & { material_note?: string | null; published?: boolean };

export const listSpecialLectures = () => memo("specials", listSpecialLecturesRaw);
async function listSpecialLecturesRaw(): Promise<SpecialLecture[]> {
  if (sb) {
    const { data, error } = await sb.from("special_lectures").select("*").order("event_date").order("starts_at");
    if (error) throw error;
    return data as SpecialLecture[];
  }
  return [...mem.specialLectures].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.starts_at.localeCompare(b.starts_at));
}

export async function getSpecialLecture(id: string): Promise<SpecialLecture | null> {
  if (!isUuid(id)) return null;
  if (sb) {
    const { data, error } = await sb.from("special_lectures").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as SpecialLecture) ?? null;
  }
  return mem.specialLectures.find((event) => event.id === id) ?? null;
}

export async function createSpecialLecture(fields: SpecialLectureFields) {
  forget("specials");
  if (sb) {
    const { error } = await sb.from("special_lectures").insert(fields);
    if (error) throw error;
    return;
  }
  mem.specialLectures.push({ ...fields, material_note: fields.material_note ?? null, published: fields.published ?? true, id: crypto.randomUUID(), youtube_id: null, created_at: new Date().toISOString() });
}

export async function updateSpecialLecture(id: string, patch: Partial<SpecialLectureFields & Pick<SpecialLecture, "youtube_id">>) {
  forget("specials");
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("special_lectures").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const event = mem.specialLectures.find((item) => item.id === id);
  if (event) Object.assign(event, patch);
}

// 특강을 지우면 신청 명단과 자료 파일도 함께 지워져요.
export async function deleteSpecialLecture(id: string) {
  forget("specials");
  if (!isUuid(id)) return;
  const paths = (await listSpecialMaterials(id)).flatMap((material) => (material.storage_path ? [material.storage_path] : []));
  if (sb) {
    if (paths.length > 0) await sb.storage.from(SPECIAL_BUCKET).remove(paths);
    const { error } = await sb.from("special_lectures").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  for (const path of paths) delete mem.photos[path];
  mem.specialLectures = mem.specialLectures.filter((event) => event.id !== id);
  mem.specialRegistrations = mem.specialRegistrations.filter((registration) => registration.special_lecture_id !== id);
  mem.specialMaterials = mem.specialMaterials.filter((material) => material.special_lecture_id !== id);
}

export async function listSpecialRegistrations(special_lecture_id?: string): Promise<SpecialRegistration[]> {
  if (sb) {
    const db = sb;
    return allRows<SpecialRegistration>((from, to) => {
      let query = db.from("special_lecture_registrations").select("*").order("created_at", { ascending: true }).order("id");
      if (special_lecture_id) query = query.eq("special_lecture_id", special_lecture_id);
      return query.range(from, to);
    });
  }
  return mem.specialRegistrations.filter((registration) => !special_lecture_id || registration.special_lecture_id === special_lecture_id);
}

// 강의실 로그인한 학생(수강 신청 id 목록)의 특강 신청
export async function getSpecialRegistrationsFor(application_ids: string[]): Promise<SpecialRegistration[]> {
  const ok = application_ids.filter(isUuid);
  if (ok.length === 0) return [];
  if (sb) {
    const db = sb;
    return inChunks(ok, (chunk) => allRows<SpecialRegistration>((from, to) => db.from("special_lecture_registrations").select("*").in("application_id", chunk).order("id").range(from, to)));
  }
  return mem.specialRegistrations.filter((registration) => registration.application_id && ok.includes(registration.application_id));
}

type SpecialRegistrationPatch = Partial<Pick<SpecialRegistration, "deposit" | "deposit_paid_at" | "deposit_refunded_at">>;

// 현장 신청 여러 건의 보증금·참석·환급 상태를 한 번에 바꿔요.
export async function updateOnsiteRegistrations(ids: string[], patch: SpecialRegistrationPatch) {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  if (sb) {
    const db = sb;
    await inChunks(ok, async (chunk) => {
      const { error } = await db.from("special_lecture_registrations").update(patch).in("id", chunk).eq("mode", "onsite");
      if (error) throw error;
      return [];
    });
    return;
  }
  for (const r of mem.specialRegistrations) if (ok.includes(r.id) && r.mode === "onsite") Object.assign(r, patch);
}

// 신청 후 정해진 시간(분) 안에 입금이 없으면 자동 취소해요. (페이지를 열거나 입금 문자가 올 때마다 확인)
export async function expireSpecialDeposits(minutes: number) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  if (sb) {
    const { error } = await sb.from("special_lecture_registrations").update({ deposit: "cancelled" })
      .eq("mode", "onsite").eq("deposit", "pending").lt("created_at", cutoff);
    if (error) throw error;
    return;
  }
  for (const r of mem.specialRegistrations) if (r.mode === "onsite" && r.deposit === "pending" && r.created_at < cutoff) r.deposit = "cancelled";
}

// 입금을 기다리는 현장 신청 (입금 대기·확인 필요)
export async function listWaitingDeposits(): Promise<SpecialRegistration[]> {
  if (sb) {
    const { data, error } = await sb.from("special_lecture_registrations").select("*").eq("mode", "onsite").in("deposit", ["pending", "review"]);
    if (error) throw error;
    return data as SpecialRegistration[];
  }
  return mem.specialRegistrations.filter((r) => r.mode === "onsite" && (r.deposit === "pending" || r.deposit === "review"));
}

// ── 입금 문자 기록 (원문 없이 이름·금액·시각·결과만) ──
export type DepositEvent = {
  id: string;
  target: "special" | "book";
  name: string;
  amount: number;
  received_at: string;
  result: "matched" | "review" | "unmatched" | "resolved" | "dismissed" | "waiting"; // waiting = 신청서보다 먼저 온 교재비 입금
  registration_id: string | null; // 특강 보증금이면 특강 신청
  application_id: string | null; // 교재비면 수강 신청
  ybm_order_id?: string | null; // YBM 인강 교재 주문
};

export async function createDepositEvent(e: Pick<DepositEvent, "target" | "name" | "amount" | "result" | "registration_id" | "application_id" | "ybm_order_id">) {
  if (sb) {
    const { error } = await sb.from("deposit_events").insert(e);
    if (error) throw error;
    return;
  }
  mem.depositEvents.push({ ...e, id: crypto.randomUUID(), received_at: new Date().toISOString() });
}

export async function listDepositEvents(limit = 50): Promise<DepositEvent[]> {
  if (sb) {
    const { data, error } = await sb.from("deposit_events").select("*").order("received_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data as DepositEvent[];
  }
  return [...mem.depositEvents].sort((a, b) => b.received_at.localeCompare(a.received_at)).slice(0, limit);
}

// 신청서를 기다리는 입금 (최근 n일)
export async function listWaitingDepositEvents(days = 14): Promise<DepositEvent[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  if (sb) {
    const { data, error } = await sb.from("deposit_events").select("*").eq("result", "waiting").gte("received_at", since).order("received_at", { ascending: false });
    if (error) throw error;
    return data as DepositEvent[];
  }
  return mem.depositEvents.filter((e) => e.result === "waiting" && e.received_at >= since).sort((a, b) => b.received_at.localeCompare(a.received_at));
}

export async function updateDepositEvent(id: string, patch: Partial<Pick<DepositEvent, "result" | "registration_id" | "application_id" | "ybm_order_id">>) {
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("deposit_events").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const e = mem.depositEvents.find((x) => x.id === id);
  if (e) Object.assign(e, patch);
}

export async function createSpecialRegistration(registration: Pick<SpecialRegistration, "special_lecture_id" | "application_id" | "mode" | "name" | "deposit">): Promise<string> {
  if (sb) {
    const { data, error } = await sb.from("special_lecture_registrations").insert(registration).select("id").single();
    if (error) throw error;
    return data.id as string;
  }
  const id = crypto.randomUUID();
  mem.specialRegistrations.push({ ...registration, id, deposit_paid_at: null, created_at: new Date().toISOString() });
  return id;
}

export async function deleteSpecialRegistration(id: string) {
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("special_lecture_registrations").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  mem.specialRegistrations = mem.specialRegistrations.filter((registration) => registration.id !== id);
}

export async function listSpecialMaterials(special_lecture_id: string): Promise<SpecialMaterial[]> {
  if (sb) {
    const { data, error } = await sb.from("special_lecture_materials").select("*").eq("special_lecture_id", special_lecture_id).order("created_at", { ascending: true });
    if (error) throw error;
    return data as SpecialMaterial[];
  }
  return mem.specialMaterials.filter((material) => material.special_lecture_id === special_lecture_id);
}

export async function getSpecialMaterial(id: string): Promise<SpecialMaterial | null> {
  if (!isUuid(id)) return null;
  if (sb) {
    const { data, error } = await sb.from("special_lecture_materials").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as SpecialMaterial) ?? null;
  }
  return mem.specialMaterials.find((material) => material.id === id) ?? null;
}

// 특강 자료 링크 추가 (제목 + 구글 드라이브 공유 링크)
export async function createSpecialMaterialLink(special_lecture_id: string, title: string, link_url: string) {
  const row = { special_lecture_id, file_name: title.slice(0, 200), storage_path: null, link_url };
  if (sb) {
    const { error } = await sb.from("special_lecture_materials").insert(row);
    if (error) throw error;
    return;
  }
  mem.specialMaterials.push({ ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() });
}

export async function deleteSpecialMaterial(id: string) {
  const material = await getSpecialMaterial(id);
  if (!material) return;
  if (sb) {
    if (material.storage_path) await sb.storage.from(SPECIAL_BUCKET).remove([material.storage_path]);
    const { error } = await sb.from("special_lecture_materials").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  if (material.storage_path) delete mem.photos[material.storage_path];
  mem.specialMaterials = mem.specialMaterials.filter((item) => item.id !== id);
}

// 보관함 정리: 지운 특강(폴더 이름 = 특강 id)의 자료 파일을 보관함에서 지워요. 지운 파일 수를 돌려줘요.
// (특강 표에서 지운 뒤 남은 파일. 지금 있는 특강의 파일은 건드리지 않아요)
export async function cleanupOrphanSpecialFiles(): Promise<number> {
  if (!sb) {
    const live = new Set(mem.specialLectures.map((e) => e.id));
    const orphans = Object.keys(mem.photos).filter((p) => /^[0-9a-f-]{36}\//i.test(p) && !live.has(p.split("/")[0]) && !mem.specialMaterials.some((m) => m.storage_path === p));
    for (const p of orphans) delete mem.photos[p];
    return orphans.length;
  }
  const db = sb;
  const bucket = db.storage.from(SPECIAL_BUCKET);
  const listAll = async (prefix: string) => {
    const out: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await bucket.list(prefix, { limit: 1000, offset });
      if (error) throw error;
      out.push(...(data ?? []).map((x) => x.name));
      if ((data ?? []).length < 1000) return out;
    }
  };
  const { data: events, error } = await db.from("special_lectures").select("id");
  if (error) throw error;
  const live = new Set((events ?? []).map((e) => e.id as string));
  const folders = (await listAll("")).filter((name) => isUuid(name) && !live.has(name));
  let removed = 0;
  for (const folder of folders) {
    const paths = (await listAll(folder)).map((name) => `${folder}/${name}`);
    for (let i = 0; i < paths.length; i += 100) {
      const { error: removeError } = await bucket.remove(paths.slice(i, i + 100));
      if (removeError) throw removeError;
    }
    removed += paths.length;
  }
  return removed;
}

export async function specialMaterialUrl(path: string, fileName: string): Promise<string | null> {
  if (sb) {
    const { data, error } = await sb.storage.from(SPECIAL_BUCKET).createSignedUrl(path, 60 * 10, { download: fileName });
    if (error) throw error;
    return data?.signedUrl ?? null;
  }
  return mem.photos[path] ?? null;
}

// ── 설정 ───────────────────────────────────────
// 설정은 한 요청에 한 번 전부 읽어 두고 꺼내 써요 (getSetting을 여러 번 불러도 DB는 한 번)
export function allSettings(): Promise<Record<string, string>> {
  return memo("settings", async () => {
    if (!sb) return { ...mem.settings };
    const db = sb;
    const rows = await allRows<{ key: string; value: string | null }>((from, to) => db.from("settings").select("key,value").order("key").range(from, to));
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
  });
}

export async function getSetting(k: string): Promise<string> {
  try {
    return (await allSettings())[k] ?? "";
  } catch {
    return ""; // 예전처럼 읽기에 실패하면 빈 값
  }
}

export async function setSetting(k: string, v: string) {
  forget("settings");
  if (sb) {
    const { error } = await sb.from("settings").upsert({ key: k, value: v });
    if (error) throw error;
    return;
  }
  mem.settings[k] = v;
}

// 현재 모집 기수: 관리 화면 기본 표시용. 관리 페이지에서 정한 값, 비우면 신청서 수강 월 규칙대로 자동.
// (새 신청은 학생이 신청서에서 고른 달로 저장돼요)
export async function currentCohort() {
  const set = await getSetting("current_cohort");
  if (set) return set;
  try {
    const { autoRecruitCohort } = await import("./signupMonthsServer");
    return await autoRecruitCohort();
  } catch {
    return thisMonthKST();
  }
}

// 그 기수의 교재 회차. 관리 페이지에서 바꿨으면 그 값, 없으면 달마다 번갈아 자동 계산.
// 교재 회차는 완전 자동: 홀수달 1회차, 짝수달 2회차 (예전 round_<기수> 덮어쓰기 값은 보지 않아요)
export async function roundFor(cohort: string): Promise<1 | 2> {
  return roundOf(cohort);
}

// ── 출석·숙제 스티커 ─────────────────────────────
export async function addAttendance(app_id: string, day: string) {
  if (sb) {
    const { error } = await sb.from("attendance").upsert({ app_id, day }, { onConflict: "app_id,day", ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  if (!mem.attendance.some((x) => x.app_id === app_id && x.day === day)) mem.attendance.push({ app_id, day });
}

// createdAt을 주면 그 시각에 제출한 것으로 기록해요. (관리자가 지난 수업일에 붙여도 별이 보이게)
// 관리자 출결 수정: 출석(present) · 지각(late) · 결석(absent = 기록 지우기)
export async function setAttendanceState(app_id: string, day: string, state: "present" | "late" | "absent") {
  if (!isUuid(app_id) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  if (sb) {
    if (state === "absent") {
      const { error } = await sb.from("attendance").delete().eq("app_id", app_id).eq("day", day);
      if (error) throw error;
      return;
    }
    const { error } = await sb.from("attendance").upsert({ app_id, day, late: state === "late" }, { onConflict: "app_id,day" });
    if (error) throw error;
    return;
  }
  mem.attendance = mem.attendance.filter((x) => !(x.app_id === app_id && x.day === day));
  if (state !== "absent") mem.attendance.push({ app_id, day, late: state === "late" } as Attendance);
}

export async function addHomeworkSticker(app_id: string, day: string, createdAt?: string) {
  if (sb) {
    const row: Record<string, string | null> = { app_id, day, photo_path: null };
    if (createdAt) row.created_at = createdAt;
    const { error } = await sb.from("homework").upsert(row, { onConflict: "app_id,day", ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  if (!mem.homework.some((x) => x.app_id === app_id && x.day === day)) mem.homework.push({ app_id, day, photo_path: null, created_at: createdAt ?? new Date().toISOString() });
}

// 관리자가 붙이는 ⭐: 제출 시각을 그 수업일 낮 12시(한국)로 기록해서 언제 붙여도 별로 인정돼요.
export async function setHomeworkStar(app_id: string, day: string) {
  const created_at = new Date(`${day}T12:00:00+09:00`).toISOString();
  if (sb) {
    const { error } = await sb.from("homework").upsert({ app_id, day, created_at }, { onConflict: "app_id,day" });
    if (error) throw error;
    return;
  }
  const old = mem.homework.find((x) => x.app_id === app_id && x.day === day);
  if (old) old.created_at = created_at;
  else mem.homework.push({ app_id, day, photo_path: null, created_at });
}

export async function deleteHomeworkSticker(app_id: string, day: string) {
  if (sb) {
    const { data, error: selectError } = await sb.from("homework").select("photo_path").eq("app_id", app_id).eq("day", day).maybeSingle();
    if (selectError) throw selectError;
    const { error } = await sb.from("homework").delete().eq("app_id", app_id).eq("day", day);
    if (error) throw error;
    if (data?.photo_path) {
      const { error: removeError } = await sb.storage.from(BUCKET).remove([data.photo_path as string]);
      if (removeError) throw removeError;
    }
    return;
  }
  const row = mem.homework.find((x) => x.app_id === app_id && x.day === day);
  if (row?.photo_path) delete mem.photos[row.photo_path];
  mem.homework = mem.homework.filter((x) => !(x.app_id === app_id && x.day === day));
}

export async function listStamps(appIds: string[]): Promise<{ attendance: Attendance[]; homework: Homework[] }> {
  const ok = appIds.filter(isUuid);
  if (ok.length === 0) return { attendance: [], homework: [] };
  if (sb) {
    const db = sb;
    const [attendance, homework] = await Promise.all([
      inChunks(ok, (chunk) => allRows<Attendance>((from, to) => db.from("attendance").select("app_id, day, late").in("app_id", chunk).order("app_id").order("day").range(from, to))),
      inChunks(ok, (chunk) => allRows<Homework>((from, to) => db.from("homework").select("app_id, day, photo_path, created_at").in("app_id", chunk).order("app_id").order("day").range(from, to))),
    ]);
    return { attendance, homework };
  }
  return {
    attendance: mem.attendance.filter((x) => ok.includes(x.app_id)),
    homework: mem.homework.filter((x) => ok.includes(x.app_id)),
  };
}

// 출석 기록만 (숙제는 읽지 않아요). from을 주면 그날 이후만.
export async function listAttendance(appIds: string[], from?: string): Promise<Attendance[]> {
  const ok = appIds.filter(isUuid);
  if (ok.length === 0) return [];
  if (sb) {
    const db = sb;
    return inChunks(ok, (chunk) => allRows<Attendance>((f, t) => {
      let q = db.from("attendance").select("app_id, day").in("app_id", chunk);
      if (from) q = q.gte("day", from);
      return q.order("app_id").order("day").range(f, t);
    }));
  }
  return mem.attendance.filter((x) => ok.includes(x.app_id) && (!from || x.day >= from));
}

const BUCKET = "homework";

export async function photoUrl(path: string): Promise<string | null> {
  if (sb) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  }
  return mem.photos[path] ?? null;
}

// 지난 기수 숙제 사진 지우기 (스티커 기록은 남김)
export async function deletePhotosBefore(cohort: string): Promise<number> {
  let n = 0;
  if (sb) {
    const { data: folders } = await sb.storage.from(BUCKET).list("", { limit: 1000 });
    for (const f of folders ?? []) {
      if (!(f.name < cohort)) continue;
      const { data: apps } = await sb.storage.from(BUCKET).list(f.name, { limit: 1000 });
      for (const a of apps ?? []) {
        const { data: files } = await sb.storage.from(BUCKET).list(`${f.name}/${a.name}`, { limit: 1000 });
        const paths = (files ?? []).map((x) => `${f.name}/${a.name}/${x.name}`);
        if (paths.length) {
          await sb.storage.from(BUCKET).remove(paths);
          n += paths.length;
        }
      }
    }
    return n;
  }
  for (const k of Object.keys(mem.photos)) if (k.split("/")[0] < cohort) { delete mem.photos[k]; n++; }
  return n;
}

// ── 스티커판 완성 선물 ───────────────────────────
export type GiftItem = { id: string; cohort: string; name: string; quantity: number | null; created_at: string };
export type GiftDraw = {
  id: string; cohort: string; student_key: string; app_id: string | null; name: string; klass: string; kind: string;
  gift_id: string | null; gift_name: string; code: string; drawn_at: string; sent_at: string | null;
};
const memGifts: { items: GiftItem[]; draws: GiftDraw[] } = ((globalThis as { __vellaGifts?: { items: GiftItem[]; draws: GiftDraw[] } }).__vellaGifts ??= { items: [], draws: [] });

export async function listGiftItems(cohort: string): Promise<GiftItem[]> {
  if (sb) {
    const { data, error } = await sb.from("gift_items").select("*").eq("cohort", cohort).order("created_at");
    if (error) throw error;
    return data as GiftItem[];
  }
  return memGifts.items.filter((g) => g.cohort === cohort);
}

export async function saveGiftItem(g: { id?: string; cohort: string; name: string; quantity: number | null }) {
  if (sb) {
    const { error } = g.id
      ? await sb.from("gift_items").update({ name: g.name, quantity: g.quantity }).eq("id", g.id)
      : await sb.from("gift_items").insert({ cohort: g.cohort, name: g.name, quantity: g.quantity });
    if (error) throw error;
    return;
  }
  const old = g.id ? memGifts.items.find((x) => x.id === g.id) : undefined;
  if (old) Object.assign(old, { name: g.name, quantity: g.quantity });
  else memGifts.items.push({ id: crypto.randomUUID(), cohort: g.cohort, name: g.name, quantity: g.quantity, created_at: new Date().toISOString() });
}

export async function deleteGiftItem(id: string) {
  if (!isUuid(id)) return;
  if (sb) {
    const { error } = await sb.from("gift_items").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  memGifts.items = memGifts.items.filter((g) => g.id !== id);
  for (const d of memGifts.draws) if (d.gift_id === id) d.gift_id = null;
}

export async function listGiftDraws(cohort: string): Promise<GiftDraw[]> {
  if (sb) {
    const db = sb;
    return allRows<GiftDraw>((from, to) => db.from("gift_draws").select("*").eq("cohort", cohort).order("drawn_at", { ascending: false }).order("id").range(from, to));
  }
  return memGifts.draws.filter((d) => d.cohort === cohort).sort((a, b) => b.drawn_at.localeCompare(a.drawn_at));
}

export async function getGiftDraw(cohort: string, studentKey: string): Promise<GiftDraw | null> {
  if (sb) {
    const { data, error } = await sb.from("gift_draws").select("*").eq("cohort", cohort).eq("student_key", studentKey).maybeSingle();
    if (error) throw error;
    return (data as GiftDraw) ?? null;
  }
  return memGifts.draws.find((d) => d.cohort === cohort && d.student_key === studentKey) ?? null;
}

// 뽑기: DB 함수(draw_gift)가 잠금을 걸고 남은 수량 기준으로 정해요. 이미 뽑았으면 그 기록을 돌려줘요.
export async function drawGift(p: { cohort: string; student_key: string; app_id: string; name: string; klass: string; kind: string; code: string }): Promise<GiftDraw> {
  if (sb) {
    const { data, error } = await sb.rpc("draw_gift", {
      p_cohort: p.cohort, p_student_key: p.student_key, p_app_id: p.app_id, p_name: p.name, p_klass: p.klass, p_kind: p.kind, p_code: p.code,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as GiftDraw;
  }
  const existing = memGifts.draws.find((d) => d.cohort === p.cohort && d.student_key === p.student_key);
  if (existing) return existing;
  const used = (id: string) => memGifts.draws.filter((d) => d.cohort === p.cohort && d.gift_id === id).length;
  const items = memGifts.items.filter((g) => g.cohort === p.cohort);
  const limited = items.filter((g) => g.quantity !== null && g.quantity - used(g.id) > 0);
  let chosen: GiftItem | undefined;
  if (limited.length) {
    const total = limited.reduce((s, g) => s + (g.quantity! - used(g.id)), 0);
    let r = Math.random() * total;
    chosen = limited.find((g) => (r -= g.quantity! - used(g.id)) < 0) ?? limited.at(-1);
  } else {
    const unlimited = items.filter((g) => g.quantity === null);
    chosen = unlimited[Math.floor(Math.random() * unlimited.length)];
  }
  const row: GiftDraw = { ...p, id: crypto.randomUUID(), gift_id: chosen?.id ?? null, gift_name: chosen?.name ?? "벨라토익 선물", drawn_at: new Date().toISOString(), sent_at: null };
  memGifts.draws.push(row);
  return row;
}

export async function setGiftSent(ids: string[], sent: boolean) {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  const sent_at = sent ? new Date().toISOString() : null;
  if (sb) {
    const db = sb;
    await inChunks(ok, async (chunk) => {
      const { error } = await db.from("gift_draws").update({ sent_at }).in("id", chunk);
      if (error) throw error;
      return [];
    });
    return;
  }
  for (const d of memGifts.draws) if (ok.includes(d.id)) d.sent_at = sent_at;
}

// 인강 주문 지우기 (30분 자동 취소 후 7일 지난 주문 정리용). 수강증 사진도 함께 지워요.
export async function deleteYbmOrders(ids: string[]) {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  const photos = (await listYbmOrders()).filter((o) => ok.includes(o.id) && o.proof_path).map((o) => o.proof_path!);
  if (sb) {
    if (photos.length) await sb.storage.from(YBM_BUCKET).remove(photos);
    const db = sb;
    await inChunks(ok, async (chunk) => {
      const { error } = await db.from("ybm_orders").delete().in("id", chunk);
      if (error) throw error;
      return [];
    });
    return;
  }
  for (const p of photos) delete mem.photos[p];
  mem.ybmOrders = mem.ybmOrders.filter((o) => !ok.includes(o.id));
  for (const e of mem.depositEvents) if (e.ybm_order_id && ok.includes(e.ybm_order_id)) e.ybm_order_id = null;
}

// 입금 대기 신청·주문만 (30분 자동 취소 점검용, 전체를 읽지 않아 가벼워요)
export async function listPendingApplications(): Promise<Application[]> {
  if (sb) {
    const db = sb;
    return allRows<Application>((from, to) => db.from("applications").select(APP_COLS).eq("status", "pending").order("created_at").order("id").range(from, to));
  }
  return mem.apps.filter((a) => a.status === "pending");
}

export async function listPendingYbmOrders(): Promise<YbmOrder[]> {
  if (sb) {
    const { data, error } = await sb.from("ybm_orders").select("*").eq("status", "pending");
    if (error) throw error;
    return data as YbmOrder[];
  }
  return mem.ybmOrders.filter((o) => o.status === "pending");
}

// ── 구글·카카오 로그인 연결 (SQL 39) ─────────────
// provider + subject(구글 sub · 카카오 회원번호) → 학생 번호(account_id). 신청서 applications.account_id와 같은 번호예요.
export type LoginLink = {
  provider: "google" | "kakao";
  subject: string;
  account_id: string;
  email: string | null;
  nickname: string | null;
  created_at: string;
  last_login_at: string | null;
};

export async function getLoginLink(provider: LoginLink["provider"], subject: string): Promise<LoginLink | null> {
  if (sb) {
    const { data, error } = await sb.from("login_links").select("*").eq("provider", provider).eq("subject", subject).maybeSingle();
    if (error) throw error;
    return (data as LoginLink) ?? null;
  }
  return mem.loginLinks.find((l) => l.provider === provider && l.subject === subject) ?? null;
}

export async function listLoginLinks(accountIds: string[]): Promise<LoginLink[]> {
  const ok = [...new Set(accountIds.filter(isUuid))];
  if (ok.length === 0) return [];
  if (sb) {
    const db = sb;
    return inChunks(ok, async (chunk) => {
      const { data, error } = await db.from("login_links").select("*").in("account_id", chunk).order("created_at");
      if (error) throw error;
      return data as LoginLink[];
    });
  }
  return mem.loginLinks.filter((l) => ok.includes(l.account_id));
}

// 연결 저장 (이미 있으면 학생 번호·이메일·별명만 바꿔요) + 마지막 로그인 시각
export async function saveLoginLink(l: Pick<LoginLink, "provider" | "subject" | "account_id" | "email" | "nickname">) {
  const row = { ...l, last_login_at: new Date().toISOString() };
  if (sb) {
    const { error } = await sb.from("login_links").upsert(row, { onConflict: "provider,subject" });
    if (error) throw error;
    return;
  }
  const old = mem.loginLinks.find((x) => x.provider === l.provider && x.subject === l.subject);
  if (old) Object.assign(old, row);
  else mem.loginLinks.push({ ...row, created_at: row.last_login_at });
}

export async function touchLoginLink(provider: LoginLink["provider"], subject: string, patch: Pick<LoginLink, "email" | "nickname">) {
  const row = { ...patch, last_login_at: new Date().toISOString() };
  if (sb) {
    const { error } = await sb.from("login_links").update(row).eq("provider", provider).eq("subject", subject);
    if (error) throw error;
    return;
  }
  const old = mem.loginLinks.find((x) => x.provider === provider && x.subject === subject);
  if (old) Object.assign(old, row);
}

export async function deleteLoginLink(provider: LoginLink["provider"], subject: string) {
  if (sb) {
    const { error } = await sb.from("login_links").delete().eq("provider", provider).eq("subject", subject);
    if (error) throw error;
    return;
  }
  mem.loginLinks = mem.loginLinks.filter((x) => !(x.provider === provider && x.subject === subject));
}

// 이 학생 번호로 묶인 신청 (로그인할 때만 읽어요)
export async function appsByAccount(accountId: string): Promise<Application[]> {
  if (!isUuid(accountId)) return [];
  if (sb) {
    const { data, error } = await sb.from("applications").select(APP_COLS).eq("account_id", accountId);
    if (error) throw error;
    return data as Application[];
  }
  return mem.apps.filter((a) => a.account_id === accountId);
}

// 신청을 학생 번호에 묶어요: attach = 번호가 없던 신청, mergeFrom = 이 번호로 합칠 다른 번호(신청·로그인 연결 모두 옮겨요)
export async function linkAccount(accountId: string, attach: string[], mergeFrom: string[]) {
  forget("apps:");
  const ok = attach.filter(isUuid);
  const from = mergeFrom.filter((x) => isUuid(x) && x !== accountId);
  if (sb) {
    const db = sb;
    await inChunks(ok, async (chunk) => {
      const { error } = await db.from("applications").update({ account_id: accountId }).in("id", chunk).is("account_id", null);
      if (error) throw error;
      return [];
    });
    for (const m of from) {
      const a = await db.from("applications").update({ account_id: accountId }).eq("account_id", m);
      if (a.error) throw a.error;
      const b = await db.from("login_links").update({ account_id: accountId }).eq("account_id", m);
      if (b.error) throw b.error;
    }
    return;
  }
  for (const a of mem.apps) if ((ok.includes(a.id) && !a.account_id) || (a.account_id && from.includes(a.account_id))) a.account_id = accountId;
  for (const l of mem.loginLinks) if (from.includes(l.account_id)) l.account_id = accountId;
}


// ── 개인번호 6자리 · 첫토익 모의고사 성적 (SQL 43, 규칙 lib/mockScores.ts) ──

export type ExamResultRow = {
  result_id: string;
  exam_id: string;
  exam_title: string;
  exam_date: string;
  session: number | null;
  answer_key: string | null;
  student_no: string | null;
  name: string;
  birth: string | null;
  lc_correct: number;
  lc_score: number;
  rc_correct: number;
  rc_score: number;
  total: number;
  parts: { part: number; correct: number; total: number }[];
  wrong: { q: number; part: number; answer: string; chosen: string | null }[];
  comment: string | null;
  part_comments: { part: number; comment: string }[];
  blank_sheet: boolean;
  report_pdf_url: string | null;
  linked_no: string | null;
  match_status: MatchStatus;
  match_note: string | null;
  received_at?: string;
  updated_at?: string;
};

// 새 개인번호: 장부(student_numbers)에 먼저 넣어서 겹치지 않게 해요 (이미 있으면 다른 번호로 다시)
export async function reserveStudentNo(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const no = randomStudentNo();
    if (sb) {
      const { error } = await sb.from("student_numbers").insert({ no });
      if (!error) return no;
      if (error.code !== "23505") throw error; // 23505 = 이미 있는 번호 → 다시 뽑기
      continue;
    }
    const list = (mem.studentNumbers ??= []);
    if (!list.includes(no)) {
      list.push(no);
      return no;
    }
  }
  throw new Error("개인번호를 만들지 못했어요");
}

// 이 개인번호들을 가진 신청 (이름 확인·연결용, 환불·취소 포함)
export async function appsByStudentNos(nos: string[]): Promise<Pick<Application, "id" | "name" | "student_no" | "cohort" | "kind" | "course" | "track" | "slot" | "status" | "created_at">[]> {
  const ok = [...new Set(nos.filter((n) => /^[0-9]{6}$/.test(n)))];
  if (ok.length === 0) return [];
  if (sb) {
    const db = sb;
    return inChunks(ok, async (chunk) => {
      const { data, error } = await db.from("applications").select("id,name,student_no,cohort,kind,course,track,slot,status,created_at").in("student_no", chunk);
      if (error) throw error;
      return data as Application[];
    });
  }
  return mem.apps.filter((a) => a.student_no && ok.includes(a.student_no));
}

export async function getExamResults(ids: string[]): Promise<ExamResultRow[]> {
  const ok = [...new Set(ids.filter(isUuid))];
  if (ok.length === 0) return [];
  if (sb) {
    const db = sb;
    return inChunks(ok, async (chunk) => {
      const { data, error } = await db.from("firsttoeic_exam_results").select("*").in("result_id", chunk);
      if (error) throw error;
      return data as ExamResultRow[];
    });
  }
  return (mem.examResults ?? []).filter((r) => ok.includes(r.result_id));
}

// 학생 화면: 내 개인번호에 연결된 성적만 (최근 시험이 위)
export async function examResultsByNos(nos: string[]): Promise<ExamResultRow[]> {
  const ok = [...new Set(nos.filter((n) => /^[0-9]{6}$/.test(n)))];
  if (ok.length === 0) return [];
  if (sb) {
    const { data, error } = await sb.from("firsttoeic_exam_results").select("*").in("linked_no", ok).order("exam_date", { ascending: false }).order("session", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data as ExamResultRow[];
  }
  return (mem.examResults ?? []).filter((r) => r.linked_no && ok.includes(r.linked_no)).sort((a, b) => b.exam_date.localeCompare(a.exam_date) || (b.session ?? -1) - (a.session ?? -1));
}

// 관리 화면: 받은 성적 전부 (최근 시험이 위, 1,000줄씩 끝까지)
export async function listExamResults(): Promise<ExamResultRow[]> {
  if (sb) {
    const db = sb;
    return allRows<ExamResultRow>((from, to) => db.from("firsttoeic_exam_results").select("*").order("exam_date", { ascending: false }).order("session", { ascending: false, nullsFirst: false }).order("name").order("result_id").range(from, to));
  }
  return [...(mem.examResults ?? [])].sort((a, b) => b.exam_date.localeCompare(a.exam_date) || a.name.localeCompare(b.name));
}

// 받기: result_id가 같으면 덮어쓰기 (받은 시각은 처음 그대로)
export async function upsertExamResults(rows: ExamResultRow[]) {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const withTime = rows.map(({ received_at: _r, ...r }) => ({ ...r, updated_at: now }));
  if (sb) {
    const { error } = await sb.from("firsttoeic_exam_results").upsert(withTime, { onConflict: "result_id" });
    if (error) throw error;
    return;
  }
  const list = (mem.examResults ??= []);
  for (const r of withTime) {
    const old = list.find((x) => x.result_id === r.result_id);
    if (old) Object.assign(old, r);
    else list.push({ ...r, received_at: now });
  }
}

// 관리자 연결·연결 풀기·삭제
export async function updateExamResult(resultId: string, patch: Pick<ExamResultRow, "linked_no" | "match_status" | "match_note">) {
  if (!isUuid(resultId)) return;
  const row = { ...patch, updated_at: new Date().toISOString() };
  if (sb) {
    const { error } = await sb.from("firsttoeic_exam_results").update(row).eq("result_id", resultId);
    if (error) throw error;
    return;
  }
  const r = (mem.examResults ?? []).find((x) => x.result_id === resultId);
  if (r) Object.assign(r, row);
}
export async function deleteExamResults(ids: string[]) {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  if (sb) {
    const { error } = await sb.from("firsttoeic_exam_results").delete().in("result_id", ok);
    if (error) throw error;
    return;
  }
  mem.examResults = (mem.examResults ?? []).filter((r) => !ok.includes(r.result_id));
}

// 학생 연결 확인이 필요한 성적 수 (관리 [모의고사] 탭 빨간 숫자)
export async function countExamReview(): Promise<number> {
  if (sb) {
    const { count, error } = await sb.from("firsttoeic_exam_results").select("result_id", { count: "exact", head: true }).eq("match_status", "review");
    if (error) throw error;
    return count ?? 0;
  }
  return (mem.examResults ?? []).filter((r) => r.match_status === "review").length;
}

// ── 학생 '내 정보' (SQL 44, 규칙 lib/profile.ts) ──
export type StudentProfile = { student_no: string; phone: string | null; target_score: number | null; reasons: string[]; reason_note: string | null; updated_at?: string };

export async function getStudentProfiles(nos: string[]): Promise<StudentProfile[]> {
  const ok = [...new Set(nos.filter((n) => /^[1-9][0-9]{5}$/.test(n)))];
  if (ok.length === 0) return [];
  if (sb) {
    const db = sb;
    return inChunks(ok, async (chunk) => {
      const { data, error } = await db.from("student_profiles").select("student_no,phone,target_score,reasons,reason_note,updated_at").in("student_no", chunk);
      if (error) throw error;
      return data as StudentProfile[];
    });
  }
  return (mem.profiles ?? []).filter((p) => ok.includes(p.student_no));
}

// 칸 하나씩 저장 (한 장에 한 질문): 없으면 만들고, 있으면 그 칸만 바꿔요
export async function saveStudentProfile(no: string, patch: Partial<Omit<StudentProfile, "student_no" | "updated_at">>) {
  if (!/^[1-9][0-9]{5}$/.test(no)) return;
  const row = { student_no: no, ...patch, updated_at: new Date().toISOString() };
  if (sb) {
    const { error } = await sb.from("student_profiles").upsert(row, { onConflict: "student_no" });
    if (error) throw error;
    return;
  }
  const list = (mem.profiles ??= []);
  const old = list.find((p) => p.student_no === no);
  if (old) Object.assign(old, row);
  else list.push({ phone: null, target_score: null, reasons: [], reason_note: null, ...row });
}

// 1.1: 이 회차에 지금 저장된 결과 (지울 것·이어받을 연결 찾기용, 이름·연결만)
export async function examRowsOf(examId: string): Promise<Pick<ExamResultRow, "result_id" | "name" | "match_status" | "linked_no">[]> {
  if (!isUuid(examId)) return [];
  if (sb) {
    const { data, error } = await sb.from("firsttoeic_exam_results").select("result_id,name,match_status,linked_no").eq("exam_id", examId);
    if (error) throw error;
    return data as Pick<ExamResultRow, "result_id" | "name" | "match_status" | "linked_no">[];
  }
  return (mem.examResults ?? []).filter((r) => r.exam_id === examId);
}
