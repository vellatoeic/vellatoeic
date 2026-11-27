import { redirect } from "next/navigation";
import Link from "next/link";
import { myProfileState } from "@/lib/profileServer";
import { loginSetup } from "@/lib/socialServer";
import { skipLinkStep } from "@/app/actions";
import SocialButtons from "@/components/SocialButtons";
import Icon from "@/components/Icon";
import StudentLogin from "@/app/class/StudentLogin";
import { PhoneStep, ReasonStep, TargetStep } from "./Steps";
import type { Step } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 정보 입력 · vella_toeic", robots: { index: false } };

// 처음 로그인한 뒤 한 장에 한 질문씩 (2026-11-27 Vella): ① 카카오·구글 연결 ② 휴대폰 번호(동명이인 구분) ③ 목표 점수 ④ 토익 공부 이유
// 다 하면 알맞은 화면(/go)으로. '내 정보'에서 고칠 때는 ?s=단계&edit=1
const TITLES: Record<Step, { icon: string; title: string; sub: string }> = {
  link: { icon: "lock", title: "카카오 또는 구글로\n연결해 주세요", sub: "다음부터는 이름·비밀번호 없이 버튼 하나로 들어와요. 가장 정확하고 안전한 방법이에요." },
  phone: { icon: "people", title: "본인 휴대폰 번호를\n적어 주세요", sub: "같은 이름의 학생(동명이인)을 구분하는 데만 써요." },
  target: { icon: "target", title: "목표 점수를\n적어 주세요", sub: "대충 정해도 괜찮아요. 언제든 '내 정보'에서 바꿀 수 있어요." },
  reason: { icon: "reading", title: "토익을 공부하는\n이유를 골라 주세요", sub: "수업 준비에 참고할게요." },
};

export default async function Welcome({ searchParams }: { searchParams: Promise<{ s?: string; edit?: string }> }) {
  const state = await myProfileState();
  if (!state) return <StudentLogin next="/welcome" note="교재 신청할 때 만든 계정으로 들어와요." />;
  const { s, edit } = await searchParams;
  const editing = edit === "1" && (s === "phone" || s === "target" || s === "reason");
  const step: Step | undefined = editing ? (s as Step) : state.steps[0];
  if (!step) redirect("/go");
  const total = editing ? 1 : state.steps.length + (state.profile ? [state.profile.phone, state.profile.target_score, state.profile.reasons?.length].filter(Boolean).length : 0);
  const index = editing ? 1 : total - state.steps.length + 1;
  const t = TITLES[step];
  const { providers } = await loginSetup();

  return (
    <div className="mx-auto max-w-md pt-10 lg:pt-16">
      {!editing && (
        <div className="mb-6 flex items-center justify-center gap-1.5" aria-label={`${index} / ${total}`}>
          {Array.from({ length: total }, (_, i) => <span key={i} className={`h-2 rounded-full transition-all ${i < index - 1 ? "w-2 bg-sky-deep" : i === index - 1 ? "w-8 bg-sky-deep" : "w-2 bg-sky-main/60"}`} />)}
        </div>
      )}
      <div className="card space-y-5 !p-6 sm:!p-8">
        <div className="text-center">
          <Icon name={t.icon} size={56} className="mx-auto block" />
          <h1 className="mt-3 whitespace-pre-line font-jua text-[26px] leading-snug text-sky-ink">{t.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{t.sub}</p>
          {!editing && state.no && <p className="mt-3 inline-block rounded-full bg-sky-soft px-3 py-1 text-xs font-bold text-sky-ink">{state.apps[0]?.name}님 · 개인번호 {state.no}</p>}
        </div>

        {state.viewOnly && <p className="rounded-2xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-700">학생 화면 미리보기 중이라 저장되지 않아요.</p>}

        {step === "link" && (
          <div className="space-y-3">
            <SocialButtons providers={providers} next="/welcome" link />
            <form action={skipLinkStep} className="text-center">
              <button className="text-sm text-slate-400 underline underline-offset-2">나중에 할게요</button>
            </form>
          </div>
        )}
        {step === "phone" && <PhoneStep initial={state.profile?.phone ?? state.apps.find((a) => a.phone)?.phone ?? ""} edit={editing} />}
        {step === "target" && <TargetStep initial={state.profile?.target_score ?? null} edit={editing} />}
        {step === "reason" && <ReasonStep initial={state.profile?.reasons ?? []} note={state.profile?.reason_note ?? null} edit={editing} />}
      </div>
      {editing && <Link href="/me" className="mt-4 block text-center text-sm text-slate-500 underline">취소하고 내 정보로</Link>}
    </div>
  );
}
