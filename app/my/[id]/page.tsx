import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOKS, CLASSROOM, COURSES, KINDS, TRACKS, cohortLabel, pickupLabel, slotLabel, won } from "@/lib/config";
import { getApplication, getSetting } from "@/lib/db";
import { classDaysLabel, classTimes } from "@/lib/live";
import { specialDay } from "@/lib/special";
import HowToWatch from "@/components/HowToWatch";
import AddToHome from "@/components/AddToHome";
import BookReceived from "@/components/BookReceived";
import { activeStudentApps } from "@/lib/student";

export const dynamic = "force-dynamic";

export default async function MyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ again?: string }> }) {
  const { id } = await params;
  const { again } = await searchParams;
  const a = await getApplication(id);
  if (!a) notFound();
  if (a.status === "refunded") {
    return (
      <div className="pt-12">
        <div className="card mx-auto max-w-sm space-y-2 text-center">
          <p className="font-jua text-2xl text-sky-ink">환불 처리된 신청이에요</p>
          <p className="text-slate-600">수강 정보가 없어요. Vella쌤에게 문의해 주세요.</p>
        </div>
      </div>
    );
  }
  const account = await getSetting("bank_account");
  // 본인으로 로그인돼 있을 때만 '교재 받았어요' 버튼을 보여줘요.
  const isMine = (await activeStudentApps()).apps.some((x) => x.id === a.id);
  const deskWaiting = a.kind === "online" && a.pickup === "classroom" && a.status === "paid";

  const online = a.kind === "online";
  const steps = !online
    ? ["신청서 제출", "납부 확인", "수업 준비 완료"]
    : ["신청서 제출", "납부 확인", a.pickup === "delivery" ? "교재 발송" : "교재 수령"];
  const done = a.status === "pending" ? 1 : a.status === "paid" && online ? 2 : 3;

  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <h1 className="font-jua text-4xl text-sky-ink">
          {a.status === "pending" ? "아직 납부 전이에요" : online && a.status === "paid" ? "납부 확인 완료!" : "모든 준비 완료!"}
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
          {a.pickup === "delivery" && <p className="text-xs text-slate-500">입금이 확인되면 바로 택배를 접수해요 📦</p>}
        </section>
      )}

      {a.status !== "pending" && (
        <section className="card text-center">
          <p className="text-lg text-slate-700">
            {a.pickup === "delivery"
              ? a.status === "shipped"
                ? <>교재를 택배로 보냈어요.<br />곧 도착해요!</>
                : <><b className="font-jua text-xl text-sky-ink">불라방 택배 접수 완료!</b><br />다다다닥 달려갑니다💨<br /><span className="text-base text-slate-500">수령일까지 평일 기준 2~3일 소요됩니다.</span></>
              : a.kind === "onsite"
                ? <>납부가 확인됐어요.<br />첫 수업 날 {CLASSROOM}에서 교재를 일괄 지급해요.<br />수강 시간에 맞춰 등원해 주세요!</>
                : a.status === "shipped"
                  ? "교재 수령이 확인됐어요. 수업 준비 완료!"
                  : <>납부가 확인됐어요.<br />{a.pickup_date ? <><b>{specialDay(a.pickup_date)} {a.pickup_time}</b>에 </> : ""}1층 데스크에서 교재를 받아 가세요!</>}
          </p>
        </section>
      )}

      {a.status !== "pending" && (
        <div className="space-y-2 text-center">
          <Link href="/class" className="btn w-full">강의 수강하러 가기 →</Link>
          <p className="text-sm text-sky-deep">강의실에서 라이브와 강의 영상을 볼 수 있어요!</p>
        </div>
      )}

      {deskWaiting && isMine && <BookReceived id={a.id} when={a.pickup_date ? `${specialDay(a.pickup_date)} ${a.pickup_time ?? ""}` : undefined} />}

      {a.kind === "online" && <HowToWatch days={classDaysLabel(a)} times={classTimes(a)} />}
      <AddToHome />

      <section className="card">
        <h2 className="font-jua text-xl text-sky-ink">신청 내용</h2>
        <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-y-2 text-[15px]">
          <dt className="text-slate-500">기수</dt><dd>{cohortLabel(a.cohort)}</dd>
          <dt className="text-slate-500">수강 형태</dt><dd>{KINDS[a.kind].label}</dd>
          <dt className="text-slate-500">반</dt><dd>{COURSES[a.course].label} {TRACKS[a.track]}</dd>
          {a.slot && (<><dt className="text-slate-500">수강 시간</dt><dd>{slotLabel(a, a.slot)}</dd></>)}
          <dt className="text-slate-500">교재</dt><dd>{a.books.map((b) => BOOKS[b]).join(", ")}</dd>
          <dt className="text-slate-500">수령 방법</dt><dd>{pickupLabel(a.kind, a.pickup)}</dd>
          {a.address && (<><dt className="text-slate-500">주소</dt><dd>{a.address}</dd></>)}
          {a.pickup_date && (<><dt className="text-slate-500">수령 희망</dt><dd>{specialDay(a.pickup_date)} {a.pickup_time} · 1층 데스크</dd></>)}
          <dt className="text-slate-500">교재비</dt><dd className="font-bold">{won(a.amount)}</dd>
        </dl>
      </section>
    </div>
  );
}
