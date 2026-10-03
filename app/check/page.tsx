import Link from "next/link";
import { KLASSES, klassOf, klassTimeLabel, isCheckOpen, todayKST, type Klass } from "@/lib/config";
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

export default async function Check({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k = "" } = await searchParams;
  if (!Object.hasOwn(KLASSES, k)) return <Box title="잘못된 QR이에요"><p className="text-slate-600">강의실에 붙어 있는 QR을 다시 찍어 주세요.</p></Box>;
  const klass = k as Klass;

  const apps = await getApplications(await getStudentIds());
  if (apps.length === 0) {
    return (
      <StudentLogin
        next={`/check?k=${klass}`}
        note="출석하려면 먼저 로그인해 주세요. (처음 한 번만)"
      />
    );
  }

  // 붙여 둔 QR은 바뀌지 않으니, 수업 시간에만 출석으로 인정해요.
  if (!isCheckOpen(klass)) {
    return (
      <Box title="지금은 출석 시간이 아니에요">
        <p className="text-slate-600">
          {KLASSES[klass]} 출석은 <b>{klassTimeLabel(klass)}</b>에 할 수 있어요.
        </p>
      </Box>
    );
  }

  const cohort = await currentCohort();
  const mine = apps.find((a) => canWatch(a) && a.cohort === cohort && klassOf(a) === klass);
  if (!mine) {
    const unpaid = apps.some((a) => a.cohort === cohort && klassOf(a) === klass && !canWatch(a));
    return (
      <Box title="출석할 수 없어요">
        <p className="text-slate-600">
          {unpaid ? "교재비 납부 확인 후 출석 스티커를 받을 수 있어요." : `${KLASSES[klass]} 수강생으로 등록돼 있지 않아요.`}
        </p>
      </Box>
    );
  }

  await addAttendance(mine.id, todayKST());
  const { attendance } = await listStamps([mine.id]);

  return (
    <Box title="출석 완료! ☁️">
      <p className="text-slate-600">{mine.name}님, 오늘도 왔네요 :)</p>
      <p className="font-jua text-5xl text-sky-deep">{attendance.length}</p>
      <p className="text-sm text-slate-500">이번 달 모은 출석 스티커</p>
    </Box>
  );
}
