import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { thisMonthKST, roundOf, type BookId, type CourseId, type Kind, type Part, type Pickup, type Status, type Track } from "./config";

export type Application = {
  id: string;
  cohort: string;
  kind: Kind;
  course: CourseId;
  track: Track;
  continuing: boolean; // 격일반을 지난달에 이어 듣는 수강생 (LC만 새로 받음)
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

export type SpecialLecture = {
  id: string;
  cohort: string;
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
  application_id: string;
  mode: "onsite" | "online";
  deposit_paid: boolean;
  approved: boolean;
  attended: boolean;
  refunded: boolean;
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
export type Attendance = Stamp & { late: boolean };
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
};
const g = globalThis as unknown as { __vellaMem?: Mem };
const mem: Mem = (g.__vellaMem ??= { apps: [], lectures: [], settings: {}, attendance: [], homework: [], photos: {}, specialLectures: [], specialRegistrations: [], specialMaterials: [] });
mem.specialLectures ??= [];
mem.specialRegistrations ??= [];
mem.specialMaterials ??= [];
mem.lectures ??= [];
mem.attendance ??= [];
mem.homework ??= [];
mem.photos ??= {};

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

type ApplicationPatch = Partial<Pick<Application, "status" | "pin_hash" | "course" | "track" | "continuing" | "books" | "amount">>;

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

export async function deleteLecture(id: string) {
  if (sb) {
    const { error } = await sb.from("lectures").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  mem.lectures = mem.lectures.filter((l) => l.id !== id);
}

// ── 특강 ────────────────────────────────────────
export async function listSpecialLectures(): Promise<SpecialLecture[]> {
  if (sb) {
    const { data, error } = await sb.from("special_lectures").select("*").order("event_date", { ascending: true });
    if (error) throw error;
    return data as SpecialLecture[];
  }
  return mem.specialLectures.sort((a, b) => a.event_date.localeCompare(b.event_date));
}

export async function getSpecialLecture(id: string): Promise<SpecialLecture | null> {
  if (sb) {
    const { data, error } = await sb.from("special_lectures").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as SpecialLecture) ?? null;
  }
  return mem.specialLectures.find((event) => event.id === id) ?? null;
}

export async function updateSpecialLecture(id: string, patch: Pick<SpecialLecture, "title" | "starts_at" | "ends_at" | "youtube_id">) {
  if (sb) {
    const { error } = await sb.from("special_lectures").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const event = mem.specialLectures.find((item) => item.id === id);
  if (event) Object.assign(event, patch);
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

export async function getSpecialRegistration(special_lecture_id: string, application_id: string): Promise<SpecialRegistration | null> {
  if (sb) {
    const { data, error } = await sb.from("special_lecture_registrations").select("*").eq("special_lecture_id", special_lecture_id).eq("application_id", application_id).maybeSingle();
    if (error) throw error;
    return (data as SpecialRegistration) ?? null;
  }
  return mem.specialRegistrations.find((registration) => registration.special_lecture_id === special_lecture_id && registration.application_id === application_id) ?? null;
}

export async function getSpecialRegistrationById(id: string): Promise<SpecialRegistration | null> {
  if (sb) {
    const { data, error } = await sb.from("special_lecture_registrations").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as SpecialRegistration) ?? null;
  }
  return mem.specialRegistrations.find((registration) => registration.id === id) ?? null;
}

export async function createSpecialRegistration(registration: Pick<SpecialRegistration, "special_lecture_id" | "application_id" | "mode">) {
  if (sb) {
    const { error } = await sb.from("special_lecture_registrations").insert(registration);
    if (error) throw error;
    return;
  }
  if (await getSpecialRegistration(registration.special_lecture_id, registration.application_id)) return;
  mem.specialRegistrations.push({ ...registration, id: crypto.randomUUID(), deposit_paid: false, approved: false, attended: false, refunded: false, created_at: new Date().toISOString() });
}

type SpecialRegistrationPatch = Partial<Pick<SpecialRegistration, "deposit_paid" | "approved" | "attended" | "refunded">>;

export async function updateSpecialRegistration(id: string, patch: SpecialRegistrationPatch) {
  if (sb) {
    const { error } = await sb.from("special_lecture_registrations").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const registration = mem.specialRegistrations.find((item) => item.id === id);
  if (registration) Object.assign(registration, patch);
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
  if (sb) {
    const { data, error } = await sb.from("special_lecture_materials").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as SpecialMaterial) ?? null;
  }
  return mem.specialMaterials.find((material) => material.id === id) ?? null;
}

export async function uploadSpecialMaterial(special_lecture_id: string, fileName: string, file: Buffer, contentType: string) {
  const safeName = fileName.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(-120) || "material";
  const storagePath = `${special_lecture_id}/${crypto.randomUUID()}-${safeName}`;
  if (sb) {
    const upload = await sb.storage.from("special-lecture-materials").upload(storagePath, file, { contentType, upsert: false });
    if (upload.error) throw upload.error;
    const { error } = await sb.from("special_lecture_materials").insert({ special_lecture_id, file_name: fileName.slice(0, 200), storage_path: storagePath });
    if (error) {
      await sb.storage.from("special-lecture-materials").remove([storagePath]);
      throw error;
    }
    return;
  }
  mem.photos[storagePath] = `data:${contentType};base64,${file.toString("base64")}`;
  mem.specialMaterials.push({ id: crypto.randomUUID(), special_lecture_id, file_name: fileName.slice(0, 200), storage_path: storagePath, created_at: new Date().toISOString() });
}

export async function specialMaterialUrl(path: string): Promise<string | null> {
  if (sb) {
    const { data, error } = await sb.storage.from("special-lecture-materials").createSignedUrl(path, 60 * 10);
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
export async function addAttendance(app_id: string, day: string, late = false) {
  if (sb) {
    const { error } = await sb.from("attendance").upsert({ app_id, day, late }, { onConflict: "app_id,day", ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  if (!mem.attendance.some((x) => x.app_id === app_id && x.day === day)) mem.attendance.push({ app_id, day, late });
}

export async function addHomeworkSticker(app_id: string, day: string) {
  if (sb) {
    const { error } = await sb.from("homework").upsert({ app_id, day, photo_path: null }, { onConflict: "app_id,day", ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  if (!mem.homework.some((x) => x.app_id === app_id && x.day === day)) mem.homework.push({ app_id, day, photo_path: null, created_at: new Date().toISOString() });
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
      sb.from("attendance").select("app_id, day, late").in("app_id", ok),
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
