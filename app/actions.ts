"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  COURSES, PARTS, LECTURE_COURSES, DEPOSIT_MINUTES, YBM_ORDER_AMOUNT, booksFor, isAlt, isTimeSlot, calcAmount, youtubeId, todayKST,
  type CourseId, type Kind, type Part, type Pickup, type Status, type Track,
} from "@/lib/config";
import {
  createApplication, listApplications, deleteApplication, deleteApplications, getApplication, getApplications, addHomeworkSticker, deleteHomeworkSticker, setHomeworkStar, drawGift, getGiftDraw, saveGiftItem, deleteGiftItem, setGiftSent, type GiftDraw, deletePhotosBefore, findApplicationsByName, updateApplication, updateApplications, setSetting, addLecture, updateLecture, deleteLecture, currentCohort, roundFor, addAttendance, getSetting,
  saveMission, type Mission, createYbmOrder, listYbmOrders, updateYbmOrders, setAttendanceState, listStamps, createNotice, updateNotice, deleteNotice, markNoticeRead, listTestResults, saveTestResult, saveTestOverride, setTestDouble, deleteTestOverride, listFaq, getFaq, createFaq, updateFaq, deleteFaq, createQuestion, updateQuestion, getQuestion, listAudios, getAudio, createAudio, setAudioOrder, deleteAudios, audioUploadUrl, uploadedAudioSize, createSpecialLecture, createSpecialRegistration, updateOnsiteRegistrations, expireSpecialDeposits, updateDepositEvent, getSpecialRegistrationsFor, deleteSpecialLecture, deleteSpecialMaterial, deleteSpecialRegistration, getSpecialLecture, updateSpecialLecture,
} from "@/lib/db";
import { canWatch, isActive, loginApps } from "@/lib/access";
import { parseBankSms } from "@/lib/bankSms";
import { checkTestAnswer, earlyTestDay, testsForClassDay, type TestKind } from "@/lib/tests";
import { classDaysOf, planFor, takesTests } from "@/lib/dailyTests";
import { noticeIdentity } from "@/lib/noticeView";
import type { NoticeSection, NoticeTarget } from "@/lib/notices";
import { activeStudentApps } from "@/lib/student";
import { SCHEDULE_CLASSES, holidayKey, homeworkAssignmentDays, isHomeworkStickerEligible, parseHolidays, parseSchoolDays, previousMonth, scheduleKey, scheduleClassFor, schoolDaysFor, shiftSchoolDays, type ScheduleClass } from "@/lib/schedule";
import { specialRegistrationOpen } from "@/lib/special";
import { MISSION_STEPS, studentMission, type MissionStep } from "@/lib/mission";
import { AUDIO_MAX_BYTES, audioExpiresOn, autoCleanupAudios, isAudioBook } from "@/lib/audio";
import { classAppsFor, classCohortNow } from "@/lib/classCohort";
import { boardsFor, giftCode, kindText, klassText, studentKeyOf } from "@/lib/gifts";
import { giftWindowOpen } from "@/lib/stickerComplete";
import { planCohortMove } from "@/lib/cohortMove";
import { linkWaitingDeposit } from "@/lib/deposits";
import { signupMonths } from "@/lib/signupMonthsServer";
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
  // 수강 월: 학생이 신청서에서 고른 달 (오늘 고를 수 있는 달만 받아요)
  const cohort = clean(fd.get("cohort"));
  if (!(await signupMonths()).some((m) => m.cohort === cohort)) return { error: "몇 월 수업인지 다시 골라 주세요." };
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
  if (!fd.get("ybm_registered")) return { error: "YBM 학원 수강 등록을 먼저 마쳐 주세요. (등록했다면 체크)" };
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
  // 신청서보다 먼저 온 입금이 있으면 바로 연결해서 납부 확인해요
  await linkWaitingDeposit({ kind: "app", id, depositor, amount: calcAmount(books, pickup) });
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

// 관리자 알림: 새 신청을 확인했어요 → 이 시각 이후 신청만 "새 신청"으로 보여요
export async function markAppsSeen() {
  if (!(await isAdmin())) return;
  await setSetting("admin_seen_apps_at", new Date().toISOString());
  revalidatePath("/admin", "layout");
}

export async function logout() {
  await clearAdmin();
  redirect("/admin");
}

export async function changeStatus(fd: FormData) {
  if (!(await isAdmin())) return;
  const status = clean(fd.get("status")) as Status;
  if (!["pending", "paid", "shipped", "refunded"].includes(status)) return;
  const id = clean(fd.get("id"));
  await updateApplication(id, { status });
  if (status === "refunded") {
    // 환불하면 아직 입금 전인 현장 특강 신청은 자동 취소해요. (입금한 보증금은 관리자 알림으로 돌려줘요)
    const waiting = (await getSpecialRegistrationsFor([id])).filter((r) => r.mode === "onsite" && (r.deposit === "pending" || r.deposit === "review"));
    await updateOnsiteRegistrations(waiting.map((r) => r.id), { deposit: "cancelled" });
    revalidatePath("/admin/special");
  }
  revalidatePath("/admin");
}

// 관리자: 수강 환불자의 특강 보증금을 돌려줬어요 (여러 명 한 번에)
export async function markDepositRefunded(fd: FormData) {
  if (!(await isAdmin())) return;
  const ids = fd.getAll("ids").map(clean).filter(Boolean);
  await updateOnsiteRegistrations(ids, { deposit: "cancelled", deposit_refunded_at: new Date().toISOString() });
  revalidatePath("/admin/special");
  revalidatePath("/admin", "layout");
}

export async function resetPin(fd: FormData) {
  if (!(await isAdmin())) return;
  const pin = clean(fd.get("pin"));
  if (!/^\d{4}$/.test(pin)) return;
  await updateApplication(clean(fd.get("id")), { pin_hash: hashPin(pin) });
  revalidatePath("/admin");
}

// '이번 달 할 일': 다음 달 수업일을 확인했어요
export async function confirmSchedule(fd: FormData) {
  if (!(await isAdmin())) return;
  const cohort = clean(fd.get("cohort"));
  if (!/^\d{4}-\d{2}$/.test(cohort)) return;
  await setSetting(`schedule_confirmed:${cohort}`, clean(fd.get("undo")) ? "" : "1");
  revalidatePath("/admin", "layout");
}

// '이번 달 할 일': 이번 달 환불 학생을 단톡방에서 내보냈어요
export async function markChatKicked() {
  if (!(await isAdmin())) return;
  const running = await classCohortNow();
  const ids = (await listApplications()).filter((a) => a.cohort === running && a.status === "refunded").map((a) => a.id);
  await setSetting(`chat_kicked:${running}`, ids.join(","));
  revalidatePath("/admin");
}

export async function saveSettings(fd: FormData) {
  if (!(await isAdmin())) return;
  await setSetting("bank_account", clean(fd.get("bank_account")));
  const c = clean(fd.get("current_cohort"));
  // 현재 모집 기수: 관리 화면 기본 표시용. 비우면 신청서 수강 월 규칙대로 자동
  if (/^\d{4}-\d{2}$/.test(c) || (fd.has("current_cohort") && c === "")) await setSetting("current_cohort", c);
  // 강의실 단톡방 (오픈채팅 링크·참여코드). 참여코드를 바꾸면 바꾼 날을 남겨 '이번 달 할 일'에서 확인해요.
  // 벨라토익 카톡 채널 주소 (선물 결과 카드의 [카톡 채널 열기] 버튼)
  if (fd.has("kakao_channel_url")) {
    const ch = clean(fd.get("kakao_channel_url"));
    if (!ch || /^https:\/\//.test(ch)) await setSetting("kakao_channel_url", ch);
  }
  if (fd.has("chat_url")) {
    const chatUrl = clean(fd.get("chat_url"));
    if (!chatUrl || /^https:\/\//.test(chatUrl)) await setSetting("chat_url", chatUrl);
    const code = clean(fd.get("chat_code")).slice(0, 20);
    if (code !== (await getSetting("chat_code"))) {
      await setSetting("chat_code", code);
      await setSetting("chat_code_changed_on", todayKST());
    }
  }
  // 교재 회차는 자동으로 번갈아 정해지고, 필요할 때만 여기서 바꿔요
  const round = clean(fd.get("round"));
  const roundCohort = c || (await currentCohort()); // 모집 기수를 비우면 자동 기수에 적용
  if (/^\d{4}-\d{2}$/.test(roundCohort) && (round === "1" || round === "2")) await setSetting(`round_${roundCohort}`, round);
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
  for (const key of ["cafe_url", "blog_url", "study_board_url"]) {
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
  // 반·RC/LC·시간대는 여러 개 고를 수 있어요. 고른 조합마다 강의를 하나씩 등록해요.
  const courses = [...new Set(fd.getAll("course").map(clean))].filter((c): c is CourseId => LECTURE_COURSES.includes(c as CourseId));
  const parts = [...new Set(fd.getAll("part").map(clean))].filter((p): p is Part => Object.hasOwn(PARTS, p));
  const slots = [...new Set(fd.getAll("slot").map(clean))].filter(isTimeSlot);
  const title = clean(fd.get("title"));
  const yt = youtubeId(clean(fd.get("url")));
  if (!/^\d{4}-\d{2}$/.test(cohort)) return { error: "기수를 선택해 주세요." };
  if (courses.length === 0) return { error: "반을 선택해 주세요." };
  if (parts.length === 0) return { error: "RC/LC를 선택해 주세요." };
  if (slots.length === 0) return { error: "오전반/저녁반을 선택해 주세요." };
  if (!title) return { error: "강의 제목을 입력해 주세요." };
  if (!yt) return { error: "유튜브 링크를 확인해 주세요." };
  let count = 0;
  for (const course of courses) for (const part of parts) for (const slot of slots) {
    await addLecture({ cohort, course, part, slot, title, youtube_id: yt });
    count++;
  }
  revalidatePath("/class");
  revalidatePath("/admin/lectures");
  return { ok: count > 1 ? `'${title}' 강의를 ${count}곳에 올렸어요.` : `'${title}' 강의를 올렸어요.` };
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
  await autoCleanupAudios(); // 기간이 끝나고 7일 지난 기수 음원은 새로 올릴 때 자동으로 지워요
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

// 관리자: 학생 한 명의 LC 음원 기간을 오늘부터 7일 다시 열어요.
export async function extendAudio(fd: FormData) {
  if (!(await isAdmin())) return;
  const id = clean(fd.get("id"));
  const d = new Date(Date.parse(`${todayKST()}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
  await updateApplication(id, { audio_extended_until: d });
  revalidatePath(`/admin/students/${id}`);
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

// ── YBM 인강생 교재 주문 (개념 zip, 택배만) ─────────
export async function createYbmOrderAction(_: FormState, fd: FormData): Promise<FormState> {
  const name = normName(clean(fd.get("name")));
  const phone = clean(fd.get("phone")).replace(/[^0-9]/g, "");
  const address = clean(fd.get("address"));
  const depositor = normName(clean(fd.get("depositor"))) || name;
  const proof = fd.get("proof");
  if (!/^[가-힣a-zA-Z ]{2,20}$/.test(name)) return { error: "이름을 한글 또는 영문으로 정확히 입력해 주세요." };
  if (!/^01[0-9]{8,9}$/.test(phone)) return { error: "연락처를 정확히 입력해 주세요. (예: 010-1234-5678)" };
  if (address.length < 10) return { error: "택배 받을 주소를 정확히 입력해 주세요." };
  if (!(proof instanceof File) || proof.size === 0) return { error: "인강 수강증 캡처 사진을 올려 주세요." };
  if (!fd.get("agree")) return { error: "개인정보 수집·이용에 동의해 주세요." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(proof.type)) return { error: "수강증은 사진(JPG·PNG) 파일로 올려 주세요." };
  if (proof.size > 4 * 1024 * 1024) return { error: "사진이 너무 커요. 다시 골라 주세요." };
  // 같은 이름·연락처로 아직 발송 전 주문이 있으면 새로 만들지 않고 그 주문으로 보내요.
  const existing = (await listYbmOrders()).find((o) => o.status !== "shipped" && o.name === name && o.phone === phone);
  if (existing) redirect(`/ybm/${existing.id}?again=1`);
  const id = await createYbmOrder({ name, phone, address, depositor, amount: YBM_ORDER_AMOUNT }, { data: Buffer.from(await proof.arrayBuffer()), type: proof.type });
  await linkWaitingDeposit({ kind: "ybm", id, depositor, amount: YBM_ORDER_AMOUNT }); // 주문보다 먼저 온 입금 연결
  revalidatePath("/admin/delivery");
  redirect(`/ybm/${id}`);
}

// 관리자: 인강 주문 입금 확인 (입금 문자 자동 확인이 안 됐을 때)
export async function confirmYbmPayments(fd: FormData) {
  if (!(await isAdmin())) return;
  const ids = fd.getAll("ids").map(clean).filter((v) => v.startsWith("ybm:")).map((v) => v.slice(4));
  const pending = (await listYbmOrders()).filter((o) => ids.includes(o.id) && o.status === "pending").map((o) => o.id);
  await updateYbmOrders(pending, { status: "paid", paid_at: new Date().toISOString() });
  revalidatePath("/admin/delivery");
}

// ── 공지 ───────────────────────────────────────
// 학생: [확인했어요] → 이번 기수 본인 신청 모두에 확인 기록 (다시 안 떠요)
export async function readNotice(fd: FormData) {
  const { apps } = await noticeIdentity();
  await markNoticeRead(clean(fd.get("id")), apps.map((a) => ({ id: a.id, cohort: a.cohort })));
  revalidatePath("/", "layout");
}

const COURSE_IDS = ["start", "solve", "intensive"] as const;
const TRACK_GROUPS = ["all", "alt", "rc", "lc"] as const;

// 관리자: 공지 저장 (새로 만들기 / 고치기). 섹션·대상은 편집 화면이 JSON으로 보내요.
export async function saveNoticeAction(fd: FormData) {
  if (!(await isAdmin())) return;
  const parse = <T,>(k: string): T[] => { try { const v = JSON.parse(String(fd.get(k) ?? "[]")); return Array.isArray(v) ? v : []; } catch { return []; } };
  const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const sections: NoticeSection[] = parse<NoticeSection>("sections_json")
    .map((x) => ({ icon: text(x.icon, 8) || "📌", title: text(x.title, 60), body: text(x.body, 1000), gray: !!x.gray }))
    .filter((x) => x.title || x.body)
    .slice(0, 12);
  const pick = <T extends string>(arr: unknown, allowed: readonly T[]) => (Array.isArray(arr) ? arr.filter((v): v is T => allowed.includes(v as T)) : []);
  const targets: NoticeTarget[] = parse<NoticeTarget>("targets_json").map((r) => ({
    courses: pick(r.courses, COURSE_IDS),
    tracks: pick(r.tracks, TRACK_GROUPS),
    kinds: pick(r.kinds, ["onsite", "online"] as const),
    slots: pick(r.slots, ["am", "pm"] as const),
  })).slice(0, 10);
  const title = clean(fd.get("title"));
  const starts_on = clean(fd.get("starts_on"));
  // 매달 반복 공지는 게시 종료일 대신 '개강일부터 n일'
  const repeat_monthly = !!fd.get("repeat_monthly");
  const repeat_days = repeat_monthly ? Math.min(31, Math.max(1, Number(clean(fd.get("repeat_days"))) || 7)) : null;
  const ends_on = repeat_monthly ? "2099-12-31" : clean(fd.get("ends_on"));
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(starts_on) || !/^\d{4}-\d{2}-\d{2}$/.test(ends_on) || ends_on < starts_on) return;
  const useStudy = !!fd.get("link_study");
  const linkUrl = clean(fd.get("link_url"));
  const fields = {
    title,
    to_label: clean(fd.get("to_label")),
    lead: String(fd.get("lead") ?? "").trim().slice(0, 600),
    sections,
    link_label: clean(fd.get("link_label")) || null,
    link_url: useStudy ? "@study" : /^https:\/\//.test(linkUrl) ? linkUrl : null,
    targets,
    starts_on,
    ends_on,
    popup: !!fd.get("popup"),
    pinned: !!fd.get("pinned"),
    repeat_monthly,
    repeat_days,
  };
  const id = clean(fd.get("id"));
  if (id) await updateNotice(id, fields);
  else await createNotice(fields);
  revalidatePath("/", "layout");
}

export async function deleteNoticeAction(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteNotice(clean(fd.get("id")));
  revalidatePath("/", "layout");
}

// ── 문풀반 데일리 테스트 ───────────────────────
// 학생: 결과 입력. 그날 23:59까지는 제출·수정, 같은 달 지난 테스트는 '밀린 테스트'로 한 번 제출. (늦게 낸 것은 저장만 하고 화면에 표시하지 않아요)
export async function submitTestResult(_: FormState, fd: FormData): Promise<FormState> {
  const appId = clean(fd.get("app_id"));
  const day = clean(fd.get("day"));
  const kind = clean(fd.get("kind")) as TestKind;
  const testNo = Number(clean(fd.get("test_no")));
  const score = Number(clean(fd.get("score")));
  const wrong = clean(fd.get("wrong")).split(",").filter(Boolean).map(Number).sort((a, b) => a - b);
  const today = todayKST();
  const { apps } = await activeStudentApps();
  const app = apps.find((a) => a.id === appId);
  if (!app || !takesTests(app)) return { error: "테스트를 볼 수 있는 수강 신청이 아니에요." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "아직 제출할 수 없는 테스트예요." };
  if (day.slice(0, 7) !== today.slice(0, 7)) return { error: "지난달 테스트는 제출할 수 없어요." };
  const { plan } = await planFor(app.cohort);
  const classDays = await classDaysOf(app);
  // 앞으로의 테스트는 다음 수업일 것만 미리 낼 수 있어요
  if (day > today && day !== earlyTestDay(classDays, today)) return { error: "아직 제출할 수 없는 테스트예요. 다음 수업일 테스트만 미리 낼 수 있어요." };
  // 같은 날 같은 종류를 2개 보는 날도 있어서 번호까지 맞춰 찾아요 (번호가 없으면 그날 첫 번째)
  const specs = testsForClassDay(plan, classDays, day).filter((t) => t.kind === kind);
  const spec = specs.find((t) => t.no === testNo) ?? (testNo ? undefined : specs[0]);
  if (!spec) return { error: "이 날짜에는 이 테스트가 없어요." };
  if (clean(fd.get("score")) === "") return { error: "맞은 개수를 적어 주세요." };
  const problem = checkTestAnswer(spec.questions, score, kind === "rc" ? wrong : []);
  if (problem) return { error: problem };
  const late = day < today;
  if (late && (await listTestResults({ appIds: [app.id] })).some((r) => r.day === day && r.kind === kind && r.test_no === spec.no)) {
    return { error: "지난 테스트는 한 번만 제출할 수 있어요." };
  }
  await saveTestResult({ app_id: app.id, cohort: app.cohort, day, kind, test_no: spec.no, questions: spec.questions, score, wrong: kind === "rc" ? wrong : [], late });
  revalidatePath("/class");
  revalidatePath("/class/tests");
  revalidatePath("/admin/tests");
  const [, m, dd] = day.split("-").map(Number);
  return { ok: late ? "저장했어요!" : day > today ? `미리 저장했어요! ${m}/${dd} 23:59까지 고칠 수 있어요.` : "저장했어요! 오늘 23:59까지 고칠 수 있어요." };
}

// 관리자: 두 개 보는 날 켜기/끄기 (그날 그 종류 2개, 이후 번호가 밀려요)
export async function setTestDoubleAction(fd: FormData) {
  if (!(await isAdmin())) return;
  const day = clean(fd.get("day"));
  const kind = clean(fd.get("kind"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || (kind !== "word" && kind !== "rc")) return;
  await setTestDouble({ day, kind }, clean(fd.get("on")) === "1");
  revalidatePath("/admin/tests");
  revalidatePath("/class");
  revalidatePath("/class/tests");
}

// 관리자: 특정 날짜 테스트 번호·문항 수 직접 고치기 / 자동 계산으로 되돌리기
export async function saveTestOverrideAction(fd: FormData) {
  if (!(await isAdmin())) return;
  const day = clean(fd.get("day"));
  const kind = clean(fd.get("kind"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || (kind !== "word" && kind !== "rc")) return;
  if (clean(fd.get("reset"))) {
    await deleteTestOverride(day, kind);
  } else {
    const none = clean(fd.get("none")) === "1";
    const no = Number(clean(fd.get("test_no")));
    const q = Number(clean(fd.get("questions")));
    if (!none && (!Number.isInteger(no) || no < 1 || no > 99 || !Number.isInteger(q) || q < 1 || q > 100)) return;
    await saveTestOverride({ day, kind, test_no: none ? null : no, questions: none ? null : q });
  }
  revalidatePath("/admin/tests");
  revalidatePath("/class");
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

// 카테고리 이름 바꾸기: 그 카테고리의 모든 질문을 한 번에 새 이름으로 옮겨요.
export async function renameFaqCategory(fd: FormData) {
  if (!(await isAdmin())) return;
  const from = clean(fd.get("from"));
  const to = clean(fd.get("to"));
  if (!from || !to || from === to) return;
  for (const f of (await listFaq()).filter((x) => x.category === from)) await updateFaq(f.id, { category: to });
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
  if (!specialRegistrationOpen(event)) return { error: "신청이 마감됐어요." };
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
  // 신청 마감 (한국 시간, 비우면 특강 전날 17:00)
  const deadline = clean(fd.get("registration_deadline"));
  if (!validDate(event_date) || !title || !validTime(starts_at)) return null;
  if (ends_at && (!validTime(ends_at) || ends_at <= starts_at)) return null;
  if (deadline && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline)) return null;
  // 자료 안내 문구: 줄바꿈 그대로 저장 (앞뒤 빈 줄만 정리)
  const material_note = String(fd.get("material_note") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 2000) || null;
  return { event_date, title, starts_at, ends_at: ends_at || null, registration_deadline: deadline ? new Date(`${deadline}:00+09:00`).toISOString() : null, material_note };
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
  if (applicationId.startsWith("ybm:")) {
    const id = applicationId.slice(4);
    const order = (await listYbmOrders()).find((o) => o.id === id);
    if (!order) return;
    if (order.status === "pending") await updateYbmOrders([id], { status: "paid", paid_at: new Date().toISOString() });
    await updateDepositEvent(eventId, { result: "resolved", ybm_order_id: id });
    revalidatePath("/admin/delivery");
  } else if (applicationId) {
    const [app] = await getApplications([applicationId]);
    if (app?.status === "pending") await updateApplications([app.id], { status: "paid" });
    await updateDepositEvent(eventId, { result: "resolved", application_id: applicationId });
  } else {
    await updateDepositEvent(eventId, { result: "dismissed" });
  }
  revalidatePath("/admin");
}

// 학생이 1층 데스크에서 교재를 받고 직접 '받았어요'를 눌러요. (본인 신청 · 불라방 데스크 수령 · 납부 완료만)
export async function confirmBookReceived(fd: FormData) {
  const id = clean(fd.get("id"));
  const { apps } = await activeStudentApps();
  const app = apps.find((a) => a.id === id);
  if (!app || app.kind !== "online" || app.pickup !== "classroom" || app.status !== "paid") return;
  await updateApplication(app.id, { status: "shipped" });
  revalidatePath(`/my/${app.id}`);
  revalidatePath("/class");
  revalidatePath("/admin/roster");
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

// 기수 변경 (개별·일괄): 교재를 새 기수 회차로 다시 계산. 결과는 돌아갈 화면 주소에 붙여 보여줘요.
async function moveCohorts(ids: string[], target: string, force = false) {
  const [apps, all] = await Promise.all([getApplications(ids), listApplications()]);
  const round = await roundFor(target);
  const moved: string[] = [], changed: string[] = [], errors: string[] = [];
  for (const a of apps) {
    const plan = planCohortMove(a, target, round, all, force);
    if (!plan.ok) { errors.push(plan.error); continue; }
    await updateApplication(a.id, plan.patch);
    moved.push(a.name);
    if (plan.amountChanged) changed.push(`${a.name}(${a.amount.toLocaleString("ko-KR")}→${plan.patch.amount.toLocaleString("ko-KR")}원)`);
  }
  revalidatePath("/admin", "layout");
  return { moved, changed, errors };
}

function backWith(fd: FormData, r: { moved: string[]; changed: string[]; errors: string[] }, target: string) {
  const back = clean(fd.get("back"));
  const url = new URL(back.startsWith("/admin") ? back : "/admin", "http://x");
  url.searchParams.set("mv", `${target}|${r.moved.length}|${r.changed.join(", ")}|${r.errors.join(" / ")}`);
  return `${url.pathname}?${url.searchParams}`;
}

export async function changeCohort(fd: FormData) {
  if (!(await isAdmin())) return;
  const target = clean(fd.get("cohort"));
  const r = await moveCohorts([clean(fd.get("id"))], target, clean(fd.get("force")) === "1");
  redirect(backWith(fd, r, target));
}

export async function bulkChangeCohort(fd: FormData) {
  if (!(await isAdmin())) return;
  const ids = checkedIds(fd);
  const target = clean(fd.get("cohort"));
  if (ids.length === 0) return;
  const r = await moveCohorts(ids, target, clean(fd.get("force")) === "1");
  redirect(backWith(fd, r, target));
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

// 관리자: 숙제 칸을 누를 때마다 [없음 → ⭐ 숙제 → 없음]. 늦은 숙제(✓)도 누르면 ⭐로 바뀌어요.
// 관리자가 붙인 ⭐는 제출 시각과 상관없이 별로 인정돼요 (그 수업일 시각으로 기록).
export async function cycleHomework(fd: FormData) {
  if (!(await isAdmin())) return;
  const id = clean(fd.get("id"));
  const day = clean(fd.get("day"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const rec = (await listStamps([id])).homework.find((x) => x.day === day);
  if (rec && isHomeworkStickerEligible(day, rec.created_at)) await deleteHomeworkSticker(id, day);
  else await setHomeworkStar(id, day);
  revalidatePath("/admin", "layout");
  revalidatePath("/class");
}

// 예전에 저장한 숙제 사진을 지난 기수 기준으로 정리해요.
export async function cleanupPhotos(): Promise<void> {
  if (!(await isAdmin())) return;
  await deletePhotosBefore(await classCohortNow()); // 모집 기수를 앞당겨도 지금 수업 중인 달 사진은 남아요
  revalidatePath("/admin/stamps");
}

// 관리자가 현황표에서 출석을 직접 보정해요.
export async function markAttendanceManual(fd: FormData) {
  if (!(await isAdmin())) return;
  const id = clean(fd.get("id"));
  const day = clean(fd.get("day"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const app = await getApplication(id);
  if (!app || !canWatch(app) || app.cohort !== (await classCohortNow())) return;
  await addAttendance(app.id, day);
  revalidatePath("/admin/stamps");
}

// 관리자 출결표: 칸을 누를 때마다 출석 → 지각 → 결석 → 출석 순서로 바꿔요.
export async function cycleAttendance(fd: FormData) {
  if (!(await isAdmin())) return;
  const id = clean(fd.get("id"));
  const day = clean(fd.get("day"));
  const rec = (await listStamps([id])).attendance.find((x) => x.day === day);
  const next = !rec ? "present" : rec.late ? "absent" : "late";
  await setAttendanceState(id, day, next);
  revalidatePath("/admin/stamps");
  revalidatePath("/class");
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
  const all = checkedIds(fd);
  if (all.length === 0) return;
  // "ybm:"로 시작하면 YBM 인강 주문, 나머지는 학원 불라방 신청이에요.
  const ybmIds = all.filter((v) => v.startsWith("ybm:")).map((v) => v.slice(4));
  const ids = all.filter((v) => !v.startsWith("ybm:"));
  if (ids.length > 0) {
    const apps = await getApplications(ids);
    const ready = apps.filter((app) => app.status === "paid" && app.kind === "online").map((app) => app.id);
    await updateApplications(ready, { status: "shipped" });
  }
  if (ybmIds.length > 0) {
    const ready = (await listYbmOrders()).filter((o) => ybmIds.includes(o.id) && o.status === "paid").map((o) => o.id);
    await updateYbmOrders(ready, { status: "shipped", shipped_at: new Date().toISOString() });
  }
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

// ── 스티커판 완성 선물 ───────────────────────────
// 학생: 🎁 선물 뽑기. 수업 기수 신청 중 선물 대상(격일반 제외)이고 스티커판 완성, 마지막 수업일 당일만.
// 학생 1명(같은 로그인)당 기수마다 1번. 이미 뽑았으면 같은 결과를 돌려줘요.
export async function drawMyGift(): Promise<{ draw?: GiftDraw; error?: string }> {
  const { apps } = await activeStudentApps();
  const { cohort, apps: mine } = await classAppsFor(apps.filter(canWatch));
  if (!cohort || mine.length === 0) return { error: "강의실에 로그인해 주세요." };
  const key = studentKeyOf(mine);
  const already = await getGiftDraw(cohort, key);
  if (already) return { draw: already };
  const today = todayKST();
  const done = (await boardsFor(mine, today)).find((b) => b.eligible && b.status.complete);
  if (!done) return { error: "스티커판을 완성하면 선물을 뽑을 수 있어요." };
  if (!giftWindowOpen(done.status.last, today)) return { error: "선물 뽑기는 마지막 수업일에만 할 수 있어요." };
  const draw = await drawGift({ cohort, student_key: key, app_id: done.app.id, name: done.app.name, klass: klassText(done.app), kind: kindText(done.app), code: giftCode() });
  revalidatePath("/admin/stamps");
  return { draw };
}

// 관리자: 선물 추가·수정 (수량을 비우면 무제한 기본 선물)
export async function saveGiftAction(fd: FormData) {
  if (!(await isAdmin())) return;
  const cohort = clean(fd.get("cohort"));
  const name = clean(fd.get("name")).slice(0, 60);
  const q = clean(fd.get("quantity"));
  if (!/^\d{4}-\d{2}$/.test(cohort) || !name) return;
  const quantity = q === "" ? null : Math.max(0, Math.floor(Number(q)) || 0);
  await saveGiftItem({ id: clean(fd.get("id")) || undefined, cohort, name, quantity });
  revalidatePath("/admin/stamps");
}

export async function deleteGiftAction(fd: FormData) {
  if (!(await isAdmin())) return;
  await deleteGiftItem(clean(fd.get("id")));
  revalidatePath("/admin/stamps");
}

// 관리자: 선물 보냄 체크 (개별·일괄). sent=0이면 되돌려요.
export async function markGiftSent(fd: FormData) {
  if (!(await isAdmin())) return;
  // 한 줄의 [보냄] 버튼이면 그 한 명만, 아니면 체크한 사람 모두
  const one = clean(fd.get("one"));
  const [id, sent] = one ? one.split("|") : ["", ""];
  if (one) await setGiftSent([id], sent !== "0");
  else await setGiftSent(checkedIds(fd), clean(fd.get("sent")) !== "0");
  revalidatePath("/admin/stamps");
  revalidatePath("/class");
}
