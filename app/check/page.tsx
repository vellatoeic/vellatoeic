import Link from "next/link";
import { todayKST } from "@/lib/config";
import { getApplications, addAttendance, currentCohort, listStamps } from "@/lib/db";
import { getStudentIds } from "@/lib/auth";
import { canWatch } from "@/lib/access";
import StudentLogin from "../class/StudentLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "출석 체크 · vella_toeic", robots: { index: false } };

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-12">
      <div className="card mx-auto max-w-sm space-y-3 text-center">
        <p className="font-jua text-3xl text-sky-ink">{title}</p>
        {children}
        <Link href="/class" className="btn-ghost mt-2">강의실로 가기</Link>
      </div>
    </div>
  );
}

// 출석 QR은 하나예요. 반·시간 구분 없이, 찍으면 오늘 출석으로 남아요.
// (예전에 인쇄한 반별 QR의 ?k=… 주소로 들어와도 똑같이 출석돼요.)
export default async function Check() {
  const apps = await getApplications(await getStudentIds());
  if (apps.length === 0) {
    return <StudentLogin next="/check" note="출석하려면 먼저 로그인해 주세요. (처음 한 번만)" />;
  }

  const cohort = await currentCohort();
  const thisMonth = apps.filter((a) => a.cohort === cohort);
  const mine = thisMonth.filter(canWatch);
  if (mine.length === 0) {
    return (
      <Box title="출석할 수 없어요">
        <p className="text-slate-600">
          {thisMonth.length > 0 ? "교재비 납부 확인 후 출석 스티커를 받을 수 있어요." : "이번 달 수강 신청 내역이 없어요."}
        </p>
      </Box>
    );
  }

  let days: Set<string>;
  try {
    await Promise.all(mine.map((a) => addAttendance(a.id, todayKST())));
    const { attendance } = await listStamps(mine.map((a) => a.id));
    days = new Set(attendance.map((a) => a.day));
  } catch (e) {
    // 원인을 바로 알 수 있게 오류 내용을 작게 보여줘요. (학생이 캡처해서 Vella에게 보내면 돼요)
    const detail = e instanceof Error ? e.message : typeof e === "object" && e ? JSON.stringify(e) : String(e);
    console.error("출석 저장 실패", detail);
    return (
      <Box title="출석 저장 중 문제가 생겼어요">
        <p className="text-slate-600">잠시 후 QR을 다시 찍어 주세요.<br />계속 안 되면 이 화면을 캡처해서 Vella에게 보내 주세요.</p>
        <p className="break-all rounded-xl bg-slate-50 p-2 text-left text-xs text-slate-400">{detail}</p>
      </Box>
    );
  }

  return (
    <Box title="출석 완료! ☁️">
      <p className="text-slate-600">{mine[0].name}님, 오늘도 왔네요 :)</p>
      <p className="font-jua text-5xl text-sky-deep">{days.size}</p>
      <p className="text-sm text-slate-500">이번 달 모은 출석 스티커</p>
    </Box>
  );
}
