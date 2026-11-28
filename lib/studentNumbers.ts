import "server-only";
import { appsByStudentNos, listApplications, prospectsByNos, reserveStudentNo, updateApplications, type Application } from "./db";
import { isActive } from "./access";
import { isStudentNo, numberForGroup } from "./mockScores";

// ── 개인번호 6자리 채우기 (SQL 43) ──
// 새 신청은 교재 신청할 때 번호를 받아요(app/actions.ts submitApplication). 여기서는 번호가 비어 있는 학생에게만 채워요.

// 로그인한 학생 한 명의 신청들(같은 로그인 = 같은 학생): 번호가 하나도 없으면 새로 받고, 비어 있는 신청에 같은 번호를 넣어요.
export async function ensureStudentNo(apps: Pick<Application, "id" | "student_no" | "created_at">[]): Promise<string | null> {
  if (apps.length === 0) return null;
  const no = numberForGroup(apps) ?? (await reserveStudentNo());
  const missing = apps.filter((a) => !isStudentNo(a.student_no)).map((a) => a.id);
  if (missing.length > 0) {
    await updateApplications(missing, { student_no: no });
    for (const a of apps) if (!isStudentNo(a.student_no)) a.student_no = no;
  }
  return no;
}

// 개인번호 → 그 번호 학생의 이름들 (수강 신청서 이름 + 특강으로 온 비수강생 이름, 모의고사 결과 연결용)
export async function namesByStudentNo(nos: string[]): Promise<Map<string, string[]>> {
  const [apps, guests] = await Promise.all([appsByStudentNos(nos), prospectsByNos(nos).catch(() => [])]);
  const out = new Map<string, string[]>();
  for (const x of [...apps, ...guests]) if (x.student_no) out.set(x.student_no, [...(out.get(x.student_no) ?? []), x.name]);
  return out;
}

// 관리 화면을 열 때: 이번 모집 기수부터(이번·다음 달 신청) 번호가 없는 학생에게 채워요.
// 같은 카카오·구글 계정(account_id)의 신청은 같은 번호. 이름+비밀번호 학생은 비밀번호를 비교할 수 없어서 신청마다 따로예요
// (같은 달에 같은 이름·비밀번호 신청은 하나뿐이고, 다음 달 신청은 교재 신청 때 같은 번호를 이어받아요).
export async function fillStudentNumbers(fromCohort: string): Promise<number> {
  const all = await listApplications();
  const targets = all.filter((a) => a.cohort >= fromCohort && isActive(a) && !isStudentNo(a.student_no));
  if (targets.length === 0) return 0;
  let filled = 0;
  const done = new Set<string>();
  for (const a of targets) {
    if (done.has(a.id)) continue;
    const group = a.account_id ? all.filter((x) => x.account_id === a.account_id) : [a];
    await ensureStudentNo(group);
    for (const x of group) done.add(x.id);
    filled += group.filter((x) => targets.some((t) => t.id === x.id)).length;
  }
  return filled;
}
