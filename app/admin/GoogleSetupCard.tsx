import { headers } from "next/headers";
import Icon from "@/components/Icon";
import { CALLBACK_PATH, GOOGLE_ID_ENV, GOOGLE_SECRET_ENV, googleSetup } from "@/lib/google";

// 관리 [기본 설정] 안 '구글 로그인 점검': 켜졌는지 · 찾은 환경변수 이름(값은 안 보여요) · 구글 콘솔에 등록할 주소
export default async function GoogleSetupCard() {
  const g = googleSetup();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "vellatoeic.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const here = `${proto}://${host}${CALLBACK_PATH}`;
  const prod = `https://vellatoeic.vercel.app${CALLBACK_PATH}`;
  return (
    <div className={`mb-4 space-y-2 rounded-2xl p-4 text-sm ${g.on ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
      <p className="flex items-center gap-1.5 font-jua text-lg">
        <Icon name={g.on ? "check" : "alert"} size={22} />구글 로그인 {g.on ? "켜짐" : "꺼짐"}
      </p>
      <p>
        찾은 환경변수: 아이디 <b>{g.idName ?? "없음"}</b> · 비밀값 <b>{g.secretName ?? "없음"}</b>
        {!g.on && <span className="block text-xs">Vercel 환경변수 이름이 {GOOGLE_ID_ENV.slice(0, 2).join(" 또는 ")} / {GOOGLE_SECRET_ENV.slice(0, 2).join(" 또는 ")} 중 하나여야 해요. 넣은 뒤에는 다시 배포해야 반영돼요.</span>}
      </p>
      <div>
        <p>구글 클라우드 콘솔 → 사용자 인증 정보 → OAuth 클라이언트 → <b>승인된 리디렉션 URI</b>에 아래 주소가 있어야 해요:</p>
        <p className="mt-1 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs">{prod}</p>
        {here !== prod && <p className="mt-1 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs">{here} <span className="font-sans text-slate-500">(지금 보고 있는 주소에서 쓰려면)</span></p>}
      </div>
    </div>
  );
}
