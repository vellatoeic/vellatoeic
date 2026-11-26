import { DESK } from "@/lib/config";
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
    `교재는 ${DESK} 수령 또는 택배 수령 중 선택할 수 있어요.`,
    "택배 수령은 납부 확인 후 순서대로 발송해요.",
    "입금자명이 신청자 이름과 다르면 아래 '입금자명' 칸에 꼭 적어 주세요.",
  ],
};

// 검색·미리보기용 제목·설명
export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return kind === "online"
    ? pageMeta("불라방(라이브) 교재 신청 | 부산 서면 토익 벨라토익", "부산 서면 토익 벨라토익 불라방(유튜브 라이브) 수강생 필독 사항과 교재 신청. 교재는 데스크 수령 또는 택배로 받아요.", "/guide/online")
    : pageMeta("현장 수강 교재 신청 | 부산 서면 토익 벨라토익", `부산 서면 토익 벨라토익 현장(${CLASSROOM}) 수강생 필독 사항과 교재 신청. 교재는 첫 수업 날 강의실에서 받아요.`, "/guide/onsite");
}

export default async function KindGuide({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ pin?: string }> }) {
  const { kind } = await params;
  const { pin: pinParam } = await searchParams;
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
  // 로그인 먼저(2026-11-26 Vella): 카카오·구글 로그인이 켜져 있으면 로그인 → 수강증 → 교재비 → 입금.
  // 로그인한 학생 번호로 신청해서 비밀번호 칸이 없어요. '둘 다' 방식만 아래 작은 링크로 이름+비밀번호 신청도 돼요.
  const login = await loginSetup();
  const accountId = login.mode !== "pin" ? await getAccountId() : null;
  const gate = login.mode !== "pin" && !accountId && !(login.mode === "both" && pinParam === "1");
  const link = accountId ? (await listLoginLinks([accountId])).sort((a, b) => (b.last_login_at ?? "").localeCompare(a.last_login_at ?? ""))[0] : null;
  const accountLabel = accountId ? (link ? `${PROVIDER_LABEL[link.provider]}${link.email || link.nickname ? ` (${link.email ?? link.nickname})` : ""}` : "로그인한") : null;

  const STEPS = [
    { n: 1, title: "YBM 수강증 올리기", sub: "캡처 한 장이면 반이 자동으로" },
    { n: 2, title: "교재비 확인", sub: "내 반 교재와 금액이 바로 나와요" },
    { n: 3, title: "입금하면 끝", sub: "확인되면 강의실이 열려요" },
  ];

  return (
    <div className="stagger wide space-y-5 pt-8">
      <div className="text-center">
        <span className="rounded-full bg-sky-main px-4 py-1.5 text-sm font-bold text-sky-ink">{KINDS[kind].label}</span>
        <h1 className="font-jua mt-4 text-4xl text-sky-ink">교재 신청</h1>
        <p className="mt-2 text-[15px] text-slate-600">학원 수강 등록을 마쳤다면 이렇게 끝나요</p>
      </div>

      {/* 컴퓨터(1024px 이상): 왼쪽 신청서 / 오른쪽 1·2·3 · 시간표 · 불라방 안내 (휴대폰은 위아래 같은 순서) */}
      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6 lg:space-y-0">
      <ol className="grid grid-cols-3 gap-2 lg:col-start-2 lg:row-start-1 lg:grid-cols-1">
        {STEPS.map((st) => (
          <li key={st.n} className="rounded-2xl bg-white p-3 text-center shadow-[0_4px_14px_rgba(18,64,92,0.06)] lg:flex lg:items-center lg:gap-3 lg:p-4 lg:text-left">
            <span className="mx-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-deep text-sm font-bold text-white lg:mx-0">{st.n}</span>
            <span className="block">
              <b className="mt-1.5 block text-[14px] leading-tight text-sky-ink lg:mt-0 lg:text-base">{st.title}</b>
              <small className="mt-1 block text-[11px] leading-snug text-slate-500 lg:text-xs">{st.sub}</small>
            </span>
          </li>
        ))}
      </ol>
      <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2">

      {gate ? (
        <section className="card space-y-4 text-center">
          <p className="font-jua text-2xl text-sky-ink">먼저 로그인해 주세요</p>
          <p className="text-sm text-slate-600">카카오 또는 구글로 로그인하면 비밀번호 없이 신청하고, 강의실·특강도 같은 버튼으로 들어와요.</p>
          <SocialButtons providers={login.providers} next={`/guide/${kind}`} />
          {login.mode === "both" && <a href={`/guide/${kind}?pin=1#apply`} className="block text-xs text-slate-400 underline underline-offset-2">카카오·구글 없이 이름 + 비밀번호로 신청하기</a>}
        </section>
      ) : (
        <ApplyForm kind={kind} months={months} today={todayKST()} account={accountLabel} receiptMenu={await getSetting("receipt_menu")} notices={NOTICE[kind]} />
      )}
      </div>

      <div className="space-y-5 lg:col-start-2 lg:row-start-2">
      <details className="group card !p-0">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-jua text-lg text-sky-ink">수업 시간표 보기<span className="text-sm font-normal text-sky-deep group-open:hidden">펼치기</span></summary>
        <div className="px-2 pb-2"><Timetable /></div>
      </details>
      {kind === "online" && <HowToWatch beforeApply login={login.mode} />}
      </div>
      </div>
    </div>
  );
}
