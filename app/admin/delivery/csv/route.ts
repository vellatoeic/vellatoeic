import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { currentCohort, listApplications, listYbmOrders } from "@/lib/db";
import { BOOKS, STATUS_LABEL, klassLabel } from "@/lib/config";
import { csvResponse, phoneLabel } from "@/lib/csv";

export const dynamic = "force-dynamic";

// 현재 모집 기수 불라방 택배 명단 CSV
export async function GET(req: Request) {
  const from = new URL(req.url).searchParams.get("from");
  if (!(await isAdmin())) return new NextResponse("관리자 로그인이 필요해요.", { status: 401 });
  const cohort = await currentCohort();
  const apps = (await listApplications())
    .filter((a) => a.cohort === cohort && a.kind === "online" && a.pickup === "delivery" && a.status !== "refunded")
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const ybm = (await listYbmOrders()).filter((o) => o.status !== "shipped" || (o.shipped_at ?? o.created_at) > since);
  const YBM_STATUS = { pending: "미납", paid: "발송 대기", shipped: "발송 완료" };
  return csvResponse(`택배명단_${cohort}${from === "ybm" ? "_YBM" : from === "academy" ? "_학원" : ""}.csv`, [
    ["이름", "수강반", "연락처", "주소", "교재", "상태"],
    ...(from === "ybm" ? [] : apps.map((a) => [a.name, klassLabel(a), phoneLabel(a.phone), a.address, a.books.map((b) => BOOKS[b]).join(", "), STATUS_LABEL[a.status]])),
    ...(from === "academy" ? [] : ybm.map((o) => [o.name, "YBM 인강", phoneLabel(o.phone), o.address, "개념 zip", YBM_STATUS[o.status]])),
  ]);
}
