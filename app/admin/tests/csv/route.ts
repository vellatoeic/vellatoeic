import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { TIME_SLOTS, todayKST } from "@/lib/config";
import { SCHEDULE_CLASSES } from "@/lib/schedule";
import { cohortTestStats } from "@/lib/dailyTests";
import { csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

// 학생별 테스트 기록 CSV (평균·미제출·연속 하락 + 테스트별 점수)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse("관리자 로그인이 필요해요.", { status: 401 });
  const c = req.nextUrl.searchParams.get("c") ?? "";
  if (!/^\d{4}-\d{2}$/.test(c)) return new NextResponse("기수를 확인해 주세요.", { status: 400 });
  const { stats } = await cohortTestStats(c, todayKST());
  const columns = [...new Set(stats.flatMap((s) => s.results.map((r) => `${r.kind === "word" ? "단어" : "RC"} ${r.test_no}`)))].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  return csvResponse(`데일리테스트_${c}.csv`, [
    ["이름", "반", "시간", "단어 평균(%)", "RC 평균(%)", "미제출", "최근 3회 연속 하락", ...columns],
    ...stats.sort((a, b) => a.app.name.localeCompare(b.app.name, "ko")).map((s) => [
      s.app.name, SCHEDULE_CLASSES[s.klass], s.app.slot ? TIME_SLOTS[s.app.slot] : "", s.avg.word ?? "", s.avg.rc ?? "", s.missing, s.declining ? "예" : "",
      ...columns.map((col) => {
        const r = s.results.find((x) => `${x.kind === "word" ? "단어" : "RC"} ${x.test_no}` === col);
        return r ? `${r.score}/${r.questions}${r.late ? " 늦음" : ""}` : "";
      }),
    ]),
  ]);
}
