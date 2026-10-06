import Link from "next/link";
import { KLASSES, TIME_SLOTS, attendanceTiming, klassOf, takesSharedLc, todayKST, type Klass } from "@/lib/config";
import { getApplications, addAttendance, currentCohort, getSetting, listStamps } from "@/lib/db";
import { scheduleClassFor, scheduleKey, schoolDaysFor } from "@/lib/schedule";
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

  const cohort = await currentCohort();
  const matches = apps.filter((a) => a.cohort === cohort && (klass === "lc-common" ? takesSharedLc(a) : klassOf(a) === klass));
  const mine = klass === "lc-common"
    ? matches.filter(canWatch)
    : matches.filter(canWatch).slice(0, 1);
  if (mine.length === 0) {
    const unpaid = matches.some((a) => !canWatch(a));
    return (
      <Box title="출석할 수 없어요">
        <p className="text-slate-600">
          {unpaid ? "교재비 납부 확인 후 출석 스티커를 받을 수 있어요." : `${KLASSES[klass]} 수강생으로 등록돼 있지 않아요.`}
        </p>
      </Box>
    );
  }

  // 오늘이 이 학생 반의 수업일일 때만 출석으로 남겨요. (주말·공휴일에 집에서 찍는 것 방지)
  const today = todayKST();
  const classToday = (await Promise.all(mine.map(async (a) => {
    const sk = scheduleClassFor(a.course, a.track);
    return schoolDaysFor(await getSetting(scheduleKey(a.cohort, sk)), a.cohort, sk).includes(today) ? a : null;
  }))).filter((a) => a !== null);
  if (classToday.length === 0) {
    return (
      <Box title="오늘은 수업일이 아니에요">
        <p className="text-slate-600">수업이 있는 날 QR을 찍어 주세요.</p>
      </Box>
    );
  }

  // 수업 시작 30분 전부터 시작 시각까지 정상 출석, 그 뒤에는 지각이에요.
  const slot = classToday.find((a) => a.slot)?.slot ?? null;
  // LC 단과 학생은 어느 QR을 찍어도 LC 수업 시작 기준이에요.
  const timingKlass: Klass = classToday.every((a) => a.track === "lc") ? "lc-common" : klass;
  const timing = attendanceTiming(timingKlass, slot, classToday.some(takesSharedLc));
  if (timing.state === "early") {
    return (
      <Box title="아직 출석 시간이 아니에요">
        <p className="text-slate-600">
          {KLASSES[timingKlass]}{slot ? ` ${TIME_SLOTS[slot]}` : ""} 수업은 <b>{timing.startsAt}</b> 시작이에요.<br /><b>{timing.opensAt}</b>부터 출석할 수 있어요.
        </p>
      </Box>
    );
  }
  const late = timing.state === "late";
  let days: Set<string>;
  try {
    await Promise.all(classToday.map((a) => addAttendance(a.id, today, late)));
    const { attendance } = await listStamps(classToday.map((a) => a.id));
    days = new Set(attendance.map((a) => a.day));
  } catch (e) {
    // 원인을 바로 알 수 있게 오류 내용을 작게 보여줘요. (학생이 캡처해서 Vella에게 보내면 돼요)
    const detail = e instanceof Error ? e.message : typeof e === "object" && e ? JSON.stringify(e) : String(e);
    console.error("출석 저장 실패", klass, detail);
    return (
      <Box title="출석 저장 중 문제가 생겼어요">
        <p className="text-slate-600">잠시 후 QR을 다시 찍어 주세요.<br />계속 안 되면 이 화면을 캡처해서 Vella에게 보내 주세요.</p>
        <p className="break-all rounded-xl bg-slate-50 p-2 text-left text-xs text-slate-400">{klass} · {detail}</p>
      </Box>
    );
  }

  return (
    <Box title="출석 완료! ☁️">
      <p className="text-slate-600">{mine[0].name}님, 오늘도 왔네요 :)</p>
      <p className="font-jua text-5xl text-sky-deep">{days.size}</p>
      <p className="text-sm text-slate-500">이번 달 모은 출석 스티커</p>
      {late && <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-700">수업 시작({timing.startsAt}) 이후라 지각 ⏰으로 기록됐어요.</p>}
    </Box>
  );
}
