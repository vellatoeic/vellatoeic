import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { currentCohort, listApplications, listYbmOrders } from "@/lib/db";
import { BOOKS, STATUS_LABEL, klassLabel } from "@/lib/config";
import { csvResponse, phoneLabel } from "@/lib/csv";
import { classCohortNow } from "@/lib/classCohort";
import { isActive } from "@/lib/access";

export const dynamic = "force-dynamic";

// 현재 모집 기수 불라방 택배 명단 CSV
export async function GET(req: Request) {
  const from = new URL(req.url).searchParams.get("from");
  if (!(await isAdmin())) return new NextResponse("관리자 로그인이 필요해요.", { status: 401 });
  const cohort = await currentCohort();
  // 모집 기수 + 지금 수업 중인 기수 (모집 기수를 바꿔도 이번 달 택배가 빠지지 않게)
  const cohorts = new Set([cohort, await classCohortNow()]);
  const apps = (await listApplications())
    .filter((a) => cohorts.has(a.cohort) && a.kind === "online" && a.pickup === "delivery" && isActive(a));
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const ybm = (await listYbmOrders()).filter((o) => o.status !== "cancelled").filter((o) => o.status !== "shipped" || (o.shipped_at ?? o.created_at) > since);
  const day = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const YBM_STATUS = { pending: "미납", paid: "발송 대기", shipped: "발송 완료" };
  // 학원·인강을 합쳐 최신 신청이 맨 위
  const rows = [
    ...(from === "ybm" ? [] : apps.map((a) => ({ at: a.created_at, cells: [day(a.created_at), a.name, klassLabel(a), phoneLabel(a.phone), a.address, a.books.map((b) => BOOKS[b]).join(", "), STATUS_LABEL[a.status]] }))),
    ...(from === "academy" ? [] : ybm.map((o) => ({ at: o.created_at, cells: [day(o.created_at), o.name, "YBM 인강", phoneLabel(o.phone), o.address, "개념 zip", YBM_STATUS[o.status as "pending" | "paid" | "shipped"]] }))),
  ].sort((x, y) => y.at.localeCompare(x.at));
  return csvResponse(`택배명단_${cohort}${from === "ybm" ? "_YBM" : from === "academy" ? "_학원" : ""}.csv`, [
    ["신청일", "이름", "수강반", "연락처", "주소", "교재", "상태"],
    ...rows.map((r) => r.cells),
  ]);
}
