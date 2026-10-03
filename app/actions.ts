"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  COURSES, TRACKS, PARTS, KLASSES, calcAmount, youtubeId, todayKST, type Klass,
  type BookId, type CourseId, type Kind, type Part, type Pickup, type Status, type Track,
} from "@/lib/config";
import {
  createApplication, deleteApplication, getApplication, getApplications, saveHomework, deletePhotosBefore, findApplicationsByName, updateApplication, setSetting, addLecture, deleteLecture, currentCohort,
} from "@/lib/db";
import { currentCode } from "@/lib/qr";
import { canWatch } from "@/lib/access";
import {
  hashPin, checkPin, setStudent, clearStudent, getStudentIds, checkAdminPassword, setAdmin, isAdmin, clearAdmin,
} from "@/lib/auth";

export type FormState = { error?: string; ok?: string };

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 200);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 교재비 신청 ─────────────────────────────────
export async function submitApplication(_: FormState, fd: FormData): Promise<FormState> {
  const kind = clean(fd.get("kind")) as Kind;
  const course = clean(fd.get("course")) as CourseId;
  const pickup = (kind === "onsite" ? "classroom" : clean(fd.get("pickup"))) as Pickup;
  const track = clean(fd.get("track")) as Track;
  // 교재는 반 × 수강 과목별로 일괄 지급
  const books: BookId[] = Object.hasOwn(COURSES, course) && Object.hasOwn(TRACKS, track) ? COURSES[course].books[track] : [];
  const name = clean(fd.get("name"));
  const phone = clean(fd.get("phone")).replace(/[^0-9]/g, "");
  const depositor = clean(fd.get("depositor")) || name;
  const address = clean(fd.get("address"));
  const pin = clean(fd.get("pin"));

  if (!["onsite", "online"].includes(kind)) return { error: "수강 형태를 선택해 주세요." };
  if (!Object.hasOwn(COURSES, course)) return { error: "수강 신청한 반을 선택해 주세요." };
  if (!Object.hasOwn(TRACKS, track)) return { error: "수강 과목을 선택해 주세요." };
  if (!["classroom", "delivery"].includes(pickup)) return { error: "교재 수령 방법을 선택해 주세요." };
  if (!name) return { error: "이름을 입력해 주세요." };
  if (kind === "online" && !/^01[0-9]{8,9}$/.test(phone)) return { error: "연락처를 정확히 입력해 주세요. (예: 01012345678)" };
  if (pickup === "delivery" && address.length < 5) return { error: "택배 받을 주소를 입력해 주세요." };
  if (!/^\d{4}$/.test(pin)) return { error: "강의실 비밀번호를 숫자 4자리로 정해 주세요." };
  if (!fd.get("agree")) return { error: "필독 사항 확인에 체크해 주세요." };

  const id = await createApplication({
    cohort: await currentCohort(),
    kind,
    course,
    track,
    books,
    pickup,
    name,
    phone: kind === "online" ? phone : null,
    depositor,
    address: pickup === "delivery" ? address : null,
    amount: calcAmount(books, pickup),
    pin_hash: hashPin(pin),
  });
  await setStudent([id]); // 신청하면 바로 강의실 로그인 상태
  redirect(`/my/${id}`);
}

// ── 학생 강의실 로그인 ──────────────────────────
export async function studentLogin(_: FormState, fd: FormData): Promise<FormState> {
  const name = clean(fd.get("name"));
  const pin = clean(fd.get("pin"));
  if (!name || !/^\d{4}$/.test(pin)) return { error: "이름과 비밀번호 4자리를 입력해 주세요." };
  const mine = (await findApplicationsByName(name)).filter((a) => checkPin(pin, a.pin_hash));
  if (mine.length === 0) {
    await sleep(800);
    return { error: "이름 또는 비밀번호가 맞지 않아요. 잊어버렸다면 Vella에게 문의해 주세요." };
  }
  await setStudent(mine.map((a) => a.id));
  const next = clean(fd.get("next"));
  redirect(next.startsWith("/check?") || next === "/class" ? next : "/class");
}

export async function studentLogout() {
  await clearStudent();
  redirect("/class");
}

// ── 관리자 ─────────────────────────────────────
export async function login(_: FormState, fd: FormData): Promise<FormState> {
  if (!checkAdminPassword(clean(fd.get("password")))) {
    await sleep(800);
    return { error: "비밀번호가 맞지 않아요." };
  }
  await setAdmin();
  redirect("/admin");
}

export async function logout() {
  await clearAdmin();
  redirect("/admin");
}

export async function changeStatus(fd: FormData) {
  if (!(await isAdmin())) return;
  const status = clean(fd.get("status")) as Status;
  if (!["pending", "paid", "shipped"].includes(status)) return;
  await updateApplication(clean(fd.get("id")), { status });
  revalidatePath("/admin");
}

export async function resetPin(fd: FormData) {
  if (!(await isAdmin())) return;
  const pin = clean(fd.get("pin"));
  if (!/^\d{4}$/.test(pin)) return;
  await updateApplication(clean(fd.get("id")), { pin_hash: hashPin(pin) });
  revalidatePath("/admin");
}

export async function saveSettings(fd: FormData) {
  if (!(await isAdmin())) return;
  await setSetting("bank_account", clean(fd.get("bank_account")));
  const c = clean(fd.get("current_cohort"));
  if (/^\d{4}-\d{2}$/.test(c)) await setSetting("current_cohort", c);
  revalidatePath("/admin");
}

export async function uploadLecture(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await isAdmin())) return { error: "관리자 로그인이 필요해요." };
  const cohort = clean(fd.get("cohort"));
  const course = clean(fd.get("course")) as CourseId;
  const part = clean(fd.get("part")) as Part;
  const title = clean(fd.get("title"));
  const yt = youtubeId(clean(fd.get("url")));
  if (!/^\d{4}-\d{2}$/.test(cohort)) return { error: "기수를 선택해 주세요." };
  if (!Object.hasOwn(COURSES, course)) return { error: "반을 선택해 주세요." };
  if (!Object.hasOwn(PARTS, part)) return { error: "RC/LC를 선택해 주세요." };
  if (!title) return { error: "강의 제목을 입력해 주세요." };
  if (!yt) return { error: "유튜브 링크를 확인해 주세요." };
  await addLecture({ cohort, course, part, title, youtube_id: yt });
  revalidatePath("/admin/lectures");
  return { ok: `'${title}' 강의를 올렸어요.` };
}

export async function removeLecture(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteLecture(clean(fd.get("id")));
  revalidatePath("/admin/lectures");
}

// 학생이 반을 잘못 고른 경우 Vella가 바로잡기 (교재·금액 자동 재계산)
export async function changeClass(fd: FormData) {
  if (!(await isAdmin())) return;
  const id = clean(fd.get("id"));
  const [course, track] = clean(fd.get("class")).split(":") as [CourseId, Track];
  if (!Object.hasOwn(COURSES, course) || !Object.hasOwn(TRACKS, track)) return;
  const a = await getApplication(id);
  if (!a) return;
  const books = COURSES[course].books[track];
  await updateApplication(id, { course, track, books, amount: calcAmount(books, a.pickup) });
  revalidatePath("/admin");
}

// 테스트·중복 신청 삭제
export async function removeApplication(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteApplication(clean(fd.get("id")));
  revalidatePath("/admin");
}

// ── 출석 QR (관리자 화면이 30초마다 새 코드를 받아감) ──
export async function getQrCode(klass: Klass): Promise<string | null> {
  if (!(await isAdmin()) || !Object.hasOwn(KLASSES, klass)) return null;
  return currentCode(klass);
}

// ── 숙제 인증 ──────────────────────────────────
export async function uploadHomework(_: FormState, fd: FormData): Promise<FormState> {
  const id = clean(fd.get("app_id"));
  const file = fd.get("photo");
  const ids = await getStudentIds();
  if (!ids.includes(id)) return { error: "강의실에 다시 로그인해 주세요." };
  const [app] = await getApplications([id]);
  if (!app || !canWatch(app) || app.cohort !== (await currentCohort())) return { error: "이번 기수 수강생만 인증할 수 있어요." };
  if (!(file instanceof File) || file.size === 0) return { error: "숙제 사진을 골라 주세요." };
  if (file.size > 4 * 1024 * 1024) return { error: "사진이 너무 커요. 다시 시도해 주세요." };
  if (!file.type.startsWith("image/")) return { error: "사진 파일만 올릴 수 있어요." };
  await saveHomework(app, todayKST(), Buffer.from(await file.arrayBuffer()));
  revalidatePath("/class");
  return { ok: "숙제 인증 완료! ⭐ 스티커가 붙었어요." };
}

// 지난 기수 숙제 사진 정리
export async function cleanupPhotos(): Promise<void> {
  if (!(await isAdmin())) return;
  await deletePhotosBefore(await currentCohort());
  revalidatePath("/admin/stamps");
}
