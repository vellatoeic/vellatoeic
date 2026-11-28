import "server-only";
import { randomUUID } from "crypto";
import { appsByAccount, getApplications, getLoginLink, getProspectByAccount, getSetting, linkAccount, saveLoginLink, setSetting, touchLoginLink } from "./db";
import { getStudentIds, isAdmin, setAccount, setAdmin, setPendingLink, setStudent } from "./auth";
import { isActive, loginApps } from "./access";
import { effectiveMode, isAdminLogin, isSignupNext, isSpecialNext, loginModeOf, parseAdminLogins, planLink, readyProviders, showPinLogin, showSocialLogin, withAdminLogin, type Provider } from "./socialLogin";
import type { Profile } from "./socialAuth";
import { recordLogin, recordProspectLogin } from "./loginActivity";
import { safe } from "./safe";

// 지금 학생 로그인 화면에 보여줄 것: 켜진 구글·카카오 버튼 + 이름·비밀번호 칸을 보여줄지
export async function loginSetup() {
  const ready = readyProviders();
  const mode = effectiveMode(loginModeOf(await getSetting("login_mode")), ready);
  return { mode, providers: showSocialLogin(mode) ? ready : ([] as Provider[]), pin: showPinLogin(mode) };
}

// 구글·카카오에서 돌아온 학생: 연결된 학생 번호가 있으면 그 신청으로 로그인, 없으면 '처음 한 번 연결' 화면으로.
// linkSession: 강의실 [연결하기]에서 왔으면 지금 로그인한 신청을 이 계정에 바로 연결해요 (이름·비밀번호를 다시 안 물어요).
// 돌아갈 주소를 돌려줘요.
export async function socialSignIn(p: Provider, prof: Profile, next: string, linkSession = false): Promise<string> {
  // 관리자로 등록된 계정이면 학생 버튼으로 눌러도 관리 화면으로
  if (isAdminLogin(await adminLogins(), p, prof.sub)) return adminSignIn(p, prof);
  const link = await getLoginLink(p, prof.sub);
  const pending = { p, sub: prof.sub, email: prof.email, nick: prof.nickname, photo: prof.photo ?? null };
  const session = !link && linkSession ? (await getApplications(await getStudentIds())).filter(isActive) : [];
  if (session.length > 0) {
    const plan = planLink(session, null, randomUUID);
    await linkAccount(plan.accountId, plan.attach, plan.merge);
    await saveLoginLink({ provider: p, subject: prof.sub, account_id: plan.accountId, email: prof.email, nickname: prof.nickname, photo_url: prof.photo ?? null });
    await setAccount(plan.accountId);
    const linked = (await appsByAccount(plan.accountId)).filter(isActive);
    await setStudent(linked.map((a) => a.id));
    await safe("recordLogin.link", () => recordLogin(linked, p), undefined);
    return next;
  }
  if (!link) {
    await setPendingLink(pending);
    // 특강 페이지에서 왔으면 그대로 특강 페이지로 (비수강생 신청서 · 예전 수강생은 거기서 '계정 연결하기')
    return isSpecialNext(next) ? next : `/login?next=${encodeURIComponent(next)}`;
  }
  await touchLoginLink(p, prof.sub, { email: prof.email, nickname: prof.nickname, photo_url: prof.photo ?? null });
  await setAccount(link.account_id);
  const r = loginApps(await appsByAccount(link.account_id), () => true);
  if (r.apps) {
    await setStudent(r.apps.map((a) => a.id));
    await safe("recordLogin.social", () => recordLogin(r.apps!, p), undefined);
    return next;
  }
  if (r.cancelledId) return `/my/${r.cancelledId}`; // 취소된 신청만 있으면 취소 안내 화면으로
  if (isSignupNext(next)) return next; // 신청서는 학생 번호만 있으면 돼요
  // 비수강생(특강으로 온 잠재 고객): 학생 번호로 로그인 → 특강 페이지·내 모의고사 성적 (/go가 알맞은 곳으로)
  const prospect = await safe("socialSignIn.prospect", () => getProspectByAccount(link.account_id), null);
  if (prospect || isSpecialNext(next)) {
    if (prospect) await safe("recordLogin.prospect", () => recordProspectLogin(prospect.student_no, p), undefined);
    return next;
  }
  // 연결은 됐는데 수강 신청이 없어요 → 예전 신청 찾기 또는 수강 신청 안내
  await setPendingLink({ ...pending, none: true });
  return `/login?next=${encodeURIComponent(next)}`;
}

// ── 관리자 구글·카카오 계정 (settings.admin_logins) ──
export async function adminLogins() {
  return parseAdminLogins(await getSetting("admin_logins"));
}

// 관리 화면 [구글 계정 추가]·[카카오 계정 추가]: 관리자 비밀번호로 들어온 상태에서만 등록돼요
export async function addAdminLogin(p: Provider, prof: Profile): Promise<string> {
  if (!(await isAdmin())) return "/admin";
  await setSetting("admin_logins", JSON.stringify(withAdminLogin(await adminLogins(), { p, sub: prof.sub, label: prof.email ?? prof.nickname, at: new Date().toISOString() })));
  return "/admin?al=added#login-mode";
}

// 관리자 로그인 화면의 카카오·구글 버튼: 등록된 계정이면 관리자 로그인
export async function adminSignIn(p: Provider, prof: Profile): Promise<string> {
  if (!isAdminLogin(await adminLogins(), p, prof.sub)) return "/admin?al=unknown";
  await setAdmin();
  return "/admin";
}
