import { COURSES, TRACKS, TIME_SLOTS, KINDS } from "./config";
import { currentCohort, getSetting, listApplications, listDepositEvents, listReceiptChecks, listYbmOrders } from "./db";
import { specialRefundsDue } from "./specialRefunds";
import { classCohortNow } from "./classCohort";
import { visibleToAdmin } from "./cancellations";

// 수강 · YBM 인강 주문을 한 줄씩 (최신순). 특강은 [특강 관리]에서 따로 관리해요.
export type RecentItem = { id: string; at: string; type: "수강" | "인강"; name: string; detail: string; warn?: string; href: string };

const YBM = { pending: "입금 대기", paid: "발송 대기", shipped: "발송 완료", cancelled: "취소" } as const;

export async function recentApplications(limit = 300): Promise<RecentItem[]> {
  const [apps, ybm] = await Promise.all([listApplications(), listYbmOrders()]);
  const items: RecentItem[] = [
    ...apps.filter(visibleToAdmin).map((a) => ({
      id: a.id, at: a.created_at, type: "수강" as const, name: a.name,
      detail: `${COURSES[a.course].label} ${TRACKS[a.track]} · ${a.slot ? TIME_SLOTS[a.slot] : "시간 미정"} · ${KINDS[a.kind].short}`,
      warn: a.status === "pending" ? "미납" : a.status === "refunded" ? "환불" : a.status === "cancelled" ? "취소" : undefined,
      href: `/admin/students/${a.id}`,
    })),
    ...ybm.filter(visibleToAdmin).map((o) => ({
      id: o.id, at: o.created_at, type: "인강" as const, name: o.name,
      detail: `개념 zip · ${YBM[o.status]}`,
      warn: o.status === "pending" ? "입금 대기" : o.status === "cancelled" ? "취소" : undefined,
      href: "/admin/delivery?pick=ship&from=ybm",
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// 관리 화면 맨 위 "🔔 할 일"에 보여줄 숫자들
export async function adminAlerts() {
  const [apps, cohort, seenAt, events, ybm, recent, refunds] = await Promise.all([
    listApplications(), currentCohort(), getSetting("admin_seen_apps_at"), listDepositEvents(50), listYbmOrders(), recentApplications(), specialRefundsDue(),
  ]);
  // 처음 쓸 때(확인 기록 없음)는 최근 3일 신청만 새 신청으로 봐요
  const since = seenAt || new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const fresh = recent.filter((x) => x.at > since);
  const classNow = await classCohortNow();
  const waiting = apps.filter((a) => a.cohort === cohort && a.status === "pending").length;
  const checks = events.filter((e) => e.target === "book" && (e.result === "review" || e.result === "unmatched")).length;
  const delivery =
    apps.filter((a) => (a.cohort === cohort || a.cohort === classNow) && a.kind === "online" && a.pickup === "delivery" && a.status === "paid").length +
    ybm.filter((o) => o.status === "paid").length;
  // 불라방 현장 수령(데스크) 준비: 납부 완료 · 아직 안 받아 간 학생 (받아 가면 학생 [교재 받았어요] 또는 [불라방] 탭 [수령 완료])
  const desk = apps.filter((a) => (a.cohort === cohort || a.cohort === classNow) && a.kind === "online" && a.pickup === "classroom" && a.status === "paid").length;
  // 선생님 확인이 필요한 수강증 (취소·환불된 신청 제외)
  const byId = new Map(apps.map((a) => [a.id, a]));
  const receipts = (await listReceiptChecks("review").catch(() => [])).filter((c) => {
    const a = c.application_id ? byId.get(c.application_id) : undefined;
    return !!a && a.status !== "cancelled" && a.status !== "refunded";
  }).length;
  return { since, fresh, recent, waiting, checks, delivery, desk, refunds: refunds.length, receipts };
}
