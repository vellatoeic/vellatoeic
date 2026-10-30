import "server-only";
import { DEPOSIT_MINUTES } from "./config";
import { deleteApplications, deleteYbmOrders, getSetting, listApplications, listYbmOrders, setSetting, updateApplications, updateYbmOrders, type Application, type YbmOrder } from "./db";

// ── 교재비 신청·인강 주문 30분 입금 규칙 ──
// 신청(또는 관리자가 되살린 시각)부터 30분 안에 입금 확인이 안 되면 자동 취소(timeout).
// 크론 없이 관리자 화면·학생 신청 화면·강의실을 열 때, 입금 문자가 오기 직전에 처리해요.
// ⚠️ 규칙을 켠 시각(settings deposit_timeout_from) 이후 신청만 적용해요. 그 전 신청은 절대 자동 취소하지 않아요.

const MIN = 60 * 1000;
export const TIMEOUT_MS = DEPOSIT_MINUTES * MIN;
export const PURGE_DAYS = 7; // 자동 취소 후 7일 지나면 지워요
export const REVIVE_HOURS = 24; // 자동 취소 후 24시간 안 늦은 입금은 되살려요

type Pend = Pick<Application, "status" | "created_at" | "pending_from"> | Pick<YbmOrder, "status" | "created_at" | "pending_from">;

// 30분 타이머 시작 시각
export const timerStart = (x: Pick<Application, "created_at" | "pending_from">) => x.pending_from || x.created_at;

// 규칙 대상이면 입금 마감 시각, 아니면 null (규칙 켜기 전 신청)
export function depositDeadline(x: Pend, ruleFrom: string): string | null {
  if (x.status !== "pending" || !ruleFrom) return null;
  const start = timerStart(x);
  if (start < ruleFrom) return null;
  return new Date(Date.parse(start) + TIMEOUT_MS).toISOString();
}

// 규칙을 켠 시각 (처음 실행할 때 지금으로 정해요)
export async function ruleFrom(nowMs = Date.now()) {
  const v = await getSetting("deposit_timeout_from");
  if (v) return v;
  const now = new Date(nowMs).toISOString();
  await setSetting("deposit_timeout_from", now);
  return now;
}

// 30분 지난 입금 대기 → 자동 취소 (교재비 신청 + 인강 주문)
export async function expireUnpaid(nowMs = Date.now()) {
  const from = await ruleFrom(nowMs);
  const now = new Date(nowMs).toISOString();
  const late = (x: Pend) => { const d = depositDeadline(x, from); return !!d && d <= now; };
  // '확인 필요'(후보 여러 명) 입금의 후보는 관리자가 처리할 때까지 자동 취소하지 않아요
  const { reviewHolds } = await import("./deposits");
  const [apps, orders, holds] = await Promise.all([listApplications(), listYbmOrders(), reviewHolds()]);
  const a = apps.filter((x) => late(x) && !holds.apps.has(x.id)).map((x) => x.id);
  const o = orders.filter((x) => late(x) && !holds.orders.has(x.id)).map((x) => x.id);
  if (a.length) await updateApplications(a, { status: "cancelled", cancelled_at: now, cancel_reason: "timeout" });
  if (o.length) await updateYbmOrders(o, { status: "cancelled", cancelled_at: now, cancel_reason: "timeout" });
  return { apps: a.length, orders: o.length };
}

// 자동 취소(timeout) 후 7일 지난 것은 지워요. 입금 기록은 남고 연결만 풀려요.
export async function purgeTimedOut(nowMs = Date.now()) {
  const cutoff = new Date(nowMs - PURGE_DAYS * 86400000).toISOString();
  const old = (x: { status: string; cancel_reason?: string | null; cancelled_at?: string | null }) =>
    x.status === "cancelled" && x.cancel_reason === "timeout" && !!x.cancelled_at && x.cancelled_at < cutoff;
  const [apps, orders] = await Promise.all([listApplications(), listYbmOrders()]);
  await deleteApplications(apps.filter(old).map((x) => x.id));
  await deleteYbmOrders(orders.filter(old).map((x) => x.id));
}

// 관리자 화면에 보여도 되는지: 자동 취소(timeout)는 어디에도 안 보여요. 관리자 취소(admin)는 '취소' 필터에서만.
export const visibleToAdmin = (x: { status: string; cancel_reason?: string | null }) => !(x.status === "cancelled" && x.cancel_reason === "timeout");

// 자동 취소 후 24시간 안인지 (늦은 입금 되살리기 대상)
export const revivable = (x: { status: string; cancel_reason?: string | null; cancelled_at?: string | null }, nowMs = Date.now()) =>
  x.status === "cancelled" && x.cancel_reason === "timeout" && !!x.cancelled_at && Date.parse(x.cancelled_at) >= nowMs - REVIVE_HOURS * 3600 * 1000;
