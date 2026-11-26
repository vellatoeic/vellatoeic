import CloseOnSubmitForm from "./CloseOnSubmitForm";
import { removeAdminLogin, saveLoginMode } from "@/app/actions";
import { adminLogins } from "@/lib/socialServer";
import SocialButtons from "@/components/SocialButtons";
import AdminAddedNotice from "./AdminAddedNotice";
import { getSetting, listCohortApplications } from "@/lib/db";
import { isActive } from "@/lib/access";
import { cohortLabel, thisMonthKST } from "@/lib/config";
import { shiftMonth } from "@/lib/signupMonths";
import { LOGIN_MODES, PROVIDERS, PROVIDER_LABEL, effectiveMode, loginModeOf, providerReady, readyProviders } from "@/lib/socialLogin";

const KEY_NAME = { google: "GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET", kakao: "KAKAO_REST_API_KEY" } as const;

// 관리 첫 화면 '학생 로그인 방식': 이름+비밀번호만 / 둘 다 / 구글·카카오만 + 이번 달·다음 달 연결한 학생 수
export default async function LoginModeCard() {
  const saved = loginModeOf(await getSetting("login_mode"));
  const admins = await adminLogins();
  const ready = readyProviders();
  const mode = effectiveMode(saved, ready);
  const month = thisMonthKST();
  const stats = await Promise.all([month, shiftMonth(month, 1)].map(async (c) => {
    const apps = (await listCohortApplications(c)).filter(isActive);
    return { c, total: apps.length, linked: apps.filter((a) => a.account_id).length };
  }));
  return (
    <details id="login-mode" className="card !p-4">
      <summary className="font-jua cursor-pointer text-lg text-sky-ink">
        학생 로그인 방식 · 지금 <span className="text-sky-deep">{LOGIN_MODES.find((m) => m.id === mode)!.label}</span> · 관리자 계정 {admins.length}개
      </summary>
      <div className="mt-4 space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <span key={p} className={`rounded-full px-3 py-1 font-bold ${providerReady(p) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {PROVIDER_LABEL[p]} {providerReady(p) ? "켜짐" : `꺼짐 (Vercel 환경변수 ${KEY_NAME[p]} 필요)`}
            </span>
          ))}
        </div>
        {saved !== mode && <p className="font-bold text-amber-700">켜진 구글·카카오 로그인이 없어서 지금은 이름 + 비밀번호로 동작해요.</p>}
        <CloseOnSubmitForm action={saveLoginMode} className="space-y-2">
          {LOGIN_MODES.map((m) => (
            <label key={m.id} className="flex items-start gap-2 rounded-xl bg-sky-soft p-3">
              <input type="radio" name="login_mode" value={m.id} defaultChecked={saved === m.id} className="mt-1 accent-sky-deep" />
              <span><b className="text-sky-ink">{m.label}</b> <span className="text-slate-600">· {m.desc}</span></span>
            </label>
          ))}
          <button className="btn !py-2 !text-base">저장</button>
        </CloseOnSubmitForm>
        <ul className="space-y-1">
          {stats.map((x) => (
            <li key={x.c}>{cohortLabel(x.c)} 신청 {x.total}명 중 <b className="text-sky-ink">{x.linked}명</b> 구글·카카오 연결</li>
          ))}
        </ul>
        <div className="space-y-2 rounded-2xl border-2 border-sky-main/60 p-3">
          <p className="font-bold text-sky-ink">관리자 로그인 계정 (카카오·구글)</p>
          <p className="text-xs text-slate-500">등록한 계정은 관리 페이지에서 카카오·구글 버튼으로 바로 들어와요. 아래 버튼을 누르고 그 계정으로 로그인하면 등록돼요.</p>
          <AdminAddedNotice />
          {admins.length === 0 ? (
            <p className="text-slate-500">아직 없어요 (관리자 비밀번호로만 들어와요)</p>
          ) : (
            <ul className="space-y-1">
              {admins.map((x) => (
                <li key={`${x.p}:${x.sub}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-soft px-3 py-2">
                  <span><b className="text-sky-ink">{PROVIDER_LABEL[x.p]}</b> · {x.label ?? "이름 없음"} <span className="text-slate-400">· {new Date(x.at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 등록</span></span>
                  <CloseOnSubmitForm action={removeAdminLogin} className="ml-auto">
                    <input type="hidden" name="provider" value={x.p} />
                    <input type="hidden" name="subject" value={x.sub} />
                    <button className="text-xs font-bold text-red-600 underline">빼기</button>
                  </CloseOnSubmitForm>
                </li>
              ))}
            </ul>
          )}
          <SocialButtons providers={ready} next="/admin" admin="add" />
        </div>
        <p className="text-xs text-slate-500">
          학생이 비밀번호를 잊었으면 신청 관리에서 비밀번호를 새로 정해 알려 주세요. 그 비밀번호로 한 번 연결하면 돼요. 다른 사람 계정으로 잘못 연결됐으면 학생 통합 화면 '로그인 연결'에서 [연결 끊기].
        </p>
      </div>
    </details>
  );
}
