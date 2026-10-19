import { todayKST } from "./config";
import { listApplications, listSpecialLectures, listSpecialRegistrations, type SpecialLecture, type SpecialRegistration } from "./db";

// 수강 환불된 학생이 아직 열리지 않은 특강에 보증금을 내 둔 경우 → 관리자가 보증금을 돌려줘야 해요.
// (이미 지난 특강은 현장에서 돌려받았으니 빼요)
export type RefundDue = { registration: SpecialRegistration; event: SpecialLecture };

export async function specialRefundsDue(): Promise<RefundDue[]> {
  const today = todayKST();
  const [apps, events, regs] = await Promise.all([listApplications(), listSpecialLectures(), listSpecialRegistrations()]);
  const refunded = new Set(apps.filter((a) => a.status === "refunded").map((a) => a.id));
  const eventById = new Map(events.map((e) => [e.id, e]));
  return regs
    .filter((r) => r.mode === "onsite" && r.deposit === "paid" && !r.deposit_refunded_at && r.application_id && refunded.has(r.application_id))
    .map((r) => ({ registration: r, event: eventById.get(r.special_lecture_id)! }))
    .filter((x) => x.event && x.event.event_date >= today)
    .sort((a, b) => b.registration.created_at.localeCompare(a.registration.created_at));
}
