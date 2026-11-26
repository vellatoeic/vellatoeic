import { redirect } from "next/navigation";
import { getPendingLink } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import { PROVIDER_LABEL, safeNext } from "@/lib/socialLogin";
import { myZone } from "@/lib/zones";
import { cancelLink, startFresh } from "@/app/actions";
import StudentLogin from "@/app/class/StudentLogin";
import LinkForm from "./LinkForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "로그인 · vella_toeic", robots: { index: false } };

// 머리의 [로그인] 버튼이 오는 곳 + 구글·카카오로 처음 들어온 학생의 '처음 한 번 연결' 화면
// - 이미 로그인했으면 알맞은 화면(관리자 / 신청 후 / 신청 전)으로 바로 보내요 (lib/zones.ts)
// - 구글·카카오로 처음 들어왔으면: 이름+비밀번호로 예전 신청을 한 번만 연결하거나, 처음이면 신청서로
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; e?: string }> }) {
  const { next: rawNext, e } = await searchParams;
  const next = safeNext(rawNext);
  const pending = await getPendingLink();
  if (!pending) {
    const { zone } = await myZone();
    if (zone !== "visitor" && zone !== "linking" && e !== "fail") redirect(next);
    return <StudentLogin next={rawNext ? next : undefined} error={e} />;
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

      {/* 12월부터 새로 오는 학생이 대부분이라 '처음이에요'가 위, 이미 신청한 학생의 연결 칸은 아래 */}
      <section className="card space-y-3">
        <h2 className="font-jua text-xl text-sky-ink">벨라토익 수업이 처음이에요</h2>
        <p className="text-sm text-slate-600">이 {label} 계정으로 교재 신청해요. 이후 강의실 입장 가능해요.</p>
        <form action={startFresh}>
          <input type="hidden" name="next" value={next} />
          <button className="btn w-full">수강 등록하러 가기</button>
          <p className="mt-2 text-xs text-slate-500">학원에서 수강 신청을 마쳤다면 다시 신청하지 않아요. YBM 수강증 캡처만 올리면 반이 자동으로 등록돼요.</p>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="font-jua text-xl text-sky-ink">전에 교재 신청을 한 적이 있어요</h2>
        <p className="text-sm text-slate-600">
          지난달 수강생이거나 이미 신청서를 냈다면, 신청할 때 정한 <b>이름과 비밀번호 4자리</b>를 한 번만 입력하면 연결돼요. 다음부터는 {label} 버튼만 누르면 돼요.
        </p>
        <LinkForm next={next} />
        <p className="text-xs text-slate-500">
          비밀번호가 기억나지 않으면 Vella쌤에게 카톡으로 알려 주세요.
          {channel && <> <a href={channel} target="_blank" rel="noreferrer" className="text-sky-deep underline">카톡 채널 열기 ↗</a></>}
        </p>
      </section>

      <form action={cancelLink} className="text-center">
        <button className="text-sm text-slate-500 underline">다른 계정으로 로그인하기</button>
      </form>
    </div>
  );
}
