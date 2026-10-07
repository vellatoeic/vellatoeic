import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { TestKind, TestOverride } from "./tests";
import { thisMonthKST, roundOf, type BookId, type CourseId, type Kind, type Part, type Pickup, type Status, type TimeSlot, type Track, type DepositStatus } from "./config";

export type Application = {
  id: string;
  cohort: string;
  kind: Kind;
  course: CourseId;
  track: Track;
  continuing: boolean; // 격일반을 지난달에 이어 듣는 수강생 (LC만 새로 받음)
  slot: TimeSlot | null; // 수강 시간 (오전반/저녁반). 시간 추가 전 신청은 비어 있어요.
  pickup_date: string | null; // 불라방 1층 데스크 수령 희망 날짜
  pickup_time: string | null; // 불라방 1층 데스크 수령 희망 시간 (예: 14:00)
  books: BookId[];
  pickup: Pickup;
  name: string;
  phone: string | null;
  depositor: string;
  address: string | null;
  amount: number;
  status: Status;
  pin_hash: string | null;
  created_at: string;
};

export type NewApplication = Omit<Application, "id" | "status" | "created_at">;

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
  storage_path: string;
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
  created_at: string;
};

export type SpecialMaterial = {
  id: string;
  special_lecture_id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
};

// Supabase 연결 정보가 없으면(미리보기) 메모리에 임시 저장해요.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export const isPreview = !sb;

export type Stamp = { app_id: string; day: string };
export type Attendance = Stamp;
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
};
const g = globalThis as unknown as { __vellaMem?: Mem };
const mem: Mem = (g.__vellaMem ??= { apps: [], lectures: [], settings: {}, attendance: [], homework: [], photos: {}, specialLectures: [], specialRegistrations: [], specialMaterials: [], missions: [], audios: [], faq: [], questions: [], depositEvents: [], testResults: [], testOverrides: [] });
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

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// ── 신청 ───────────────────────────────────────
export async function createApplication(a: NewApplication): Promise<string> {
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
    const { data } = await sb.from("applications").select("*").eq("id", id).maybeSingle();
    return (data as Application) ?? null;
  }
  return mem.apps.find((x) => x.id === id) ?? null;
}

export async function getApplications(ids: string[]): Promise<Application[]> {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return [];
  if (sb) {
    const { data, error } = await sb.from("applications").select("*").in("id", ok);
    if (error) throw error;
    return data as Application[];
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

export async function listApplications(): Promise<Application[]> {
  if (sb) {
    const { data, error } = await sb
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Application[];
  }
  return mem.apps;
}

type ApplicationPatch = Partial<Pick<Application, "status" | "pin_hash" | "course" | "track" | "continuing" | "slot" | "books" | "amount">>;

export async function updateApplication(id: string, patch: ApplicationPatch) {
  if (sb) {
    const { error } = await sb.from("applications").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const a = mem.apps.find((x) => x.id === id);
  if (a) Object.assign(a, patch);
}

export async function deleteApplication(id: string) {
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
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  if (sb) {
    const { error } = await sb.from("applications").update(patch).in("id", ok);
    if (error) throw error;
    return;
  }
  for (const a of mem.apps) if (ok.includes(a.id)) Object.assign(a, patch);
}

export async function deleteApplications(ids: string[]) {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  if (sb) {
    const { error } = await sb.from("applications").delete().in("id", ok);
    if (error) throw error;
    return;
  }
  mem.apps = mem.apps.filter((x) => !ok.includes(x.id));
}

// ── 강의 ───────────────────────────────────────
export async function listLectures(cohort?: string): Promise<Lecture[]> {
  if (sb) {
    let q = sb.from("lectures").select("*").order("created_at", { ascending: true });
    if (cohort) q = q.eq("cohort", cohort);
    const { data, error } = await q;
    if (error) throw error;
    return data as Lecture[];
  }
  return mem.lectures.filter((l) => !cohort || l.cohort === cohort);
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
  if (sb) {
    const { error } = await sb.from("lectures").insert(l);
    if (error) throw error;
    return;
  }
  mem.lectures.push({ ...l, id: crypto.randomUUID(), created_at: new Date().toISOString() });
}

export async function updateLecture(id: string, patch: Omit<Lecture, "id" | "created_at">) {
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
  if (sb) {
    const { error } = await sb.from("lectures").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  mem.lectures = mem.lectures.filter((l) => l.id !== id);
}

// ── 문풀반 데일리 테스트 ───────────────────────
export async function listTestOverrides(cohort: string): Promise<TestOverride[]> {
  const from = `${cohort}-01`, to = `${cohort}-31`;
  if (sb) {
    const { data, error } = await sb.from("test_overrides").select("*").gte("day", from).lte("day", to);
    if (error) throw error;
    return data as TestOverride[];
  }
  return mem.testOverrides.filter((o) => o.day.startsWith(cohort));
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
    let q = sb.from("test_results").select("*").order("day").order("kind");
    if (filter.cohort) q = q.eq("cohort", filter.cohort);
    if (filter.day) q = q.eq("day", filter.day);
    if (ids) q = q.in("app_id", ids);
    const { data, error } = await q;
    if (error) throw error;
    return data as TestResult[];
  }
  return mem.testResults.filter((r) => (!filter.cohort || r.cohort === filter.cohort) && (!filter.day || r.day === filter.day) && (!ids || ids.includes(r.app_id)));
}

export async function saveTestResult(r: Omit<TestResult, "id" | "submitted_at">) {
  const row = { ...r, submitted_at: new Date().toISOString() };
  if (sb) {
    const { error } = await sb.from("test_results").upsert(row, { onConflict: "app_id,day,kind" });
    if (error) throw error;
    return;
  }
  const old = mem.testResults.find((x) => x.app_id === r.app_id && x.day === r.day && x.kind === r.kind);
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

export async function createAudio(audio: Pick<LcAudio, "cohort" | "book" | "title" | "storage_path" | "size_bytes" | "sort_order">) {
  if (sb) {
    const { error } = await sb.from("lc_audios").insert(audio);
    if (error) throw error;
    return;
  }
  mem.audios.push({ ...audio, id: crypto.randomUUID(), created_at: new Date().toISOString() });
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

// 음원 기록과 보관함 파일을 함께 지워요.
export async function deleteAudios(list: LcAudio[]) {
  if (list.length === 0) return;
  const ids = list.map((a) => a.id);
  if (sb) {
    const { error: removeError } = await sb.storage.from(AUDIO_BUCKET).remove(list.map((a) => a.storage_path));
    if (removeError) throw removeError;
    const { error } = await sb.from("lc_audios").delete().in("id", ids);
    if (error) throw error;
    return;
  }
  mem.audios = mem.audios.filter((a) => !ids.includes(a.id));
}

// 브라우저가 바로 올릴 수 있는 서명된 업로드 주소 (2시간 유효). 미리보기에서는 없어요.
export async function audioUploadUrl(path: string): Promise<string | null> {
  if (!sb) return null;
  const { data, error } = await sb.storage.from(AUDIO_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return data.signedUrl;
}

// 업로드가 실제로 끝났는지 보관함에서 확인하고 파일 크기를 돌려줘요.
export async function uploadedAudioSize(path: string): Promise<number | null> {
  if (!sb) return 0;
  const slash = path.lastIndexOf("/");
  const { data, error } = await sb.storage.from(AUDIO_BUCKET).list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  if (error) throw error;
  const file = data?.find((f) => f.name === path.slice(slash + 1));
  return file ? Number((file.metadata as { size?: number } | null)?.size ?? 0) : null;
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
    const { data, error } = await sb.from("student_missions").select("*").in("app_id", ok);
    if (error) throw error;
    return data as Mission[];
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
type SpecialLectureFields = Pick<SpecialLecture, "event_date" | "title" | "starts_at" | "ends_at">;

export async function listSpecialLectures(): Promise<SpecialLecture[]> {
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
  if (sb) {
    const { error } = await sb.from("special_lectures").insert(fields);
    if (error) throw error;
    return;
  }
  mem.specialLectures.push({ ...fields, id: crypto.randomUUID(), youtube_id: null, created_at: new Date().toISOString() });
}

export async function updateSpecialLecture(id: string, patch: Partial<SpecialLectureFields & Pick<SpecialLecture, "youtube_id">>) {
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
  if (!isUuid(id)) return;
  const paths = (await listSpecialMaterials(id)).map((material) => material.storage_path);
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
    let query = sb.from("special_lecture_registrations").select("*").order("created_at", { ascending: true });
    if (special_lecture_id) query = query.eq("special_lecture_id", special_lecture_id);
    const { data, error } = await query;
    if (error) throw error;
    return data as SpecialRegistration[];
  }
  return mem.specialRegistrations.filter((registration) => !special_lecture_id || registration.special_lecture_id === special_lecture_id);
}

// 강의실 로그인한 학생(수강 신청 id 목록)의 특강 신청
export async function getSpecialRegistrationsFor(application_ids: string[]): Promise<SpecialRegistration[]> {
  const ok = application_ids.filter(isUuid);
  if (ok.length === 0) return [];
  if (sb) {
    const { data, error } = await sb.from("special_lecture_registrations").select("*").in("application_id", ok);
    if (error) throw error;
    return data as SpecialRegistration[];
  }
  return mem.specialRegistrations.filter((registration) => registration.application_id && ok.includes(registration.application_id));
}

type SpecialRegistrationPatch = Partial<Pick<SpecialRegistration, "deposit" | "deposit_paid_at">>;

// 현장 신청 여러 건의 보증금·참석·환급 상태를 한 번에 바꿔요.
export async function updateOnsiteRegistrations(ids: string[], patch: SpecialRegistrationPatch) {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return;
  if (sb) {
    const { error } = await sb.from("special_lecture_registrations").update(patch).in("id", ok).eq("mode", "onsite");
    if (error) throw error;
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
  result: "matched" | "review" | "unmatched" | "resolved" | "dismissed";
  registration_id: string | null; // 특강 보증금이면 특강 신청
  application_id: string | null; // 교재비면 수강 신청
};

export async function createDepositEvent(e: Pick<DepositEvent, "target" | "name" | "amount" | "result" | "registration_id" | "application_id">) {
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

export async function updateDepositEvent(id: string, patch: Partial<Pick<DepositEvent, "result" | "registration_id" | "application_id">>) {
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

export async function uploadSpecialMaterial(special_lecture_id: string, fileName: string, file: Buffer, contentType: string) {
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "material";
  const storagePath = `${special_lecture_id}/${crypto.randomUUID()}-${safeName}`;
  if (sb) {
    const upload = await sb.storage.from(SPECIAL_BUCKET).upload(storagePath, file, { contentType, upsert: false });
    if (upload.error) throw upload.error;
    const { error } = await sb.from("special_lecture_materials").insert({ special_lecture_id, file_name: fileName.slice(0, 200), storage_path: storagePath });
    if (error) {
      await sb.storage.from(SPECIAL_BUCKET).remove([storagePath]);
      throw error;
    }
    return;
  }
  mem.photos[storagePath] = `data:${contentType};base64,${file.toString("base64")}`;
  mem.specialMaterials.push({ id: crypto.randomUUID(), special_lecture_id, file_name: fileName.slice(0, 200), storage_path: storagePath, created_at: new Date().toISOString() });
}

export async function deleteSpecialMaterial(id: string) {
  const material = await getSpecialMaterial(id);
  if (!material) return;
  if (sb) {
    await sb.storage.from(SPECIAL_BUCKET).remove([material.storage_path]);
    const { error } = await sb.from("special_lecture_materials").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  delete mem.photos[material.storage_path];
  mem.specialMaterials = mem.specialMaterials.filter((item) => item.id !== id);
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
export async function getSetting(k: string): Promise<string> {
  if (sb) {
    const { data } = await sb.from("settings").select("value").eq("key", k).maybeSingle();
    return (data?.value as string) ?? "";
  }
  return mem.settings[k] ?? "";
}

export async function setSetting(k: string, v: string) {
  if (sb) {
    const { error } = await sb.from("settings").upsert({ key: k, value: v });
    if (error) throw error;
    return;
  }
  mem.settings[k] = v;
}

// 현재 모집 기수 (관리 페이지에서 설정, 없으면 이번 달)
export async function currentCohort() {
  return (await getSetting("current_cohort")) || thisMonthKST();
}

// 그 기수의 교재 회차. 관리 페이지에서 바꿨으면 그 값, 없으면 달마다 번갈아 자동 계산.
export async function roundFor(cohort: string): Promise<1 | 2> {
  const v = await getSetting(`round_${cohort}`);
  return v === "1" ? 1 : v === "2" ? 2 : roundOf(cohort);
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
    const [a, h] = await Promise.all([
      sb.from("attendance").select("app_id, day").in("app_id", ok),
      sb.from("homework").select("app_id, day, photo_path, created_at").in("app_id", ok),
    ]);
    if (a.error) throw a.error;
    if (h.error) throw h.error;
    return { attendance: a.data as Attendance[], homework: h.data as Homework[] };
  }
  return {
    attendance: mem.attendance.filter((x) => ok.includes(x.app_id)),
    homework: mem.homework.filter((x) => ok.includes(x.app_id)),
  };
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
