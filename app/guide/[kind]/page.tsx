import { notFound } from "next/navigation";
import { CLASSROOM, KINDS, type Kind } from "@/lib/config";
import { currentCohort, roundFor } from "@/lib/db";
import ApplyForm from "./ApplyForm";
import HowToWatch from "@/components/HowToWatch";
import Timetable from "@/components/Timetable";

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

export default async function KindGuide({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== "onsite" && kind !== "online") notFound();
  const round = await roundFor(await currentCohort());

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

      {kind === "online" && <HowToWatch beforeApply />}

      <ApplyForm kind={kind} round={round} />
    </div>
  );
}
