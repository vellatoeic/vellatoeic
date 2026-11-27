import "server-only";
import { cookies } from "next/headers";
import { getStudentProfiles, type StudentProfile, type Application } from "./db";
import { activeStudentApps } from "./student";
import { isViewOnly } from "./auth";
import { loginSetup } from "./socialServer";
import { ensureStudentNo } from "./studentNumbers";
import { numberForGroup } from "./mockScores";
import { profileDone, stepsLeft, type Step } from "./profile";
import { safe } from "./safe";
import { after } from "next/server";
import { recordSeen } from "./loginActivity";

// '카카오·구글 연결'을 '나중에' 누르면 7일 동안 그 단계를 건너뛰어요 (기기 쿠키)
export const LINK_LATER_COOKIE = "vella_link_later";

export type ProfileState = { apps: Application[]; no: string | null; profile: StudentProfile | null; steps: Step[]; done: boolean; viewOnly: boolean };

// 로그인한 학생의 '내 정보' 상태 (로그인 안 했거나 신청이 없으면 null)
export async function myProfileState(): Promise<ProfileState | null> {
  const { apps } = await activeStudentApps();
  if (apps.length === 0) return null;
  const viewOnly = await isViewOnly();
  const no = viewOnly ? numberForGroup(apps) : await safe("profile.studentNo", () => ensureStudentNo(apps), numberForGroup(apps));
  const profile = no ? (await safe("profile.get", () => getStudentProfiles([no]), [] as StudentProfile[]))[0] ?? null : null;
  const { providers } = await loginSetup();
  const later = (await cookies()).get(LINK_LATER_COOKIE)?.value === "1";
  const needLink = providers.length > 0 && !apps.some((a) => a.account_id) && !later && !viewOnly;
  const steps = stepsLeft(profile, needLink);
  // 학생 명단 '최근 접속': 하루에 한 번 적어요 (응답 뒤에, 보기 전용 제외)
  if (!viewOnly && no) after(() => safe("profile.seen", () => recordSeen(no, profile?.last_seen_at), undefined));
  return { apps, no, profile, steps, done: profileDone(profile), viewOnly };
}
