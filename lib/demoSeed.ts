import "server-only";
import { todayKST } from "./config";
import { hashPin } from "./auth";
import {
  addAttendance, addHomeworkSticker, addLecture, createApplication, createAudioLink, createSpecialLecture, getApplication,
  isPreview, saveMission, saveTestResult, updateApplication,
} from "./db";
import { classDaysOf } from "./classCalendar";
import { planFor } from "./dailyTests";
import { shiftMonth } from "./signupMonths";

// ── 화면 확인용 예시 데이터 (DB 연결이 없는 미리보기 모드 + 환경변수 VELLA_DEMO=1 일 때만) ──
// 실제 DB가 연결되면(isPreview=false) 절대 아무것도 하지 않아요.
// 예시 학생: 박지은 (비밀번호 1234, 이번 달 문풀반 종합 저녁 · 불라방 택배) / 이서윤 (1234, 다음 달 시작반 격일 화목 오전 · 현장)
// 최민재·정하린 (다음 달 불라방 현장 수령: 준비 · 미납)
// 관리자 미리보기 비밀번호: vella
const g = globalThis as unknown as { __vellaDemo?: Promise<void> };

export function ensureDemo() {
  if (!isPreview || process.env.VELLA_DEMO !== "1") return Promise.resolve();
  return (g.__vellaDemo ??= seed());
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function seed() {
  const today = todayKST();
  const cohort = today.slice(0, 7);
  const next = shiftMonth(cohort, 1);

  // 박지은: 이번 달 문풀반 종합 저녁 (개강 전에 신청·납부)
  const a = await createApplication({
    cohort, kind: "online", course: "solve", track: "all", continuing: false, slot: "pm", pickup_date: null, pickup_time: null,
    books: ["solve_rc1", "lc1"], pickup: "delivery", name: "박지은", phone: "01012345678", depositor: "박지은", address: "부산 해운대구 (예시)", amount: 24000, pin_hash: hashPin("1234"),
  });
  await updateApplication(a, { status: "paid" });
  const appA = (await getApplication(a))!;
  appA.created_at = `${shiftMonth(cohort, -1)}-25T03:00:00Z`;
  appA.paid_at = `${shiftMonth(cohort, -1)}-25T03:10:00Z`;
  const days = await classDaysOf(appA);
  const past = days.filter((d) => d < today);
  for (const [i, d] of past.entries()) {
    if (i % 6 !== 4) await addAttendance(a, d); // 한두 번 결석
    if (i % 5 !== 3) await addHomeworkSticker(a, d, `${d}T13:00:00Z`);
  }
  // 데일리 테스트 몇 개 (지난 수업일)
  const { plan } = await planFor(cohort);
  for (const d of past.slice(-6, -1)) {
    for (const spec of plan.get(d) ?? []) {
      await saveTestResult({ app_id: a, cohort, day: d, kind: spec.kind, test_no: spec.no, questions: spec.questions, score: Math.max(0, spec.questions - 3), wrong: [3, 7, 12], late: false });
    }
  }
  await saveMission({ app_id: a, prev_score: "620", target_score: "750", exam_month: next, affiliation: null, instagram: null, message: null, intro_at: new Date().toISOString(), cafe_at: new Date().toISOString(), blog_at: null, insta_at: null });
  await addLecture({ cohort, course: "solve", part: "lc", slot: "pm", title: `${Number(cohort.slice(5))}월 문풀반 LC (예시)`, youtube_id: "M7lc1UVf-VE" });
  await addLecture({ cohort, course: "solve", part: "rc", slot: "pm", title: `${Number(cohort.slice(5))}월 문풀반 RC (예시)`, youtube_id: "M7lc1UVf-VE" });
  await createAudioLink({ cohort, book: "lc1", title: "LC 1 · 01회 수업 (예시)", sort_order: 1, link_url: "https://example.com/lc1-01" });
  await createAudioLink({ cohort, book: "lc1", title: "LC 1 · 02회 수업 (예시)", sort_order: 2, link_url: "https://example.com/lc1-02" });
  // 다가오는 특강 (마감 전)
  const special = addDays(today, 3);
  if (special.startsWith(cohort)) {
    await createSpecialLecture({ event_date: special, title: "적중 모의고사 + 풀이 (예시)", starts_at: "10:00", ends_at: null, registration_deadline: null, published: true });
  }

  // 이서윤: 다음 달 시작반 격일 화목 오전 (개강 전)
  const b = await createApplication({
    cohort: next, kind: "onsite", course: "start", track: "alt_tt", continuing: false, slot: "am", pickup_date: null, pickup_time: null,
    books: ["concept", "start_rc", "lc2"], pickup: "classroom", name: "이서윤", phone: null, depositor: "이서윤", address: null, amount: 30000, pin_hash: hashPin("1234"),
  });
  await updateApplication(b, { status: "paid" });

  // 불라방 현장 수령(데스크) 예시: 최민재(납부 완료 · 준비) / 정하린(미납)
  const c = await createApplication({
    cohort: next, kind: "online", course: "solve", track: "all", continuing: false, slot: "pm", pickup_date: `${next}-01`, pickup_time: "18:30",
    books: ["solve_rc2", "lc2"], pickup: "classroom", name: "최민재", phone: "01023456789", depositor: "최민재", address: null, amount: 20000, pin_hash: hashPin("1234"),
  });
  await updateApplication(c, { status: "paid" });
  await createApplication({
    cohort: next, kind: "online", course: "start", track: "all", continuing: false, slot: "am", pickup_date: `${next}-02`, pickup_time: "10:00",
    books: ["concept", "start_rc", "lc2"], pickup: "classroom", name: "정하린", phone: "01034567890", depositor: "정하린", address: null, amount: 30000, pin_hash: hashPin("1234"),
  });
}
