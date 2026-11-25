import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/Icon";
import { getMemberId } from "@/lib/auth";
import { getMember } from "@/lib/db";
import { activeStudentApps } from "@/lib/student";
import { safeNext } from "@/lib/google";
import { safe } from "@/lib/safe";
import LinkForm from "./LinkForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "수강 신청 연결 · vella_toeic", robots: { index: false } };

// 구글로 처음 로그인한 학생: 신청서의 이름 + 강의실 비밀번호로 내 신청을 계정에 연결 (한 번만)
// 납부·기수·반 확인 같은 수강 권한 규칙은 그대로예요 (연결은 '누구의 신청인지'만 정해요).
export default async function LinkPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const memberId = await getMemberId();
  if (!memberId) redirect("/login");
  const { apps } = await safe("link.apps", () => activeStudentApps(), { loggedIn: false, apps: [] });
  if (apps.length > 0) redirect(next);
  const member = await safe("link.member", () => getMember(memberId), null);
  return (
    <div className="pt-10">
      <div className="card mx-auto max-w-sm space-y-4 text-center">
        <Icon name="link" size={56} className="mx-auto block" />
        <h1 className="font-jua text-2xl text-sky-ink">내 수강 신청 연결하기</h1>
        <p className="text-sm text-slate-600">
          {member?.name ? <><b className="text-sky-ink">{member.name}</b>님, </> : null}구글 로그인이 됐어요.<br />
          처음 한 번만 <b className="text-sky-ink">교재비 신청서의 이름</b>과 <b className="text-sky-ink">강의실 비밀번호 4자리</b>를 입력해 주세요.
          다음부터는 구글 로그인만 하면 바로 들어와요.
        </p>
        {member?.email && <p className="rounded-2xl bg-sky-soft px-4 py-2 text-xs text-sky-deep">{member.email}</p>}
        <LinkForm next={next} />
        <p className="text-xs text-slate-400">
          아직 신청 전이라면 <Link href="/guide" className="text-sky-deep underline">필독 사항 확인</Link> 후 신청서를 내 주세요. 로그인한 채로 낸 신청서는 자동으로 연결돼요.
        </p>
      </div>
    </div>
  );
}
