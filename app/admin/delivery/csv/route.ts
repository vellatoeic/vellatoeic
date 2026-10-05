import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { currentCohort, listApplications } from "@/lib/db";
import { BOOKS, STATUS_LABEL, klassLabel } from "@/lib/config";
import { csvResponse, phoneLabel } from "@/lib/csv";

export const dynamic = "force-dynamic";

// 현재 모집 기수 불라방 택배 명단 CSV
export async function GET() {
  if (!(await isAdmin())) return new NextResponse("관리자 로그인이 필요해요.", { status: 401 });
  const cohort = await currentCohort();
  const apps = (await listApplications())
    .filter((a) => a.cohort === cohort && a.kind === "online" && a.pickup === "delivery")
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return csvResponse(`택배명단_${cohort}.csv`, [
    ["이름", "수강반", "연락처", "주소", "교재", "상태"],
    ...apps.map((a) => [a.name, klassLabel(a), phoneLabel(a.phone), a.address, a.books.map((b) => BOOKS[b]).join(", "), STATUS_LABEL[a.status]]),
  ]);
}
