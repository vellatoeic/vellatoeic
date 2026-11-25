import Link from "next/link";
import { redirect } from "next/navigation";
import { getPendingLink } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import { PROVIDER_LABEL, safeNext } from "@/lib/socialLogin";
import { loginSetup } from "@/lib/socialServer";
import { cancelLink, startFresh } from "@/app/actions";
import SocialButtons from "@/components/SocialButtons";
import LinkForm from "./LinkForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "로그인 연결 · vella_toeic", robots: { index: false } };

// 구글·카카오로 처음 들어온 학생: 이름+비밀번호로 예전 신청을 한 번만 연결하거나, 처음이면 신청서로
export default async function LoginLinkPage({ searchParams }: { searchParams: Promise<{ next?: string; e?: string }> }) {
  const { next: rawNext, e } = await searchParams;
  const next = safeNext(rawNext);
  const pending = await getPendingLink();
  if (!pending) {
    if (e !== "fail") redirect(next);
    const { providers } = await loginSetup();
    return (
      <div className="pt-12">
        <div className="card mx-auto max-w-sm space-y-4 text-center">
          <h1 className="font-jua text-2xl text-sky-ink">로그인하지 못했어요</h1>
          <p className="text-sm text-slate-600">잠시 후 다시 눌러 주세요. 계속 안 되면 다른 방법(카카오·구글)으로 로그인해 보세요.</p>
          <SocialButtons providers={providers} next={next} />
          <Link href={next} className="block text-sm text-slate-500 underline">돌아가기</Link>
        </div>
      </div>
    );
  }
  const label = PROVIDER_LABEL[pending.p];
  const who = pending.email ?? pending.nick;
  const channel = await getSetting("kakao_channel_url");

  return (
    <div className="mx-auto max-w-md space-y-5 pt-8">
      <div className="text-center">
        <h1 className="font-jua text-3xl text-sky-ink">처음 한 번만 연결해요</h1>
        <p className="mt-2 text-slate-600">
          {label} 계정{who ? ` (${who})` : ""}으로 {pending.none ? "들어왔는데, 연결된 수강 신청이 없어요." : "처음 들어왔어요."}
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="font-jua text-xl text-sky-ink">교재비 신청을 한 적이 있어요</h2>
        <p className="text-sm text-slate-600">
          신청할 때 정한 <b>이름과 비밀번호 4자리</b>를 한 번만 입력하면 연결돼요. 다음부터는 {label} 버튼만 누르면 돼요.
        </p>
        <LinkForm next={next} />
        <p className="text-xs text-slate-500">
          비밀번호가 기억나지 않으면 Vella쌤에게 카톡으로 알려 주세요.
          {channel && <> <a href={channel} target="_blank" rel="noreferrer" className="text-sky-deep underline">카톡 채널 열기 ↗</a></>}
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-jua text-xl text-sky-ink">벨라토익 수업이 처음이에요</h2>
        <p className="text-sm text-slate-600">이 {label} 계정으로 교재비 신청서를 작성해요. 강의실·특강도 같은 버튼으로 들어와요.</p>
        <form action={startFresh}>
          <input type="hidden" name="next" value={next} />
          <button className="btn-ghost w-full">수강 신청하러 가기</button>
        </form>
      </section>

      <form action={cancelLink} className="text-center">
        <button className="text-sm text-slate-500 underline">다른 계정으로 로그인하기</button>
      </form>
    </div>
  );
}
