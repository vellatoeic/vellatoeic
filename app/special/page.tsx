import { activeStudentApps } from "@/lib/student";
import { expireSpecialDeposits, getSetting, getSpecialRegistrationsFor, listSpecialLectures, listSpecialMaterials } from "@/lib/db";
import { CLASSROOM, DEPOSIT_MINUTES, SPECIAL_DEPOSIT, won } from "@/lib/config";
import { specialLogout } from "@/app/actions";
import { canSeeSpecialMaterials, deadlineBadge, specialRegistrationOpen, specialWhen } from "@/lib/special";
import { todayKST } from "@/lib/config";
import SpecialForm from "./SpecialForm";
import { publicSpecials } from "@/lib/specialPlan";
import SpecialLogin from "./SpecialLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "특강 신청 · vella_toeic", robots: { index: false } };

export default async function SpecialPage() {
  await expireSpecialDeposits(DEPOSIT_MINUTES);
  const [events, mine] = await Promise.all([listSpecialLectures().then(publicSpecials), activeStudentApps().then(({ apps }) => getSpecialRegistrationsFor(apps.map((a) => a.id)))]);
  const account = await getSetting("bank_account");
  // 아직 열리지 않은(오늘 이후) 특강은 모두 보여주고, 마감된 것은 '신청이 마감됐어요'로 막아요.
  const today = todayKST();
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const upcoming = events.filter((event) => event.event_date >= today);
  const open = upcoming.filter((event) => specialRegistrationOpen(event));
  // 맨 위 글자: 다가오는 첫 특강 요일 (금 → 금요 특강, 토 → 토요 특강, 그 외·없음 → 특강)
  const firstDay = upcoming.length ? new Date(`${[...upcoming].sort((x, y) => x.event_date.localeCompare(y.event_date))[0].event_date}T00:00:00Z`).getUTCDay() : -1;
  const weekdayLabel = firstDay === 5 ? "금요 특강" : firstDay === 6 ? "토요 특강" : "특강";
  const eventById = new Map(events.map((event) => [event.id, event]));
  const myRows = await Promise.all(
    mine
      // 지난달 이전 특강은 열람 기간이 끝나서 목록에서 빼요
      .filter((registration) => eventById.has(registration.special_lecture_id) && eventById.get(registration.special_lecture_id)!.event_date.slice(0, 7) >= today.slice(0, 7))
      .map(async (registration) => {
        const event = eventById.get(registration.special_lecture_id)!;
        const canSee = canSeeSpecialMaterials(registration, event.event_date, today);
        return { registration, event, canSee, materials: canSee ? await listSpecialMaterials(registration.special_lecture_id) : [] };
      }),
  );
  // 다가오는 특강이 먼저(가까운 순), 지난 특강은 그 아래(최근 순)
  myRows.sort((a, b) => {
    const pa = a.event.event_date < today, pb = b.event.event_date < today;
    if (pa !== pb) return pa ? 1 : -1;
    return pa ? b.event.event_date.localeCompare(a.event.event_date) : a.event.event_date.localeCompare(b.event.event_date);
  });

  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <span className="rounded-full bg-sky-main px-4 py-1.5 text-sm font-bold text-sky-ink">{weekdayLabel}</span>
        <h1 className="font-jua mt-3 text-4xl text-sky-ink">특강 신청</h1>
        <p className="mt-2 text-slate-600">현장 또는 불라방으로 신청할 수 있어요.</p>
      </div>

      {upcoming.length > 0
        ? <SpecialForm events={upcoming.map((event) => ({ id: event.id, title: event.title, when: specialWhen(event), closed: !open.includes(event), badge: deadlineBadge(event) }))} />
        : <p className="card text-center text-slate-500">지금 신청할 수 있는 특강이 없어요.</p>}

      {myRows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-jua text-2xl text-sky-ink">내 특강 신청</h2>
          {myRows.map(({ registration, event, materials, canSee }) => (
            <div key={registration.id} className="card space-y-3">
              {event.event_date >= today && (() => {
                // 다가오는 특강: 신청 상태를 카드 맨 위에 크게
                const d = registration.deposit ?? "pending";
                const banner = registration.mode === "online"
                  ? { tone: "bg-emerald-500 text-white", title: "✅ 신청 확정", sub: "특강 날 해당 페이지로 입장해요." }
                  : d === "paid"
                    ? { tone: "bg-emerald-500 text-white", title: "✅ 신청 확정", sub: `보증금 확인 완료 · 특강 당일 10시까지 ${CLASSROOM}` }
                    : d === "cancelled"
                      ? { tone: "bg-slate-200 text-slate-600", title: "신청이 취소됐어요", sub: "" }
                      : { tone: "bg-amber-300 text-amber-900", title: "⏳ 아직 확정 전 · 보증금 입금이 필요해요", sub: "" };
                return (
                  <div className={`-mx-1 rounded-2xl px-4 py-3 text-center ${banner.tone}`}>
                    <p className="font-jua text-2xl">{banner.title}</p>
                    {banner.sub && <p className="mt-0.5 text-sm opacity-90">{banner.sub}</p>}
                  </div>
                );
              })()}
              <div>
                <p className="text-sm text-sky-deep">{specialWhen(event)}</p>
                <p className="font-jua text-xl text-sky-ink">{event.title} · {registration.mode === "onsite" ? "현장" : "불라방"}</p>
                <p className="text-sm text-slate-500">{registration.name}</p>
              </div>
              {registration.mode === "onsite" && event.event_date >= today ? (
                <div className="space-y-3">
                  {registration.deposit === "paid" ? (
                    <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                      특강에 참여하면 현장에서 보증금 {won(SPECIAL_DEPOSIT)}을 100% 돌려드려요. 그날 만나요!
                    </p>
                  ) : registration.deposit === "review" ? (
                    <p className="rounded-2xl bg-sky-soft p-4 text-sm text-slate-700"><b>입금 대기 · 확인 중이에요.</b><br />Vella쌤이 확인하면 신청이 확정돼요.</p>
                  ) : registration.deposit === "cancelled" ? (
                    <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600"><b>신청이 취소됐어요.</b><br />신청 후 {DEPOSIT_MINUTES}분 안에 보증금 입금이 확인되지 않았어요. 위에서 다시 신청할 수 있어요.</p>
                  ) : (
                    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
                      <p className="font-jua text-lg text-amber-700">🤝 보증금 {won(SPECIAL_DEPOSIT)} 안내</p>
                      <p className="mt-1">보증금 1만 원을 <b>본인 이름으로</b> 입금해 주세요.<br />특강에 참여하면 <b>현장에서 100% 돌려드려요.</b><br />보증금은 &apos;이 특강, 꼭 함께하자&apos;는 우리 사이의 작은 약속이에요.</p>
                      <p className="mt-3 rounded-xl bg-white p-3 text-center font-bold text-sky-ink">{account || "계좌 안내 준비 중이에요"}</p>
                      <p className="mt-2 text-center">입금자명: <b>{registration.name}</b> · {won(SPECIAL_DEPOSIT)}</p>
                      <p className="mt-1 text-center text-xs text-slate-500">
                        {new Date(Date.parse(registration.created_at) + DEPOSIT_MINUTES * 60 * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}까지 입금해 주세요.
                        <br />신청 후 {DEPOSIT_MINUTES}분 안에 입금이 확인되지 않으면 신청이 자동 취소돼요.
                      </p>
                    </div>
                  )}
                  <p className="rounded-2xl bg-sky-soft p-4 text-sm text-slate-700">특강 당일 10시까지 필기구를 챙겨 {CLASSROOM}로 와주세요.</p>
                </div>
              ) : !canSee ? (
                <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">보증금이 확인된 신청만 지난 특강 자료와 영상을 볼 수 있어요.</p>
              ) : (
                <div className="space-y-3">
                  {event.event_date < today && (
                    <p className="rounded-2xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">📚 지난 특강 · {Number(event.event_date.slice(5, 7))}월 말까지 다시 볼 수 있어요</p>
                  )}
                  {event.material_note && (
                    <div className="rounded-2xl border-2 border-sky-main bg-white p-4 text-center text-[15px] leading-relaxed text-slate-700">
                      {event.material_note.split("\n").map((line, i) =>
                        /^\(.*\)$/.test(line.trim())
                          ? <p key={i} className="mt-1 text-xs font-bold text-red-500">{line}</p>
                          : line.trim() ? <p key={i}>{line}</p> : <p key={i} className="h-3" aria-hidden />,
                      )}
                    </div>
                  )}
                  {materials.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {materials.map((material) => (
                        <a key={material.id} href={`/special/material/${material.id}`} className="btn-ghost !py-2 text-sm">📄 {material.file_name}</a>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-sky-soft p-4 text-sm text-slate-700">{event.event_date < today ? "올라온 자료가 없어요." : "자료는 특강 하루 전에 이 페이지에 올라와요."}</p>
                  )}
                  {event.youtube_id ? (
                    <a href={`https://youtu.be/${event.youtube_id}`} target="_blank" rel="noreferrer" className="btn block w-full text-center">{event.event_date < today ? "📺 특강 다시 보기 ↗" : "🎤 특강 입장하기 ↗"}</a>
                  ) : event.event_date < today ? (
                    <p className="rounded-2xl bg-sky-soft p-4 text-center text-sm text-slate-600">특강 영상이 준비되면 이곳에 올라와요.</p>
                  ) : (
                    <p className="rounded-2xl bg-sky-soft p-4 text-center text-sm font-bold text-sky-ink">
                      📺 특강 링크는 {event.event_date === today ? "특강 시작 전에" : event.event_date === tomorrow ? "내일" : "특강 당일"} 이곳에 올라와요
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          <form action={specialLogout} className="text-center">
            <button className="text-sm text-slate-500 underline">로그아웃 (다른 이름으로 확인하기)</button>
          </form>
        </section>
      ) : (
        <SpecialLogin />
      )}
    </div>
  );
}
