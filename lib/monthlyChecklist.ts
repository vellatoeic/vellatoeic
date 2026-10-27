import "server-only";
import { todayKST } from "./config";
import { getSetting, listApplications, listAudios, listLectures, listSpecialLectures } from "./db";
import { holidaysOf } from "./classCalendar";
import { classCohortNow } from "./classCohort";
import { SCHEDULE_CLASSES, scheduleKey, schoolDaysFor, type ScheduleClass } from "./schedule";
import { shiftMonth } from "./signupMonths";

// ── 관리자 첫 화면 '📅 이번 달 할 일' 자동 점검 ──
// 상태: done(✅) / todo(⚠️ + 바로가기) / later(회색 '○일부터')
export type CheckItem = { key: string; title: string; state: "done" | "todo" | "later"; from?: string; detail?: string; href?: string; warn?: string; action?: "kick" | "schedule" };

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 그 기수 모든 반 중 가장 이른 첫 수업일
async function firstClassDay(cohort: string) {
  const days = (await Promise.all((Object.keys(SCHEDULE_CLASSES) as ScheduleClass[]).map(async (k) =>
    schoolDaysFor(await getSetting(scheduleKey(cohort, k)), cohort, k)))).flat().sort();
  return days[0] ?? `${cohort}-01`;
}

// 준비할 기수: 이번 달 개강 전이면 이번 달, 개강했으면 다음 달
export async function targetCohort(today = todayKST()) {
  const thisMonth = today.slice(0, 7);
  return today < (await firstClassDay(thisMonth)) ? thisMonth : shiftMonth(thisMonth, 1);
}

export async function monthlyChecklist(today = todayKST()): Promise<{ cohort: string; first: string; items: CheckItem[] }> {
  const cohort = await targetCohort(today);
  const first = await firstClassDay(cohort);
  const thisMonth = today.slice(0, 7);
  const running = await classCohortNow(today);
  const [audios, specials, lectures, apps, confirmed, holidays, kicked, codeChanged] = await Promise.all([
    listAudios(cohort), listSpecialLectures(), listLectures(), listApplications(),
    getSetting(`schedule_confirmed:${cohort}`), holidaysOf(cohort), getSetting(`chat_kicked:${running}`), getSetting("chat_code_changed_on"),
  ]);
  const mon = `${Number(cohort.slice(5, 7))}월`;
  const gate = (from: string, done: boolean, rest: Omit<CheckItem, "state" | "from">): CheckItem =>
    ({ ...rest, from, state: done ? "done" : today < from ? "later" : "todo" });

  const items: CheckItem[] = [];
  // 1. 다음 달 LC 음원 업로드 (첫 수업일 7일 전부터)
  items.push(gate(addDays(first, -7), audios.length > 0, { key: "audio", title: `${mon} LC 음원 올리기`, detail: audios.length ? `${audios.length}개 올림` : "아직 없어요", href: `/admin/audio?c=${cohort}` }));
  // 2. 다음 달 특강 등록 (전달 20일부터)
  const specialCount = specials.filter((e) => e.event_date.startsWith(cohort)).length;
  items.push(gate(`${shiftMonth(cohort, -1)}-20`, specialCount > 0, { key: "special", title: `${mon} 특강 등록`, detail: specialCount ? `${specialCount}개 등록` : "아직 없어요", href: "/admin/special" }));
  // 3. 다음 달 수업일 확인 ([수업일 설정] '확인' 버튼). 공휴일 있는 달은 빨간 강조
  const holidayNames = Object.entries(holidays).map(([d, n]) => `${md(d)} ${n}`);
  items.push({
    key: "schedule", title: `${mon} 수업일 확인`, state: confirmed === "1" ? "done" : "todo", href: `/admin/schedule?cohort=${cohort}`, action: "schedule",
    detail: confirmed === "1" ? "확인 완료" : "반별 수업일을 보고 [확인]을 눌러 주세요",
    warn: holidayNames.length ? `공휴일 ${holidayNames.length}일: ${holidayNames.join(", ")} — 수업일이 밀리는지 꼭 확인` : undefined,
  });
  // 4. 개강일 라이브 링크 (개강 전날부터, 오전·저녁 각각)
  const has = (slot: "am" | "pm") => lectures.some((l) => l.cohort === cohort && l.slot === slot);
  items.push(gate(addDays(first, -1), has("am") && has("pm"), { key: "live", title: `개강일(${md(first)}) 라이브 링크 등록`, detail: `오전 ${has("am") ? "✅" : "⚠️"} · 저녁 ${has("pm") ? "✅" : "⚠️"}`, href: "/admin/lectures" }));
  // 5·6. 개강 3일 전부터: 입금 대기 · 불라방 택배 미발송
  const mine = apps.filter((a) => a.cohort === cohort);
  const pending = mine.filter((a) => a.status === "pending").length;
  const unshipped = mine.filter((a) => a.kind === "online" && a.pickup === "delivery" && a.status === "paid").length;
  items.push(gate(addDays(first, -3), pending === 0, { key: "pending", title: `개강 전 입금 대기 ${pending}명`, href: `/admin?c=${cohort}&p=pending` }));
  items.push(gate(addDays(first, -3), unshipped === 0, { key: "delivery", title: `개강 전 불라방 택배 미발송 ${unshipped}명`, href: "/admin/delivery" }));
  // 7. 단톡방: 이번 달 환불 학생 내보내기 / 매달 1일 참여코드 바꾸기
  const refunded = apps.filter((a) => a.cohort === running && a.status === "refunded");
  const kickedIds = new Set(kicked.split(",").filter(Boolean));
  const toKick = refunded.filter((a) => !kickedIds.has(a.id));
  items.push({
    key: "kick", title: `단톡방: 이번 달 환불 학생 ${toKick.length}명 내보내기`, state: toKick.length === 0 ? "done" : "todo", action: "kick",
    detail: toKick.length ? toKick.map((a) => a.name).join(", ") : refunded.length ? "모두 내보냈어요" : "환불 학생 없음",
  });
  items.push({ key: "code", title: "단톡방 참여코드 바꾸기 (매달 1일)", state: codeChanged >= `${thisMonth}-01` ? "done" : "todo", detail: codeChanged ? `마지막 변경 ${md(codeChanged)}` : "기본 설정에서 바꿔요", href: "/admin#settings" });
  return { cohort, first, items };
}
