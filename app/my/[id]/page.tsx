import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOKS, CLASSROOM, COURSES, KINDS, TRACKS, cohortLabel, pickupLabel, won } from "@/lib/config";
import { getApplication, getSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ again?: string }> }) {
  const { id } = await params;
  const { again } = await searchParams;
  const a = await getApplication(id);
  if (!a) notFound();
  const account = await getSetting("bank_account");

  const steps =
    a.pickup === "delivery"
      ? ["신청서 제출", "납부 확인", "교재 발송"]
      : ["신청서 제출", "납부 확인", "수업 준비 완료"];
  const done = a.status === "pending" ? 1 : a.status === "paid" ? (a.pickup === "delivery" ? 2 : 3) : 3;

  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <h1 className="font-jua text-4xl text-sky-ink">
          {a.status === "pending" ? "아직 납부 전이에요" : a.pickup === "delivery" && a.status === "paid" ? "납부 확인 완료!" : "모든 준비 완료!"}
        </h1>
        <p className="mt-2 text-slate-600">{a.name}님, 이 페이지를 즐겨찾기 해두면 진행 상황을 확인할 수 있어요.</p>
      </div>

      {again && (
        <p className="card !bg-sky-soft text-center font-bold text-sky-ink">이미 제출한 신청이 있어요.<br />다시 제출하지 않아도 돼요.</p>
      )}

      {a.status === "pending" && (
        <div className="rounded-3xl border-2 border-red-300 bg-red-50 p-5 text-center">
          <p className="font-jua text-2xl text-red-600">⚠️ 신청서만 제출된 상태예요</p>
          <p className="mt-2 text-[15px] text-slate-700">아래 계좌로 <b>입금해야 신청이 완료</b>돼요.<br />입금이 확인되면 이 화면이 &apos;납부 확인&apos;으로 바뀌어요.</p>
        </div>
      )}

      <ol className="card flex items-center justify-between gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col items-center gap-2 text-center">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                i < done ? "bg-sky-deep text-white" : "bg-sky-soft text-sky-ink/40"
              }`}
            >
              {i < done ? "✓" : i + 1}
            </span>
            <span className={`text-sm font-bold ${i < done ? "text-sky-ink" : "text-slate-400"}`}>{s}</span>
          </li>
        ))}
      </ol>

      {a.status === "pending" && (
        <section className="card space-y-3 text-center">
          <p className="text-sm text-slate-500">아래 계좌로 입금해 주세요</p>
          <p className="font-jua text-4xl text-sky-ink">{won(a.amount)}</p>
          <p className="rounded-2xl bg-sky-soft p-4 text-lg font-bold text-sky-ink">
            {account || "계좌 안내 준비 중이에요"}
          </p>
          <p className="text-sm text-slate-600">
            입금자명: <b>{a.depositor}</b>
          </p>
          <p className="text-xs text-slate-400">입금이 확인되면 이 화면이 &apos;납부 확인&apos;으로 바뀌어요.</p>
          <p className="text-xs text-slate-400">입금 확인은 일괄처리됩니다.</p>
        </section>
      )}

      {a.status !== "pending" && (
        <section className="card text-center">
          <p className="text-lg text-slate-700">
            {a.pickup === "delivery"
              ? a.status === "shipped"
                ? <>교재를 택배로 보냈어요.<br />곧 도착해요!</>
                : "납부가 확인됐어요. 교재를 순서대로 발송할게요."
              : a.kind === "onsite"
                ? <>납부가 확인됐어요.<br />첫 수업 날 {CLASSROOM}에서 교재를 일괄 지급해요.<br />수강 시간에 맞춰 등원해 주세요!</>
                : "납부가 확인됐어요. 1층 데스크에서 교재를 받아 가세요!"}
          </p>
        </section>
      )}

      {a.status !== "pending" && (
        <Link href="/class" className="btn w-full">강의실 가기 →</Link>
      )}

      <section className="card">
        <h2 className="font-jua text-xl text-sky-ink">신청 내용</h2>
        <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-y-2 text-[15px]">
          <dt className="text-slate-500">기수</dt><dd>{cohortLabel(a.cohort)}</dd>
          <dt className="text-slate-500">수강 형태</dt><dd>{KINDS[a.kind].label}</dd>
          <dt className="text-slate-500">반</dt><dd>{COURSES[a.course].label} {TRACKS[a.track]}</dd>
          <dt className="text-slate-500">교재</dt><dd>{a.books.map((b) => BOOKS[b]).join(", ")}</dd>
          <dt className="text-slate-500">수령 방법</dt><dd>{pickupLabel(a.kind, a.pickup)}</dd>
          {a.address && (<><dt className="text-slate-500">주소</dt><dd>{a.address}</dd></>)}
          <dt className="text-slate-500">교재비</dt><dd className="font-bold">{won(a.amount)}</dd>
        </dl>
      </section>
    </div>
  );
}
