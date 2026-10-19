import { COURSES, TRACKS, TIME_SLOTS, KINDS } from "./config";
import { currentCohort, getSetting, listApplications, listDepositEvents, listSpecialLectures, listSpecialRegistrations, listYbmOrders } from "./db";
import { specialDay } from "./special";
import { specialRefundsDue } from "./specialRefunds";

// 수강 · 특강 · YBM 인강 주문을 한 줄씩 (최신순)
export type RecentItem = { id: string; at: string; type: "수강" | "특강" | "인강"; name: string; detail: string; warn?: string; href: string };

const DEPOSIT = { pending: "보증금 대기", review: "입금 확인 중", paid: "보증금 확정", cancelled: "취소" } as const;
const YBM = { pending: "입금 대기", paid: "발송 대기", shipped: "발송 완료" } as const;

export async function recentApplications(limit = 300): Promise<RecentItem[]> {
  const [apps, regs, events, ybm] = await Promise.all([listApplications(), listSpecialRegistrations(), listSpecialLectures(), listYbmOrders()]);
  const eventById = new Map(events.map((e) => [e.id, e]));
  const items: RecentItem[] = [
    ...apps.map((a) => ({
      id: a.id, at: a.created_at, type: "수강" as const, name: a.name,
      detail: `${COURSES[a.course].label} ${TRACKS[a.track]} · ${a.slot ? TIME_SLOTS[a.slot] : "시간 미정"} · ${KINDS[a.kind].short}`,
      warn: a.status === "pending" ? "미납" : a.status === "refunded" ? "환불" : undefined,
      href: `/admin?c=${a.cohort}&q=${encodeURIComponent(a.name)}`,
    })),
    ...regs.map((r) => {
      const e = eventById.get(r.special_lecture_id);
      return {
        id: r.id, at: r.created_at, type: "특강" as const, name: r.name,
        detail: `${e ? `${specialDay(e.event_date)} ${e.title}` : "특강"} · ${r.mode === "onsite" ? `현장 · ${DEPOSIT[r.deposit ?? "pending"]}` : "불라방"}`,
        warn: r.mode === "onsite" && (r.deposit === "pending" || r.deposit === "review") ? "보증금 대기" : undefined,
        href: "/admin/special",
      };
    }),
    ...ybm.map((o) => ({
      id: o.id, at: o.created_at, type: "인강" as const, name: o.name,
      detail: `개념 zip · ${YBM[o.status]}`,
      warn: o.status === "pending" ? "입금 대기" : undefined,
      href: "/admin/delivery?from=ybm",
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
  const waiting = apps.filter((a) => a.cohort === cohort && a.status === "pending").length;
  const checks = events.filter((e) => e.target === "book" && (e.result === "review" || e.result === "unmatched")).length;
  const delivery =
    apps.filter((a) => a.cohort === cohort && a.kind === "online" && a.pickup === "delivery" && a.status === "paid").length +
    ybm.filter((o) => o.status === "paid").length;
  return { since, fresh, recent, waiting, checks, delivery, refunds: refunds.length };
}
