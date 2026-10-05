import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSpecialLecture, listSpecialRegistrations } from "@/lib/db";
import { csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

// 특강별 신청 명단 CSV (현장 먼저, 그다음 불라방)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse("관리자 로그인이 필요해요.", { status: 401 });
  const event = await getSpecialLecture(req.nextUrl.searchParams.get("id") ?? "");
  if (!event) return new NextResponse("특강을 찾을 수 없어요.", { status: 404 });
  const registrations = (await listSpecialRegistrations(event.id))
    .sort((a, b) => Number(a.mode === "online") - Number(b.mode === "online") || a.name.localeCompare(b.name, "ko"));
  return csvResponse(`특강명단_${event.event_date}.csv`, [
    ["참여 방법", "이름", "신청 시각"],
    ...registrations.map((r) => [
      r.mode === "onsite" ? "현장" : "불라방",
      r.name,
      new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    ]),
  ]);
}
