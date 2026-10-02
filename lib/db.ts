import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { thisMonthKST, type BookId, type CourseId, type Kind, type Part, type Pickup, type Status, type Track } from "./config";

export type Application = {
  id: string;
  cohort: string;
  kind: Kind;
  course: CourseId;
  track: Track;
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
  title: string;
  youtube_id: string;
  created_at: string;
};

// Supabase 연결 정보가 없으면(미리보기) 메모리에 임시 저장해요.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export const isPreview = !sb;

type Mem = { apps: Application[]; lectures: Lecture[]; settings: Record<string, string> };
const g = globalThis as unknown as { __vellaMem?: Mem };
const mem: Mem = (g.__vellaMem ??= { apps: [], lectures: [], settings: {} });
mem.lectures ??= [];

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

export async function updateApplication(id: string, patch: Partial<Pick<Application, "status" | "pin_hash" | "course" | "track" | "books" | "amount">>) {
  if (sb) {
    const { error } = await sb.from("applications").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const a = mem.apps.find((x) => x.id === id);
  if (a) Object.assign(a, patch);
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

export async function deleteLecture(id: string) {
  if (sb) {
    const { error } = await sb.from("lectures").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  mem.lectures = mem.lectures.filter((l) => l.id !== id);
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
