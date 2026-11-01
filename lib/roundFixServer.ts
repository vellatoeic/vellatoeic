import "server-only";
import { thisMonthKST } from "./config";
import { getSetting, listApplications, setSetting, updateApplication } from "./db";
import { fixRounds } from "./roundRecalc";
import { shiftMonth } from "./signupMonths";

// 배포 후 관리자 첫 화면을 처음 열 때 한 번만: 이번 달·다음 달 신청 교재를 자동 회차로 바로잡아요.
// (교재 조정·취소·환불 제외, 입금 대기만 새 금액, 납부 완료는 금액 유지하고 차이만)
export async function fixRoundsOnce(): Promise<{ count: number; diffs: string } | null> {
  if (await getSetting("fix_round_done")) return null;
  await setSetting("fix_round_done", new Date().toISOString()); // 먼저 표시해서 두 번 돌지 않게
  const month = thisMonthKST();
  const changes = fixRounds(await listApplications(), [month, shiftMonth(month, 1)]);
  for (const c of changes) await updateApplication(c.app.id, { books: c.books, amount: c.amount });
  const diffs = changes.filter((c) => c.app.status !== "pending" && c.diff !== 0).map((c) => `${c.app.name}(${c.diff > 0 ? "+" : ""}${c.diff.toLocaleString("ko-KR")}원)`).join(", ");
  return { count: changes.length, diffs };
}
