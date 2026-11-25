import { notFound } from "next/navigation";
import { CLASSROOM, KINDS, todayKST, type Kind } from "@/lib/config";
import { getSetting, listLoginLinks, roundFor } from "@/lib/db";
import { getAccountId } from "@/lib/auth";
import { loginSetup } from "@/lib/socialServer";
import { PROVIDER_LABEL } from "@/lib/socialLogin";
import SocialButtons from "@/components/SocialButtons";
import { holidaysOf } from "@/lib/classCalendar";
import { SCHEDULE_CLASSES, scheduleKey, schoolDaysFor, type ScheduleClass } from "@/lib/schedule";
import { signupMonths } from "@/lib/signupMonthsServer";
import ApplyForm from "./ApplyForm";
import HowToWatch from "@/components/HowToWatch";
import Timetable from "@/components/Timetable";
import { pageMeta } from "@/lib/seo";

// 교재 회차가 기수마다 바뀌어서 매번 새로 읽어요
export const dynamic = "force-dynamic";

// 필독 사항 문구 — 여기만 고치면 돼요.
const NOTICE: Record<Kind, string[]> = {
  onsite: [
    "현장 수강생은 첫 수업 전까지 교재비 납부를 모두 완료해 주세요.",
    `교재는 첫 수업 날 ${CLASSROOM}에서 일괄 지급해요.`,
    `첫 수업 날 ${CLASSROOM}로 수강 시간에 맞춰 등원해 주세요.`,
    "입금자명이 신청자 이름과 다르면 아래 '입금자명' 칸에 꼭 적어 주세요.",
  ],
  online: [
    "불라방 수강생은 등록 즉시 아래 신청서를 작성하고 교재비를 납부해 주세요.",
    "교재는 1층 데스크 수령 또는 택배 수령 중 선택할 수 있어요.",
    "택배 수령은 납부 확인 후 순서대로 발송해요.",
    "입금자명이 신청자 이름과 다르면 아래 '입금자명' 칸에 꼭 적어 주세요.",
  ],
};

// 검색·미리보기용 제목·설명
export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return kind === "online"
    ? pageMeta("불라방(라이브) 교재비 신청 | 부산 서면 토익 벨라토익", "부산 서면 토익 벨라토익 불라방(유튜브 라이브) 수강생 필독 사항과 교재비 신청. 교재는 1층 데스크 또는 택배로 받아요.", "/guide/online")
    : pageMeta("현장 수강 교재비 신청 | 부산 서면 토익 벨라토익", `부산 서면 토익 벨라토익 현장(${CLASSROOM}) 수강생 필독 사항과 교재비 신청. 교재는 첫 수업 날 강의실에서 받아요.`, "/guide/onsite");
}

export default async function KindGuide({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== "onsite" && kind !== "online") notFound();
  // 신청서에서 고를 수 있는 수강 월 (이번 달: 2주차 마지막 수업일까지 / 다음 달: 15일부터)
  // 반별 첫·마지막 수업일 (개강 직전 택배 안내용)
  const windowsOf = async (cohort: string) => {
    const holidays = await holidaysOf(cohort);
    const entries = await Promise.all((Object.keys(SCHEDULE_CLASSES) as ScheduleClass[]).map(async (k) => {
      const days = schoolDaysFor(await getSetting(scheduleKey(cohort, k)), cohort, k).filter((d) => !holidays[d]).sort();
      return [k, { first: days[0] ?? null, last: days.at(-1) ?? null }] as const;
    }));
    return Object.fromEntries(entries);
  };
  const months = await Promise.all((await signupMonths()).map(async (m) => ({ ...m, round: await roundFor(m.cohort), windows: await windowsOf(m.cohort) })));
  // 구글·카카오만 방식: 로그인한 학생 번호로 신청해요 (로그인 전이면 신청서 대신 로그인 버튼)
  const login = await loginSetup();
  const accountId = login.mode === "social" ? await getAccountId() : null;
  const link = accountId ? (await listLoginLinks([accountId])).sort((a, b) => (b.last_login_at ?? "").localeCompare(a.last_login_at ?? ""))[0] : null;
  const accountLabel = accountId ? (link ? `${PROVIDER_LABEL[link.provider]}${link.email || link.nickname ? ` (${link.email ?? link.nickname})` : ""}` : "로그인한") : null;

  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <span className="rounded-full bg-sky-main px-4 py-1.5 text-sm font-bold text-sky-ink">
          {KINDS[kind].label}
        </span>
        <h1 className="font-jua mt-4 text-4xl text-sky-ink">필독 사항 확인</h1>
      </div>

      <section className="card space-y-4">
        <p className="font-jua text-2xl text-sky-ink">반가워요:)</p>
        <p className="leading-relaxed text-slate-700">
          모두 수강 준비 되었나요~?
          <br />
          수업 전 교재 수령을 위한 <b className="text-sky-deep">교재비 납부 안내</b>입니다.
          <br />
          수강 신청한 반을 확인하시고 아래 꼼꼼히 답변해 주세요!
        </p>
        <ul className="space-y-2 rounded-2xl bg-sky-soft p-5">
          {NOTICE[kind].map((n) => (
            <li key={n} className="flex gap-2 text-[15px] leading-relaxed text-slate-700">
              <span className="mt-0.5 font-bold text-sky-deep">✓</span>
              {n}
            </li>
          ))}
        </ul>
      </section>

      <Timetable />

      {kind === "online" && <HowToWatch beforeApply login={login.mode} />}

      {login.mode === "social" && !accountId ? (
        <section className="card space-y-3 text-center">
          <p className="font-jua text-2xl text-sky-ink">✍️ 신청서 쓰기 전에 로그인해 주세요</p>
          <p className="text-sm text-slate-600">카카오 또는 구글 계정으로 신청하면, 강의실·특강도 같은 버튼으로 들어와요.</p>
          <SocialButtons providers={login.providers} next={`/guide/${kind}`} />
        </section>
      ) : (
        <ApplyForm kind={kind} months={months} today={todayKST()} account={accountLabel} />
      )}
    </div>
  );
}
