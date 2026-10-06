import "server-only";
import { getStudentIds } from "./auth";
import { getApplications, listMissions, type Application, type Mission } from "./db";

export const MISSION_STEPS = ["intro_at", "cafe_at", "blog_at", "insta_at"] as const;
export type MissionStep = (typeof MISSION_STEPS)[number];

export function missionCount(m: Mission | null | undefined) {
  return m ? MISSION_STEPS.filter((k) => m[k]).length : 0;
}

// 이 신청의 미션 기록. 이번 달 기록이 없으면 같은 학생의 가장 최근 기록을 이어받아요(지난달에 한 미션은 다시 안 해도 돼요).
export function missionFor(appId: string, missions: Mission[]) {
  return missions.find((m) => m.app_id === appId)
    ?? [...missions].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    ?? null;
}

// 로그인한 학생의 미션 대상 신청(가장 최근 기수)과 현재 미션 기록
export async function studentMission(): Promise<{ app: Application; mission: Mission | null } | null> {
  const apps = await getApplications(await getStudentIds());
  if (apps.length === 0) return null;
  const app = [...apps].sort((a, b) => b.cohort.localeCompare(a.cohort) || b.created_at.localeCompare(a.created_at))[0];
  const missions = await listMissions(apps.map((a) => a.id));
  return { app, mission: missionFor(app.id, missions) };
}
