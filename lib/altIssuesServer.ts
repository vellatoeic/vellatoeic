import "server-only";
import { todayKST } from "./config";
import { getSetting, listApplications } from "./db";
import { altIssues } from "./altContinue";
import { shiftMonth } from "./signupMonths";

// 이번 달·다음 달 격일반 신청 점검 (동명이인으로 [무시]한 신청은 settings alt_ignore)
export async function currentAltIssues(today = todayKST()) {
  const month = today.slice(0, 7);
  const [all, ignore] = await Promise.all([listApplications(), getSetting("alt_ignore")]);
  return altIssues(all, [month, shiftMonth(month, 1)], new Set(ignore.split(",").filter(Boolean)));
}
