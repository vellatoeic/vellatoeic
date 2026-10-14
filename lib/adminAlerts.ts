import { currentCohort, getSetting, listApplications, listDepositEvents, listYbmOrders } from "./db";

// 관리 화면 맨 위 "🔔 할 일"에 보여줄 숫자들
export async function adminAlerts() {
  const [apps, cohort, seenAt, events, ybm] = await Promise.all([listApplications(), currentCohort(), getSetting("admin_seen_apps_at"), listDepositEvents(50), listYbmOrders()]);
  // 처음 쓸 때(확인 기록 없음)는 최근 3일 신청만 새 신청으로 봐요
  const since = seenAt || new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const fresh = apps.filter((a) => a.created_at > since && a.status !== "refunded").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const waiting = apps.filter((a) => a.cohort === cohort && a.status === "pending").length;
  const checks = events.filter((e) => e.target === "book" && (e.result === "review" || e.result === "unmatched")).length;
  const delivery =
    apps.filter((a) => a.cohort === cohort && a.kind === "online" && a.pickup === "delivery" && a.status === "paid").length +
    ybm.filter((o) => o.status === "paid").length;
  return { since, fresh, waiting, checks, delivery };
}
