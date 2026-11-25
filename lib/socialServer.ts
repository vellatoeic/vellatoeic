import "server-only";
import { randomUUID } from "crypto";
import { appsByAccount, getApplications, getLoginLink, getSetting, linkAccount, saveLoginLink, touchLoginLink } from "./db";
import { getStudentIds, setAccount, setPendingLink, setStudent } from "./auth";
import { isActive, loginApps } from "./access";
import { effectiveMode, isSignupNext, loginModeOf, planLink, readyProviders, showPinLogin, showSocialLogin, type Provider } from "./socialLogin";
import type { Profile } from "./socialAuth";

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
  const link = await getLoginLink(p, prof.sub);
  const pending = { p, sub: prof.sub, email: prof.email, nick: prof.nickname };
  const session = !link && linkSession ? (await getApplications(await getStudentIds())).filter(isActive) : [];
  if (session.length > 0) {
    const plan = planLink(session, null, randomUUID);
    await linkAccount(plan.accountId, plan.attach, plan.merge);
    await saveLoginLink({ provider: p, subject: prof.sub, account_id: plan.accountId, email: prof.email, nickname: prof.nickname });
    await setAccount(plan.accountId);
    await setStudent((await appsByAccount(plan.accountId)).filter(isActive).map((a) => a.id));
    return next;
  }
  if (!link) {
    await setPendingLink(pending);
    return `/login?next=${encodeURIComponent(next)}`;
  }
  await touchLoginLink(p, prof.sub, { email: prof.email, nickname: prof.nickname });
  await setAccount(link.account_id);
  const r = loginApps(await appsByAccount(link.account_id), () => true);
  if (r.apps) {
    await setStudent(r.apps.map((a) => a.id));
    return next;
  }
  if (r.cancelledId) return `/my/${r.cancelledId}`; // 취소된 신청만 있으면 취소 안내 화면으로
  if (isSignupNext(next)) return next; // 신청서는 학생 번호만 있으면 돼요
  // 연결은 됐는데 수강 신청이 없어요 → 예전 신청 찾기 또는 수강 신청 안내
  await setPendingLink({ ...pending, none: true });
  return `/login?next=${encodeURIComponent(next)}`;
}
