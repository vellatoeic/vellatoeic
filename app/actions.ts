"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  COURSES, PARTS, LECTURE_COURSES, booksFor, isAlt, isTimeSlot, calcAmount, youtubeId, todayKST,
  type CourseId, type Kind, type Part, type Pickup, type Status, type Track,
} from "@/lib/config";
import {
  createApplication, deleteApplication, deleteApplications, getApplication, getApplications, addHomeworkSticker, deleteHomeworkSticker, deletePhotosBefore, findApplicationsByName, updateApplication, updateApplications, setSetting, addLecture, deleteLecture, currentCohort, roundFor, addAttendance, getSetting,
  createSpecialLecture, createSpecialRegistration, getSpecialRegistrationsFor, deleteSpecialLecture, deleteSpecialMaterial, deleteSpecialRegistration, getSpecialLecture, updateSpecialLecture,
} from "@/lib/db";
import { canWatch } from "@/lib/access";
import { SCHEDULE_CLASSES, holidayKey, homeworkAssignmentDays, parseHolidays, parseSchoolDays, previousMonth, scheduleKey, scheduleClassFor, schoolDaysFor, shiftSchoolDays, type ScheduleClass } from "@/lib/schedule";
import { specialRegistrationOpen } from "@/lib/special";
import {
  hashPin, checkPin, setStudent, clearStudent, getStudentIds, checkAdminPassword, setAdmin, isAdmin, clearAdmin,
} from "@/lib/auth";

export type FormState = { error?: string; ok?: string };

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 200);
const largeField = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim().slice(0, 6000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 한글 이름 사이 띄어쓰기는 지워서 같은 학생이 다른 이름으로 저장되지 않게 해요.
function normName(raw: string) {
  const name = raw.replace(/\s+/g, " ").trim();
  return /^[가-힣 ]+$/.test(name) ? name.replace(/ /g, "") : name;
}

// 로그인할 때는 띄어 쓴 이름과 붙여 쓴 이름을 모두 찾아요 (예전 신청 대비).
async function findByName(raw: string) {
  const names = [...new Set([raw, normName(raw)])];
  return (await Promise.all(names.map(findApplicationsByName))).flat();
}

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
  const name = normName(clean(fd.get("name")));
  const phone = clean(fd.get("phone")).replace(/[^0-9]/g, "");
  const depositor = clean(fd.get("depositor")) || name;
  const address = clean(fd.get("address"));
  const pin = clean(fd.get("pin"));
  const slot = clean(fd.get("slot"));

  if (!["onsite", "online"].includes(kind)) return { error: "수강 형태를 선택해 주세요." };
  if (!Object.hasOwn(COURSES, course)) return { error: "수강 신청한 반을 선택해 주세요." };
  if (!COURSES[course].tracks.includes(track)) return { error: "수강 과정을 선택해 주세요." };
  if (!isTimeSlot(slot)) return { error: "수강 시간(오전반/저녁반)을 선택해 주세요." };
  if (!["classroom", "delivery"].includes(pickup)) return { error: "교재 수령 방법을 선택해 주세요." };
  if (!/^[가-힣a-zA-Z ]{2,20}$/.test(name)) return { error: "이름을 한글 또는 영문으로 정확히 입력해 주세요." };
  if (kind === "online" && !/^01[0-9]{8,9}$/.test(phone)) return { error: "연락처를 정확히 입력해 주세요. (예: 01012345678)" };
  if (pickup === "delivery" && address.length < 10) return { error: "택배 받을 주소를 입력해 주세요." };
  if (!/^\d{4}$/.test(pin)) return { error: "강의실 비밀번호를 숫자 4자리로 정해 주세요." };
  if (pin !== clean(fd.get("pin2"))) return { error: "비밀번호 확인이 맞지 않아요. 같은 숫자 4자리를 두 번 입력해 주세요." };
  if (!fd.get("agree")) return { error: "필독 사항 확인에 체크해 주세요." };

  // 같은 달에 같은 이름 + 같은 비밀번호로 이미 낸 신청이 있으면 새로 만들지 않고 그 신청 화면으로 보내요.
  // 이름이 같아도 비밀번호가 다르면 동명이인으로 보고 새로 받아요.
  const mine = (await findByName(name)).filter((a) => checkPin(pin, a.pin_hash));
  const existing = mine.find((a) => a.cohort === cohort);
  if (existing) {
    await setStudent(mine.map((a) => a.id));
    redirect(`/my/${existing.id}?again=1`);
  }

  const id = await createApplication({
    cohort,
    kind,
    course,
    track,
    continuing,
    slot,
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
  const mine = (await findByName(name)).filter((a) => checkPin(pin, a.pin_hash));
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
  const previousDays = schoolDaysFor(rawPreviousDays, previous, klass);
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

// ── 특강 신청 (그 달 납부 완료 수강생만, 이름 + 강의실 비밀번호로 확인) ──────
const validTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function registerSpecialLecture(_: FormState, fd: FormData): Promise<FormState> {
  const eventId = clean(fd.get("event_id"));
  const mode = clean(fd.get("mode"));
  const name = clean(fd.get("name"));
  const pin = clean(fd.get("pin"));
  const event = await getSpecialLecture(eventId);
  if (!event) return { error: "신청할 특강을 선택해 주세요." };
  if (!specialRegistrationOpen(event.event_date, event.starts_at)) return { error: "신청 기간이 끝난 특강이에요." };
  if (mode !== "onsite" && mode !== "online") return { error: "현장 또는 불라방을 선택해 주세요." };
  if (!name || !/^\d{4}$/.test(pin)) return { error: "이름과 강의실 비밀번호 4자리를 입력해 주세요." };

  const mine = (await findByName(name)).filter((a) => checkPin(pin, a.pin_hash));
  const month = mine.filter((a) => a.cohort === event.event_date.slice(0, 7));
  if (month.length === 0) {
    await sleep(800);
    return { error: "이름 또는 강의실 비밀번호가 맞지 않아요. 이번 달 수강 신청 내역을 확인해 주세요." };
  }
  const paid = month.filter(canWatch);
  if (paid.length === 0) return { error: "수강 신청 후에 특강을 신청할 수 있어요." };

  // 특강 신청 후에는 강의실 로그인 상태가 돼서 이 페이지에서 바로 신청 내용을 볼 수 있어요.
  await setStudent(mine.map((a) => a.id));
  const already = (await getSpecialRegistrationsFor(paid.map((a) => a.id))).some((r) => r.special_lecture_id === eventId);
  if (!already) await createSpecialRegistration({ special_lecture_id: eventId, application_id: paid[0].id, mode, name: paid[0].name });
  revalidatePath("/special");
  if (already) return { ok: "이미 신청한 특강이에요. 아래에서 신청 내용을 확인해 주세요." };
  return {
    ok: mode === "onsite"
      ? "신청이 완료됐어요. 특강 당일 10시까지 필기구를 챙겨 703호로 와주세요."
      : "신청이 완료됐어요. 자료는 특강 하루 전, 참여 링크는 특강 시작 전에 이 페이지에 올라와요.",
  };
}

// 특강 페이지에서 강의실 계정으로 로그인 (강의실과 같은 이름·비밀번호)
export async function specialLogin(_: FormState, fd: FormData): Promise<FormState> {
  const name = clean(fd.get("name"));
  const pin = clean(fd.get("pin"));
  if (!name || !/^\d{4}$/.test(pin)) return { error: "이름과 강의실 비밀번호 4자리를 입력해 주세요." };
  const mine = (await findByName(name)).filter((a) => checkPin(pin, a.pin_hash));
  if (mine.length === 0) {
    await sleep(800);
    return { error: "이름 또는 강의실 비밀번호가 맞지 않아요. 잊어버렸다면 Vella에게 문의해 주세요." };
  }
  await setStudent(mine.map((a) => a.id));
  redirect("/special");
}

export async function specialLogout() {
  await clearStudent();
  redirect("/special");
}

// ── 특강 관리 (관리자) ─────────────────────────
function specialFields(fd: FormData) {
  const event_date = clean(fd.get("event_date"));
  const title = clean(fd.get("title"));
  const starts_at = clean(fd.get("starts_at"));
  const ends_at = clean(fd.get("ends_at"));
  if (!validDate(event_date) || !title || !validTime(starts_at)) return null;
  if (ends_at && (!validTime(ends_at) || ends_at <= starts_at)) return null;
  return { event_date, title, starts_at, ends_at: ends_at || null };
}

export async function addSpecialLecture(fd: FormData) {
  if (!(await isAdmin())) return;
  const fields = specialFields(fd);
  if (!fields) return;
  await createSpecialLecture(fields);
  revalidatePath("/admin/special");
  revalidatePath("/special");
}

export async function saveSpecialLecture(fd: FormData) {
  if (!(await isAdmin())) return;
  const fields = specialFields(fd);
  const youtube = clean(fd.get("youtube_url"));
  const youtube_id = youtube ? youtubeId(youtube) : null;
  if (!fields || (youtube && !youtube_id)) return;
  await updateSpecialLecture(clean(fd.get("id")), { ...fields, youtube_id });
  revalidatePath("/admin/special");
  revalidatePath("/special");
}

export async function removeSpecialLecture(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteSpecialLecture(clean(fd.get("id")));
  revalidatePath("/admin/special");
  revalidatePath("/special");
}

export async function removeSpecialRegistration(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteSpecialRegistration(clean(fd.get("id")));
  revalidatePath("/admin/special");
  revalidatePath("/special");
}

export async function removeSpecialMaterial(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteSpecialMaterial(clean(fd.get("id")));
  revalidatePath("/admin/special");
  revalidatePath("/special");
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

// 수강 시간(오전반/저녁반) 바꾸기. 비우면 '시간 미정'이 돼요.
export async function changeSlot(fd: FormData) {
  if (!(await isAdmin())) return;
  const slot = clean(fd.get("slot"));
  await updateApplication(clean(fd.get("id")), { slot: isTimeSlot(slot) ? slot : null });
  revalidatePath("/admin");
  revalidatePath("/admin/roster");
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
  if (!ids.includes(id) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > todayKST()) return;
  const [app] = await getApplications([id]);
  if (!app || !canWatch(app)) return;
  const klass = scheduleClassFor(app.course, app.track);
  const rawDays = await getSetting(scheduleKey(app.cohort, klass));
  const savedDays = schoolDaysFor(rawDays, app.cohort, klass);
  if (!homeworkAssignmentDays(savedDays).includes(day)) return;
  await addHomeworkSticker(app.id, day);
  revalidatePath("/class");
}

export async function cancelMyHomeworkDone(fd: FormData) {
  const id = clean(fd.get("app_id"));
  const day = clean(fd.get("day"));
  const ids = await getStudentIds();
  if (!ids.includes(id) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > todayKST()) return;
  const [app] = await getApplications([id]);
  if (!app || !canWatch(app)) return;
  const klass = scheduleClassFor(app.course, app.track);
  const rawDays = await getSetting(scheduleKey(app.cohort, klass));
  const savedDays = schoolDaysFor(rawDays, app.cohort, klass);
  if (!homeworkAssignmentDays(savedDays).includes(day)) return;
  await deleteHomeworkSticker(app.id, day);
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

export async function bulkConfirmPayment(fd: FormData) {
  if (!(await isAdmin())) return;
  const ids = checkedIds(fd);
  if (ids.length === 0) return;
  const apps = await getApplications(ids);
  const pendingIds = apps.filter((app) => app.status === "pending").map((app) => app.id);
  await updateApplications(pendingIds, { status: "paid" });
  revalidatePath("/admin");
}

// 불라방 교재: 체크한 학생 중 납부 완료 상태만 수령·발송 완료로 바꿔요.
export async function bulkMarkBooksDone(fd: FormData) {
  if (!(await isAdmin())) return;
  const ids = checkedIds(fd);
  if (ids.length === 0) return;
  const apps = await getApplications(ids);
  const ready = apps.filter((app) => app.status === "paid" && app.kind === "online").map((app) => app.id);
  await updateApplications(ready, { status: "shipped" });
  revalidatePath("/admin/delivery");
  revalidatePath("/admin");
}

export async function bulkChangeSlot(fd: FormData) {
  if (!(await isAdmin())) return;
  const slot = clean(fd.get("slot"));
  await updateApplications(checkedIds(fd), { slot: isTimeSlot(slot) ? slot : null });
  revalidatePath("/admin");
  revalidatePath("/admin/roster");
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
