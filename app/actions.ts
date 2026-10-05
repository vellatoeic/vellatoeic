"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  COURSES, PARTS, LECTURE_COURSES, booksFor, isAlt, calcAmount, youtubeId, todayKST,
  type CourseId, type Kind, type Part, type Pickup, type Status, type Track,
} from "@/lib/config";
import {
  createApplication, deleteApplication, deleteApplications, getApplication, getApplications, addHomeworkSticker, deleteHomeworkSticker, deletePhotosBefore, findApplicationsByName, updateApplication, updateApplications, setSetting, addLecture, deleteLecture, currentCohort, roundFor, addAttendance, getSetting,
} from "@/lib/db";
import { canWatch } from "@/lib/access";
import { SCHEDULE_CLASSES, defaultSchoolDays, holidayKey, parseHolidays, parseSchoolDays, previousMonth, scheduleKey, scheduleClassFor, shiftSchoolDays, type ScheduleClass } from "@/lib/schedule";
import {
  hashPin, checkPin, setStudent, clearStudent, getStudentIds, checkAdminPassword, setAdmin, isAdmin, clearAdmin,
} from "@/lib/auth";

export type FormState = { error?: string; ok?: string };

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 200);
const largeField = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim().slice(0, 6000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function validCohort(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function validScheduleClass(value: string): value is ScheduleClass {
  return Object.hasOwn(SCHEDULE_CLASSES, value);
}

// ── 교재비 신청 ─────────────────────────────────
export async function submitApplication(_: FormState, fd: FormData): Promise<FormState> {
  const kind = clean(fd.get("kind")) as Kind;
  const course = clean(fd.get("course")) as CourseId;
  const pickup = (kind === "onsite" ? "classroom" : clean(fd.get("pickup"))) as Pickup;
  const track = clean(fd.get("track")) as Track;
  // 이어듣기 교재 할인은 시작반 격일반에만 적용해요
  const continuing = course === "start" && isAlt(track) && !!fd.get("continuing");
  const cohort = await currentCohort();
  // 교재는 반·과정·회차로 자동 결정 (학생이 고르지 않아요)
  const books = Object.hasOwn(COURSES, course) && COURSES[course].tracks.includes(track)
    ? booksFor(course, track, await roundFor(cohort), continuing)
    : [];
  const name = clean(fd.get("name"));
  const phone = clean(fd.get("phone")).replace(/[^0-9]/g, "");
  const depositor = clean(fd.get("depositor")) || name;
  const address = clean(fd.get("address"));
  const pin = clean(fd.get("pin"));

  if (!["onsite", "online"].includes(kind)) return { error: "수강 형태를 선택해 주세요." };
  if (!Object.hasOwn(COURSES, course)) return { error: "수강 신청한 반을 선택해 주세요." };
  if (!COURSES[course].tracks.includes(track)) return { error: "수강 과정을 선택해 주세요." };
  if (!["classroom", "delivery"].includes(pickup)) return { error: "교재 수령 방법을 선택해 주세요." };
  if (!name) return { error: "이름을 입력해 주세요." };
  if (kind === "online" && !/^01[0-9]{8,9}$/.test(phone)) return { error: "연락처를 정확히 입력해 주세요. (예: 01012345678)" };
  if (pickup === "delivery" && address.length < 5) return { error: "택배 받을 주소를 입력해 주세요." };
  if (!/^\d{4}$/.test(pin)) return { error: "강의실 비밀번호를 숫자 4자리로 정해 주세요." };
  if (!fd.get("agree")) return { error: "필독 사항 확인에 체크해 주세요." };

  const id = await createApplication({
    cohort,
    kind,
    course,
    track,
    continuing,
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
  // 교재 회차는 자동으로 번갈아 정해지고, 필요할 때만 여기서 바꿔요
  const round = clean(fd.get("round"));
  if (/^\d{4}-\d{2}$/.test(c) && (round === "1" || round === "2")) await setSetting(`round_${c}`, round);
  for (const key of ["live_start_am", "live_start_pm", "live_solve_am", "live_solve_pm"]) {
    const value = clean(fd.get(key));
    const id = value ? youtubeId(value) : null;
    if (!value || id) await setSetting(key, id ?? "");
  }
  const cafeLink = clean(fd.get("cafe_homework_url"));
  if (!cafeLink) await setSetting("cafe_homework_url", "");
  else {
    try {
      const url = new URL(cafeLink);
      if (url.protocol === "https:" && ["cafe.naver.com", "m.cafe.naver.com", "naver.me"].includes(url.hostname)) {
        await setSetting("cafe_homework_url", url.toString());
      }
    } catch {
      // 잘못된 주소는 기존 주소를 유지해요.
    }
  }
  revalidatePath("/admin");
}

export async function saveSchoolSchedule(fd: FormData) {
  if (!(await isAdmin())) return;
  const cohort = clean(fd.get("cohort"));
  const klass = clean(fd.get("klass"));
  if (!validCohort(cohort) || !validScheduleClass(klass)) return;
  const holidays = parseHolidays(largeField(fd, "holidays"), cohort);
  const days = parseSchoolDays(largeField(fd, "days"), cohort).filter((day) => !holidays[day]);
  await Promise.all([
    setSetting(scheduleKey(cohort, klass), JSON.stringify(days)),
    setSetting(holidayKey(cohort), JSON.stringify(holidays)),
  ]);
  revalidatePath("/admin/schedule");
  revalidatePath("/class");
}

export async function copyPreviousSchedule(fd: FormData) {
  if (!(await isAdmin())) return;
  const cohort = clean(fd.get("cohort"));
  const klass = clean(fd.get("klass"));
  if (!validCohort(cohort) || !validScheduleClass(klass)) return;
  const previous = previousMonth(cohort);
  const rawPreviousDays = await getSetting(scheduleKey(previous, klass));
  const previousDays = rawPreviousDays ? parseSchoolDays(rawPreviousDays, previous) : defaultSchoolDays(previous, klass);
  const days = shiftSchoolDays(previousDays, previous, cohort);
  await setSetting(scheduleKey(cohort, klass), JSON.stringify(days));
  revalidatePath("/admin/schedule");
  revalidatePath("/class");
  redirect(`/admin/schedule?cohort=${cohort}&klass=${klass}`);
}

export async function uploadLecture(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await isAdmin())) return { error: "관리자 로그인이 필요해요." };
  const cohort = clean(fd.get("cohort"));
  const course = clean(fd.get("course")) as CourseId;
  const part = clean(fd.get("part")) as Part;
  const title = clean(fd.get("title"));
  const yt = youtubeId(clean(fd.get("url")));
  if (!/^\d{4}-\d{2}$/.test(cohort)) return { error: "기수를 선택해 주세요." };
  if (!LECTURE_COURSES.includes(course)) return { error: "반을 선택해 주세요." };
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
  if (!Object.hasOwn(COURSES, course) || !COURSES[course].tracks.includes(track)) return;
  const a = await getApplication(id);
  if (!a) return;
  const continuing = course === "start" && isAlt(track) && a.continuing;
  const books = booksFor(course, track, await roundFor(a.cohort), continuing);
  await updateApplication(id, { course, track, continuing, books, amount: calcAmount(books, a.pickup) });
  revalidatePath("/admin");
}

// 테스트·중복 신청 삭제
export async function removeApplication(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteApplication(clean(fd.get("id")));
  revalidatePath("/admin");
}

// ── 숙제 스티커 ────────────────────────────────
export async function markHomeworkDone(fd: FormData) {
  const id = clean(fd.get("app_id"));
  const day = clean(fd.get("day"));
  const ids = await getStudentIds();
  if (!ids.includes(id) || day !== todayKST()) return;
  const [app] = await getApplications([id]);
  if (!app || !canWatch(app) || app.cohort !== (await currentCohort())) return;
  const klass = scheduleClassFor(app.course, app.track);
  const rawDays = await getSetting(scheduleKey(app.cohort, klass));
  const savedDays = rawDays ? parseSchoolDays(rawDays, app.cohort) : defaultSchoolDays(app.cohort, klass);
  if (!savedDays.includes(day)) return;
  await addHomeworkSticker(app.id, day);
  revalidatePath("/class");
}

export async function cancelHomeworkSticker(fd: FormData) {
  if (!(await isAdmin())) return;
  const id = clean(fd.get("id"));
  const day = clean(fd.get("day"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  await deleteHomeworkSticker(id, day);
  revalidatePath("/admin/stamps");
  revalidatePath("/class");
}

// 예전에 저장한 숙제 사진을 지난 기수 기준으로 정리해요.
export async function cleanupPhotos(): Promise<void> {
  if (!(await isAdmin())) return;
  await deletePhotosBefore(await currentCohort());
  revalidatePath("/admin/stamps");
}

// 관리자가 현황표에서 출석을 직접 보정해요.
export async function markAttendanceManual(fd: FormData) {
  if (!(await isAdmin())) return;
  const id = clean(fd.get("id"));
  const day = clean(fd.get("day"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const app = await getApplication(id);
  if (!app || !canWatch(app) || app.cohort !== (await currentCohort())) return;
  await addAttendance(app.id, day);
  revalidatePath("/admin/stamps");
}

// ── 명단에서 체크한 여러 건 한 번에 ───────────────
const checkedIds = (fd: FormData) => fd.getAll("ids").map(clean).filter(Boolean);

export async function bulkRemove(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteApplications(checkedIds(fd));
  revalidatePath("/admin");
}

export async function bulkChangeClass(fd: FormData) {
  if (!(await isAdmin())) return;
  const ids = checkedIds(fd);
  const [course, track] = clean(fd.get("class")).split(":") as [CourseId, Track];
  if (ids.length === 0 || !Object.hasOwn(COURSES, course) || !COURSES[course].tracks.includes(track)) return;
  // 교재는 기수 회차와 이어듣기 여부에 따라 달라서 신청별로 다시 계산해요.
  const apps = await getApplications(ids);
  for (const a of apps) {
    const continuing = course === "start" && isAlt(track) && a.continuing;
    const books = booksFor(course, track, await roundFor(a.cohort), continuing);
    await updateApplication(a.id, { course, track, continuing, books, amount: calcAmount(books, a.pickup) });
  }
  revalidatePath("/admin");
}
