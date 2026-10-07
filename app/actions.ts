"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  COURSES, PARTS, LECTURE_COURSES, DEPOSIT_MINUTES, booksFor, isAlt, isTimeSlot, calcAmount, youtubeId, todayKST,
  type CourseId, type Kind, type Part, type Pickup, type Status, type Track,
} from "@/lib/config";
import {
  createApplication, deleteApplication, deleteApplications, getApplication, getApplications, addHomeworkSticker, deleteHomeworkSticker, deletePhotosBefore, findApplicationsByName, updateApplication, updateApplications, setSetting, addLecture, updateLecture, deleteLecture, currentCohort, roundFor, addAttendance, getSetting,
  saveMission, type Mission, listFaq, getFaq, createFaq, updateFaq, deleteFaq, createQuestion, updateQuestion, getQuestion, listAudios, getAudio, createAudio, setAudioOrder, deleteAudios, audioUploadUrl, uploadedAudioSize, createSpecialLecture, createSpecialRegistration, updateOnsiteRegistrations, expireSpecialDeposits, updateDepositEvent, getSpecialRegistrationsFor, deleteSpecialLecture, deleteSpecialMaterial, deleteSpecialRegistration, getSpecialLecture, updateSpecialLecture,
} from "@/lib/db";
import { canWatch, isActive, loginApps } from "@/lib/access";
import { parseBankSms } from "@/lib/bankSms";
import { activeStudentApps } from "@/lib/student";
import { SCHEDULE_CLASSES, holidayKey, homeworkAssignmentDays, parseHolidays, parseSchoolDays, previousMonth, scheduleKey, scheduleClassFor, schoolDaysFor, shiftSchoolDays, type ScheduleClass } from "@/lib/schedule";
import { specialRegistrationOpen } from "@/lib/special";
import { MISSION_STEPS, studentMission, type MissionStep } from "@/lib/mission";
import { AUDIO_MAX_BYTES, audioExpiresOn, isAudioBook } from "@/lib/audio";
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
  // 불라방 1층 데스크 수령 희망 날짜·시간 (미리 준비할 수 있게)
  const deskPickup = kind === "online" && pickup === "classroom";
  const pickupDate = clean(fd.get("pickup_date"));
  const pickupTime = clean(fd.get("pickup_time"));
  const pin = clean(fd.get("pin"));
  const slot = clean(fd.get("slot"));

  if (!["onsite", "online"].includes(kind)) return { error: "수강 형태를 선택해 주세요." };
  if (!Object.hasOwn(COURSES, course)) return { error: "수강 신청한 반을 선택해 주세요." };
  if (!COURSES[course].tracks.includes(track)) return { error: "수강 과정을 선택해 주세요." };
  if (!isTimeSlot(slot)) return { error: "수강 시간(오전반/저녁반)을 선택해 주세요." };
  if (!["classroom", "delivery"].includes(pickup)) return { error: "교재 수령 방법을 선택해 주세요." };
  if (!/^[가-힣a-zA-Z ]{2,20}$/.test(name)) return { error: "이름을 한글 또는 영문으로 정확히 입력해 주세요." };
  if (kind === "online" && !/^01[0-9]{8,9}$/.test(phone)) return { error: "연락처를 정확히 입력해 주세요. (예: 01012345678)" };
  if (deskPickup && (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || pickupDate < todayKST())) return { error: "교재 받을 날짜를 오늘 이후로 골라 주세요." };
  if (deskPickup && !/^([01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)) return { error: "교재 받을 시간을 골라 주세요." };
  if (pickup === "delivery" && address.length < 10) return { error: "택배 받을 주소를 입력해 주세요." };
  if (!/^\d{4}$/.test(pin)) return { error: "강의실 비밀번호를 숫자 4자리로 정해 주세요." };
  if (pin !== clean(fd.get("pin2"))) return { error: "비밀번호 확인이 맞지 않아요. 같은 숫자 4자리를 두 번 입력해 주세요." };
  if (!fd.get("agree")) return { error: "필독 사항 확인에 체크해 주세요." };

  // 같은 달에 같은 이름 + 같은 비밀번호로 이미 낸 신청이 있으면 새로 만들지 않고 그 신청 화면으로 보내요.
  // 이름이 같아도 비밀번호가 다르면 동명이인으로 보고 새로 받아요.
  const mine = (await findByName(name)).filter((a) => checkPin(pin, a.pin_hash) && isActive(a));
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
    pickup_date: deskPickup ? pickupDate : null,
    pickup_time: deskPickup ? pickupTime : null,
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
  // 환불·삭제된 수강생은 로그인할 수 없어요.
  const result = loginApps(await findByName(name), (a) => checkPin(pin, a.pin_hash));
  if (!result.apps) {
    await sleep(800);
    return { error: result.error };
  }
  await setStudent(result.apps.map((a) => a.id));
  const next = clean(fd.get("next"));
  redirect(next === "/check" || next.startsWith("/check?") || next === "/class" || next === "/mission" || next === "/faq" ? next : "/class");
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
  if (!["pending", "paid", "shipped", "refunded"].includes(status)) return;
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
  // 첫 수업 미션 링크 (비워두면 미션 화면에서 버튼이 숨겨져요)
  for (const key of ["cafe_url", "blog_url"]) {
    const value = clean(fd.get(key));
    try {
      if (!value || new URL(value).protocol === "https:") await setSetting(key, value);
    } catch {
      // 잘못된 주소는 기존 주소를 유지해요.
    }
  }
  revalidatePath("/admin");
  revalidatePath("/mission");
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
  const slot = clean(fd.get("slot"));
  const title = clean(fd.get("title"));
  const yt = youtubeId(clean(fd.get("url")));
  if (!/^\d{4}-\d{2}$/.test(cohort)) return { error: "기수를 선택해 주세요." };
  if (!LECTURE_COURSES.includes(course)) return { error: "반을 선택해 주세요." };
  if (!Object.hasOwn(PARTS, part)) return { error: "RC/LC를 선택해 주세요." };
  if (!isTimeSlot(slot)) return { error: "오전반/저녁반을 선택해 주세요." };
  if (!title) return { error: "강의 제목을 입력해 주세요." };
  if (!yt) return { error: "유튜브 링크를 확인해 주세요." };
  await addLecture({ cohort, course, part, slot, title, youtube_id: yt });
  revalidatePath("/class");
  revalidatePath("/admin/lectures");
  return { ok: `'${title}' 강의를 올렸어요.` };
}

// 올린 강의의 제목·링크·기수·반·RC/LC 고치기 (잘못된 값이면 그대로 둬요)
export async function editLecture(fd: FormData) {
  if (!(await isAdmin())) return;
  const cohort = clean(fd.get("cohort"));
  const course = clean(fd.get("course")) as CourseId;
  const part = clean(fd.get("part")) as Part;
  const slot = clean(fd.get("slot"));
  const title = clean(fd.get("title"));
  const yt = youtubeId(clean(fd.get("url")));
  if (!validCohort(cohort) || !LECTURE_COURSES.includes(course) || !Object.hasOwn(PARTS, part) || !isTimeSlot(slot) || !title || !yt) return;
  await updateLecture(clean(fd.get("id")), { cohort, course, part, slot, title, youtube_id: yt });
  revalidatePath("/admin/lectures");
  revalidatePath("/class");
}

export async function removeLecture(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteLecture(clean(fd.get("id")));
  revalidatePath("/admin/lectures");
}

// ── LC 음원 zip (관리자) ───────────────────────
// 1단계: 브라우저가 Supabase 보관함으로 바로 올릴 서명된 주소를 받아요. (Vercel 서버를 거치지 않아요)
export async function prepareAudioUpload(input: { cohort: string; book: string; fileName: string; size: number }): Promise<{ error?: string; path?: string; url?: string | null }> {
  if (!(await isAdmin())) return { error: "관리자 로그인이 필요해요." };
  if (!validCohort(input.cohort) || !isAudioBook(input.book)) return { error: "기수와 LC 교재를 다시 골라 주세요." };
  if (!/\.zip$/i.test(input.fileName)) return { error: "zip 파일만 올릴 수 있어요." };
  if (input.size > AUDIO_MAX_BYTES) return { error: "파일 하나가 50MB를 넘으면 올릴 수 없어요. 나눠서 압축해 주세요." };
  const path = `${input.cohort}/${input.book}/${crypto.randomUUID()}.zip`;
  return { path, url: await audioUploadUrl(path) };
}

// 2단계: 올라간 파일을 확인하고 목록에 추가해요. 제목은 파일 이름에서 .zip을 뺀 것이에요.
export async function finishAudioUpload(input: { cohort: string; book: string; path: string; fileName: string; size: number }): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "관리자 로그인이 필요해요." };
  const { cohort, book, path } = input;
  if (!validCohort(cohort) || !isAudioBook(book) || !path.startsWith(`${cohort}/${book}/`)) return { error: "잘못된 요청이에요." };
  const size = await uploadedAudioSize(path);
  if (size === null) return { error: "파일이 올라가지 않았어요. 다시 시도해 주세요." };
  const same = (await listAudios(cohort)).filter((a) => a.book === book);
  await createAudio({
    cohort,
    book,
    title: input.fileName.replace(/\.zip$/i, "").trim().slice(0, 200) || "LC 음원",
    storage_path: path,
    size_bytes: size || input.size,
    sort_order: same.reduce((max, a) => Math.max(max, a.sort_order), 0) + 1,
  });
  revalidatePath("/admin/audio");
  return {};
}

export async function moveAudio(fd: FormData) {
  if (!(await isAdmin())) return;
  const audio = await getAudio(clean(fd.get("id")));
  if (!audio) return;
  const list = (await listAudios(audio.cohort)).filter((a) => a.book === audio.book);
  const i = list.findIndex((a) => a.id === audio.id);
  const j = clean(fd.get("dir")) === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  // 순서가 꼬이지 않게 이 교재 목록 전체를 1, 2, 3… 으로 다시 매겨요.
  await Promise.all(list.map((a, n) => (a.sort_order === n + 1 ? null : setAudioOrder(a.id, n + 1))));
  revalidatePath("/admin/audio");
  revalidatePath("/class");
}

export async function removeAudio(fd: FormData) {
  if (!(await isAdmin())) return;
  const audio = await getAudio(clean(fd.get("id")));
  if (audio) await deleteAudios([audio]);
  revalidatePath("/admin/audio");
  revalidatePath("/class");
}

// 그 기수 모든 반의 다운로드 기간이 끝난 음원을 보관함에서 지워요.
export async function cleanupExpiredAudios() {
  if (!(await isAdmin())) return;
  const today = todayKST();
  const all = await listAudios();
  for (const cohort of [...new Set(all.map((a) => a.cohort))]) {
    const end = await audioExpiresOn(cohort);
    if (end && end < today) await deleteAudios(all.filter((a) => a.cohort === cohort));
  }
  revalidatePath("/admin/audio");
}

// ── 자주 묻는 질문 · 질문함 ─────────────────────
// 학생: FAQ 아래 '여기 없는 질문 남기기' (로그인한 수강생만, 실명 저장, 알림 없음)
export async function submitQuestion(_: FormState, fd: FormData): Promise<FormState> {
  const { apps } = await activeStudentApps();
  if (apps.length === 0) return { error: "강의실에 로그인한 수강생만 남길 수 있어요." };
  const kind = clean(fd.get("kind"));
  const content = String(fd.get("content") ?? "").trim().slice(0, 1000);
  if (kind !== "question" && kind !== "suggestion") return { error: "질문 또는 제안을 골라 주세요." };
  if (content.length < 2) return { error: "내용을 적어 주세요." };
  await createQuestion({ app_id: apps[0].id, name: apps[0].name, kind, content });
  revalidatePath("/admin/faq");
  return { ok: "잘 받았어요! Vella쌤이 확인할게요." };
}

function faqFields(fd: FormData) {
  const category = clean(fd.get("category")) || clean(fd.get("new_category"));
  const question = clean(fd.get("question"));
  const answer = String(fd.get("answer") ?? "").trim().slice(0, 3000);
  return category && question ? { category, question, answer } : null;
}

export async function addFaq(fd: FormData) {
  if (!(await isAdmin())) return;
  const fields = faqFields(fd);
  if (!fields) return;
  const last = (await listFaq()).reduce((m, f) => Math.max(m, f.sort_order), 0);
  await createFaq({ ...fields, published: !!fd.get("published"), sort_order: last + 10 });
  revalidatePath("/admin/faq");
  revalidatePath("/faq");
}

export async function saveFaq(fd: FormData) {
  if (!(await isAdmin())) return;
  const fields = faqFields(fd);
  if (!fields) return;
  await updateFaq(clean(fd.get("id")), { ...fields, published: !!fd.get("published") });
  revalidatePath("/admin/faq");
  revalidatePath("/faq");
}

export async function toggleFaq(fd: FormData) {
  if (!(await isAdmin())) return;
  const item = await getFaq(clean(fd.get("id")));
  if (item) await updateFaq(item.id, { published: !item.published });
  revalidatePath("/admin/faq");
  revalidatePath("/faq");
}

// 같은 카테고리 안에서 한 칸 위/아래로 옮겨요.
export async function moveFaq(fd: FormData) {
  if (!(await isAdmin())) return;
  const item = await getFaq(clean(fd.get("id")));
  if (!item) return;
  const all = await listFaq();
  const list = all.filter((f) => f.category === item.category);
  const i = list.findIndex((f) => f.id === item.id);
  const j = clean(fd.get("dir")) === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return;
  await Promise.all([updateFaq(list[i].id, { sort_order: list[j].sort_order }), updateFaq(list[j].id, { sort_order: list[i].sort_order })]);
  revalidatePath("/admin/faq");
  revalidatePath("/faq");
}

export async function removeFaq(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteFaq(clean(fd.get("id")));
  revalidatePath("/admin/faq");
  revalidatePath("/faq");
}

export async function toggleQuestionChecked(fd: FormData) {
  if (!(await isAdmin())) return;
  const q = await getQuestion(clean(fd.get("id")));
  if (q) await updateQuestion(q.id, { checked: !q.checked });
  revalidatePath("/admin/faq");
}

// 질문함의 질문을 숨김 상태 FAQ로 올려요. 답을 채운 뒤 공개하면 돼요.
export async function promoteQuestion(fd: FormData) {
  if (!(await isAdmin())) return;
  const q = await getQuestion(clean(fd.get("id")));
  if (!q) return;
  const last = (await listFaq()).reduce((m, f) => Math.max(m, f.sort_order), 0);
  await createFaq({ category: "💬 기타", question: q.content.slice(0, 200), answer: "", published: false, sort_order: last + 10 });
  await updateQuestion(q.id, { checked: true });
  revalidatePath("/admin/faq");
}

// ── 첫 수업 미션 ───────────────────────────────
const EMPTY_MISSION = { prev_score: null, target_score: null, exam_month: null, affiliation: null, instagram: null, message: null, intro_at: null, cafe_at: null, blog_at: null, insta_at: null };
// 기존 기록(지난달 기록 포함)을 이어받아 이번 신청에 저장할 바탕을 만들어요.
function missionBase(mission: Mission | null) {
  if (!mission) return { ...EMPTY_MISSION };
  const { app_id: _app, updated_at: _updated, ...rest } = mission;
  return rest;
}

export async function saveMissionIntro(_: FormState, fd: FormData): Promise<FormState> {
  const current = await studentMission();
  if (!current) return { error: "강의실에 로그인해 주세요." };
  const short = (k: string) => clean(fd.get(k)).slice(0, 40);
  const prev_score = short("prev_score");
  const target_score = short("target_score");
  const exam_month = short("exam_month");
  if (!prev_score || !target_score || !exam_month) return { error: "이전 점수, 목표 점수, 시험 예정은 꼭 적어 주세요." };
  const base = missionBase(current.mission);
  await saveMission({
    ...base,
    app_id: current.app.id,
    prev_score,
    target_score,
    exam_month,
    affiliation: short("affiliation") || null,
    instagram: short("instagram") || null,
    message: clean(fd.get("message")) || null,
    intro_at: base.intro_at ?? new Date().toISOString(),
  });
  revalidatePath("/mission");
  revalidatePath("/class");
  return { ok: "저장했어요!" };
}

export async function markMission(fd: FormData) {
  const step = clean(fd.get("step")) as MissionStep;
  if (!MISSION_STEPS.includes(step) || step === "intro_at") return;
  const current = await studentMission();
  if (!current) return;
  const base = missionBase(current.mission);
  await saveMission({ ...base, app_id: current.app.id, [step]: base[step] ?? new Date().toISOString() });
  revalidatePath("/mission");
  revalidatePath("/class");
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

  const mine = (await findByName(name)).filter((a) => checkPin(pin, a.pin_hash) && isActive(a));
  const month = mine.filter((a) => a.cohort === event.event_date.slice(0, 7));
  if (month.length === 0) {
    await sleep(800);
    return { error: "이름 또는 강의실 비밀번호가 맞지 않아요. 이번 달 수강 신청 내역을 확인해 주세요." };
  }
  const paid = month.filter(canWatch);
  if (paid.length === 0) return { error: "수강 신청 후에 특강을 신청할 수 있어요." };

  // 특강 신청 후에는 강의실 로그인 상태가 돼서 이 페이지에서 바로 신청 내용을 볼 수 있어요.
  await setStudent(mine.map((a) => a.id));
  await expireSpecialDeposits(DEPOSIT_MINUTES);
  const existing = (await getSpecialRegistrationsFor(paid.map((a) => a.id))).filter((r) => r.special_lecture_id === eventId);
  // 입금 기한이 지나 취소된 신청은 지우고 새로 받아요.
  for (const r of existing.filter((x) => x.deposit === "cancelled")) await deleteSpecialRegistration(r.id);
  const already = existing.some((r) => r.deposit !== "cancelled");
  if (!already) await createSpecialRegistration({ special_lecture_id: eventId, application_id: paid[0].id, mode, name: paid[0].name, deposit: mode === "onsite" ? "pending" : null });
  revalidatePath("/special");
  if (already) return { ok: "이미 신청한 특강이에요. 아래에서 신청 내용을 확인해 주세요." };
  return {
    ok: mode === "onsite"
      ? "신청이 완료됐어요. 보증금 1만 원을 본인 이름으로 입금해 주세요. 특강에 참여하면 현장에서 100% 돌려드려요. 계좌는 아래 '내 특강 신청'에 있어요."
      : "신청이 완료됐어요. 자료는 특강 하루 전, 참여 링크는 특강 시작 전에 이 페이지에 올라와요.",
  };
}

// 특강 페이지에서 강의실 계정으로 로그인 (강의실과 같은 이름·비밀번호)
export async function specialLogin(_: FormState, fd: FormData): Promise<FormState> {
  const name = clean(fd.get("name"));
  const pin = clean(fd.get("pin"));
  if (!name || !/^\d{4}$/.test(pin)) return { error: "이름과 강의실 비밀번호 4자리를 입력해 주세요." };
  const result = loginApps(await findByName(name), (a) => checkPin(pin, a.pin_hash));
  if (!result.apps) {
    await sleep(800);
    return { error: result.error };
  }
  await setStudent(result.apps.map((a) => a.id));
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

// 현장 신청 명단 일괄 처리: 보증금 확정 / 입금 대기로 되돌리기 (환급은 현장에서 직접)
export async function bulkSpecialOnsite(fd: FormData) {
  if (!(await isAdmin())) return;
  const ids = fd.getAll("ids").map(clean).filter(Boolean);
  const op = clean(fd.get("op"));
  const patch =
    op === "confirm" ? { deposit: "paid" as const, deposit_paid_at: new Date().toISOString() }
    : op === "pending" ? { deposit: "pending" as const, deposit_paid_at: null }
    : null;
  if (!patch) return;
  await updateOnsiteRegistrations(ids, patch);
  revalidatePath("/admin/special");
  revalidatePath("/special");
}

// '확인 필요' 입금 문자를 특정 현장 신청에 연결해 확정하거나, 무시해요.
export async function resolveDepositEvent(fd: FormData) {
  if (!(await isAdmin())) return;
  const eventId = clean(fd.get("event_id"));
  const registrationId = clean(fd.get("registration_id"));
  if (registrationId) {
    await updateOnsiteRegistrations([registrationId], { deposit: "paid", deposit_paid_at: new Date().toISOString() });
    await updateDepositEvent(eventId, { result: "resolved", registration_id: registrationId });
  } else {
    await updateDepositEvent(eventId, { result: "dismissed" });
  }
  revalidatePath("/admin/special");
  revalidatePath("/special");
}

// '확인 필요' 교재비 입금 문자를 특정 수강 신청에 연결해 납부 확인하거나, 무시해요.
export async function resolveBookDepositEvent(fd: FormData) {
  if (!(await isAdmin())) return;
  const eventId = clean(fd.get("event_id"));
  const applicationId = clean(fd.get("application_id"));
  if (applicationId) {
    const [app] = await getApplications([applicationId]);
    if (app?.status === "pending") await updateApplications([app.id], { status: "paid" });
    await updateDepositEvent(eventId, { result: "resolved", application_id: applicationId });
  } else {
    await updateDepositEvent(eventId, { result: "dismissed" });
  }
  revalidatePath("/admin");
}

// 관리자용: 은행 문자 예시를 붙여 넣어 이름·금액이 제대로 읽히는지 확인 (저장하지 않아요)
export async function testBankSms(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await isAdmin())) return { error: "관리자 로그인이 필요해요." };
  const parsed = parseBankSms(String(fd.get("sms") ?? "").slice(0, 2000));
  return parsed ? { ok: `입금자명: ${parsed.name} · 금액: ${parsed.amount.toLocaleString("ko-KR")}원` } : { error: "이 문자에서는 입금자명·금액을 읽지 못했어요. 문자 예시를 Claude에게 보내 주세요." };
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

// 수강 시간(오전반/저녁반) 바꾸기. 시간 미정으로 되돌릴 수는 없어요.
export async function changeSlot(fd: FormData) {
  if (!(await isAdmin())) return;
  const slot = clean(fd.get("slot"));
  if (!isTimeSlot(slot)) return; // 오전반/저녁반 중 하나만 (시간 미정 없음)
  await updateApplication(clean(fd.get("id")), { slot });
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

// 체크한 학생들에게 그날 출석(+숙제) 스티커를 한 번에 붙여요. (QR이 안 됐던 날 보정용)
export async function bulkStamp(fd: FormData) {
  if (!(await isAdmin())) return;
  const day = clean(fd.get("day"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > todayKST()) return;
  const withHomework = clean(fd.get("what")) === "both";
  const apps = (await getApplications(checkedIds(fd))).filter(canWatch);
  for (const a of apps) {
    await addAttendance(a.id, day);
    if (withHomework) await addHomeworkSticker(a.id, day, `${day}T12:00:00+09:00`);
  }
  revalidatePath("/admin/stamps");
  revalidatePath("/class");
}

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
  if (!isTimeSlot(slot)) return;
  await updateApplications(checkedIds(fd), { slot });
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
