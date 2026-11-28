import Icon from "@/components/Icon";
import IconText from "@/components/IconText";
import { activeStudentApps } from "@/lib/student";
import { expireSpecialDeposits, getProspectByAccount, getSetting, getSpecialRegistrationsFor, listSpecialLectures, listSpecialMaterials, listSpecialRegistrations, specialRegistrationsOfProspect } from "@/lib/db";
import { CLASSROOM, DEPOSIT_MINUTES, SPECIAL_DEPOSIT, won } from "@/lib/config";
import { specialLogout } from "@/app/actions";
import { SPECIAL_CAPACITY, canSeeSpecialMaterials, deadlineBadge, needsDeposit, onsiteTaken, specialConfirmed, specialRegistrationOpen, specialReplay, specialStarted, specialWhen } from "@/lib/special";
import { getAccountId, getPendingLink } from "@/lib/auth";
import { readyProviders } from "@/lib/socialLogin";
import { safe } from "@/lib/safe";
import Link from "next/link";
import GuestForm from "./GuestForm";
import { todayKST } from "@/lib/config";
import SpecialForm from "./SpecialForm";
import { cohortUntil, viewInfo } from "@/lib/viewWindowServer";
import { dayLabelKo, viewPhase } from "@/lib/viewWindow";
import { publicSpecials } from "@/lib/specialPlan";
import SpecialLogin from "./SpecialLogin";
import SocialButtons from "@/components/SocialButtons";
import { loginSetup } from "@/lib/socialServer";

export const dynamic = "force-dynamic";
export const metadata = { title: "특강 신청 · vella_toeic", robots: { index: false } };

export default async function SpecialPage({ searchParams }: { searchParams: Promise<{ expired?: string; guest?: string; student?: string }> }) {
  const { expired, guest, student } = await searchParams;
  await expireSpecialDeposits(DEPOSIT_MINUTES);
  const { apps: myApps } = await activeStudentApps();
  // 비수강생(2026-11-28 Vella): 학원 문자 → 카카오·구글 로그인 + 이름·휴대폰 → 현장 신청 (계정 = 학생 번호, prospects)
  const [accountId, pendingLink] = await Promise.all([safe("special.account", () => getAccountId(), null), safe("special.pending", () => getPendingLink(), null)]);
  const prospect = accountId ? await safe("special.prospect", () => getProspectByAccount(accountId), null) : null;
  const pendingNew = pendingLink && !pendingLink.none ? pendingLink : null; // 처음 로그인한 카카오·구글 (아직 계정 없음)
  const [events, studentRegs, guestRegs, info] = await Promise.all([
    listSpecialLectures().then(publicSpecials),
    getSpecialRegistrationsFor(myApps.map((a) => a.id)),
    prospect ? specialRegistrationsOfProspect(prospect.id) : Promise.resolve([]),
    viewInfo(myApps),
  ]);
  const mine = [...new Map([...studentRegs, ...guestRegs].map((r) => [r.id, r])).values()];
  // 비수강생 화면: ?guest=1, 또는 수강 신청 없이 비수강생 기록·처음 로그인만 있을 때 (?student=1이면 수강생 신청 화면)
  const guestView = guest === "1" || (student !== "1" && myApps.length === 0 && (!!prospect || !!pendingNew));
  const guestLoggedIn = !!accountId || !!pendingNew;
  const account = await getSetting("bank_account");
  // 학생 로그인 방식: 구글·카카오만이면 이름·비밀번호 칸 없이 로그인한 학생으로 신청해요
  const login = await loginSetup();
  const socialOnly = login.mode === "social";
  const loggedIn = myApps.length > 0;
  // 아직 열리지 않은(오늘 이후) 특강은 모두 보여주고, 마감된 것은 '신청이 마감됐어요'로 막아요.
  const today = todayKST();
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 24 * 3600 * 1000).toISOString().slice(0, 10);
  // 로그인한 학생은 신청한 달(기수)의 특강만 (2026-11-27 Vella: 11월 말에 미리 들어온 12월 학생이 11월 특강을 보고 헷갈리지 않게.
  // 특강 신청은 특강 날짜 달 기수 수강생만 할 수 있어요). 로그인 안 한 방문자는 모두 보여요.
  const myMonths = new Set(myApps.map((a) => a.cohort));
  const upcoming = events.filter((event) => event.event_date >= today && (!loggedIn || myMonths.has(event.event_date.slice(0, 7))));
  const open = upcoming.filter((event) => specialRegistrationOpen(event));
  // 현장 정원(90명): 다가오는 특강마다 현장 신청 수 (취소 제외)
  const allUpcoming = events.filter((event) => event.event_date >= today);
  const taken = new Map(await Promise.all(allUpcoming.map(async (e) => [e.id, onsiteTaken(await listSpecialRegistrations(e.id))] as const)));
  const fullOf = (id: string) => (taken.get(id) ?? 0) >= SPECIAL_CAPACITY;
  const appliedIds = new Set(mine.filter((r) => r.deposit !== "cancelled").map((r) => r.special_lecture_id));
  const guestEvents = allUpcoming.map((event) => ({ id: event.id, title: event.title, when: specialWhen(event), closed: !specialRegistrationOpen(event), full: fullOf(event.id), left: Math.max(0, SPECIAL_CAPACITY - (taken.get(event.id) ?? 0)), badge: deadlineBadge(event), mine: appliedIds.has(event.id) }));
  const guestProviders = readyProviders();
  // 이름 칸 미리 채우기: 비수강생 기록 → 수강 신청 이름 → 카카오 별명(한글 2~5자일 때만)
  const nick = pendingNew?.nick?.replace(/\s/g, "") ?? "";
  const guestName = prospect?.name ?? myApps[0]?.name ?? (/^[가-힣]{2,5}$/.test(nick) ? nick : "");
  // 맨 위 글자: 다가오는 첫 특강 요일 (금 → 금요 특강, 토 → 토요 특강, 그 외·없음 → 특강)
  const firstDay = upcoming.length ? new Date(`${[...upcoming].sort((x, y) => x.event_date.localeCompare(y.event_date))[0].event_date}T00:00:00Z`).getUTCDay() : -1;
  const weekdayLabel = firstDay === 5 ? "금요 특강" : firstDay === 6 ? "토요 특강" : "특강";
  const eventById = new Map(events.map((event) => [event.id, event]));
  // 열람 기간: 그 특강 달 기수의 종강일(공식)·실제 마감일(다음 달 개강 전날). 마감일이 지나면 목록에서 빼요.
  const windowOf = async (registration: (typeof mine)[number], event: (typeof events)[number]) => {
    const w = registration.application_id ? info.get(registration.application_id) : undefined;
    const until = w?.until ?? (await cohortUntil(event.event_date.slice(0, 7)));
    return { end: w?.end ?? until, until };
  };
  const myRows = (await Promise.all(
    mine
      .filter((registration) => eventById.has(registration.special_lecture_id))
      .map(async (registration) => {
        const event = eventById.get(registration.special_lecture_id)!;
        const w = await windowOf(registration, event);
        const canSee = canSeeSpecialMaterials(registration, event.event_date, today, w.until);
        // started: 특강 시작 뒤 / past: 시작 2시간 뒤부터 '다시 보기' 단계
        return { registration, event, canSee, w, started: specialStarted(event), past: specialReplay(event), materials: canSee ? await listSpecialMaterials(registration.special_lecture_id) : [] };
      }),
  )).filter((row) => today <= row.w.until);
  // 다가오는 특강이 먼저(가까운 순), 지난 특강은 그 아래(최근 순)
  myRows.sort((a, b) => {
    const pa = a.event.event_date < today, pb = b.event.event_date < today;
    if (pa !== pb) return pa ? 1 : -1;
    return pa ? b.event.event_date.localeCompare(a.event.event_date) : a.event.event_date.localeCompare(b.event.event_date);
  });

  return (
    <div className="stagger wide space-y-6 pt-8">
      {expired && <p className="card !bg-slate-100 flex items-center justify-center gap-2 font-bold text-slate-600"><Icon name="book" size={24} />열람 기간이 끝났어요</p>}
      <div className="text-center">
        <span className="rounded-full bg-sky-main px-4 py-1.5 text-sm font-bold text-sky-ink">{weekdayLabel}</span>
        <h1 className="font-jua mt-3 text-4xl text-sky-ink">{guestView ? "비수강생 특강 신청" : "특강 신청"}</h1>
        <p className="mt-2 text-slate-600">{guestView ? `벨라토익 수강생이 아니어도 현장(${CLASSROOM})에서 들을 수 있어요.` : "현장 또는 불라방으로 신청할 수 있어요."}</p>
      </div>

      {/* 컴퓨터(1024px 이상): 왼쪽 특강 신청 / 오른쪽 내 특강 신청 (휴대폰은 위아래 같은 순서) */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-6">
      {guestView ? (
        <>
          {allUpcoming.length === 0 ? <p className="card text-center text-slate-500">지금 신청할 수 있는 특강이 없어요.</p>
            : !guestLoggedIn ? (
              <div className="card space-y-3 text-center">
                <p className="font-jua text-xl text-sky-ink">카카오·구글로 로그인하고 신청해요</p>
                <p className="text-sm text-slate-600">로그인하면 신청 내용과, 특강에서 본 모의고사 성적을 여기서 확인할 수 있어요.</p>
                {/* 이름+비밀번호로 로그인한 예전 수강생이면 지금 신청에 그 계정을 연결해요(개인번호가 이어져요) */}
                {guestProviders.length > 0 ? <SocialButtons providers={guestProviders} next="/special?guest=1" link={myApps.length > 0} /> : <p className="text-sm text-slate-500">로그인을 준비 중이에요. 잠시 후 다시 들어와 주세요.</p>}
              </div>
            )
            : <GuestForm events={guestEvents} name={guestName} phone={prospect?.phone ?? ""} optIn={prospect?.news_opt_in ?? false} />}
          {pendingNew && (
            <p className="text-center text-sm text-slate-500">전에 벨라토익 교재 신청을 한 적이 있나요? <Link href="/login?next=/special" className="font-bold text-sky-deep underline">내 신청과 연결하기</Link></p>
          )}
          <p className="text-center text-sm text-slate-500">벨라토익 수강생이에요 → <Link href="/special?student=1" className="font-bold text-sky-deep underline">수강생 특강 신청</Link></p>
        </>
      ) : upcoming.length === 0
        ? <p className="card text-center text-slate-500">{loggedIn ? `${[...myMonths].sort().map((m) => `${Number(m.slice(5, 7))}월`).join("·")} 특강이 열리면 여기에 보여요.` : "지금 신청할 수 있는 특강이 없어요."}</p>
        : socialOnly && !loggedIn
          ? (
            <div className="card space-y-3 text-center">
              <p className="font-jua text-xl text-sky-ink">로그인하고 특강을 신청해요</p>
              <p className="text-sm text-slate-600">강의실과 같은 구글·카카오 계정으로 로그인해 주세요.</p>
              <SocialButtons providers={login.providers} next="/special" />
            </div>
          )
          : <SpecialForm needPin={!socialOnly} events={upcoming.map((event) => ({ id: event.id, title: event.title, when: specialWhen(event), closed: !open.includes(event), badge: deadlineBadge(event), full: fullOf(event.id), deposit: needsDeposit(event.event_date) }))} />}
      {!guestView && allUpcoming.length > 0 && (
        <Link href="/special?guest=1" className="card flex items-center justify-between gap-3 !py-4">
          <span>
            <b className="block font-jua text-lg text-sky-ink">벨라토익 수강생이 아니에요</b>
            <span className="text-sm text-slate-600">학원 문자를 받고 오셨나요? 현장 특강은 누구나 신청할 수 있어요.</span>
          </span>
          <span className="shrink-0 font-bold text-sky-deep">신청하기 →</span>
        </Link>
      )}

      </div>
      <div className="space-y-6">
      {prospect?.student_no && (
        <div className="card space-y-2 text-center">
          <p className="text-sm text-slate-600">{prospect.name} · 내 개인번호</p>
          <p className="font-jua text-4xl tracking-[0.2em] text-sky-ink">{prospect.student_no}</p>
          <p className="text-sm text-slate-600">모의고사 답안지 <b>&apos;수험번호&apos;</b> 칸에 적어 주세요.</p>
          <Link href="/class/scores" className="btn-ghost inline-flex !py-2 text-sm"><Icon name="chart" size={20} className="mr-1" />내 모의고사 성적 보기</Link>
        </div>
      )}
      {myRows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-jua text-2xl text-sky-ink">내 특강 신청</h2>
          {myRows.map(({ registration, event, materials, canSee, w, started, past }) => (
            <div key={registration.id} className="card space-y-3">
              {!past && (() => {
                // 다가오는 특강: 신청 상태를 카드 맨 위에 크게
                const banner = registration.deposit === "cancelled"
                  ? { tone: "bg-slate-200 text-slate-600", icon: "", title: "신청이 취소됐어요", sub: "" }
                  : specialConfirmed(registration, event.event_date)
                    ? { tone: "bg-emerald-500 text-white", icon: "check", title: "신청 확정", sub: registration.mode === "online" ? "특강 날 해당 페이지로 입장해요." : `${registration.deposit === "paid" ? "보증금 확인 완료 · " : ""}${specialWhen(event)} · ${CLASSROOM}` }
                    : { tone: "bg-amber-300 text-amber-900", icon: "hourglass", title: "아직 확정 전 · 보증금 입금이 필요해요", sub: "" };
                return (
                  <div className={`-mx-1 rounded-2xl px-4 py-3 text-center ${banner.tone}`}>
                    <p className="flex items-center justify-center gap-2 font-jua text-2xl">{banner.icon && <Icon name={banner.icon} size={28} />}{banner.title}</p>
                    {banner.sub && <p className="mt-0.5 text-sm opacity-90">{banner.sub}</p>}
                  </div>
                );
              })()}
              <div>
                <p className="text-sm text-sky-deep">{specialWhen(event)}</p>
                <p className="font-jua text-xl text-sky-ink"><IconText text={event.title} /> · {registration.mode === "onsite" ? "현장" : "불라방"}</p>
                <p className="text-sm text-slate-500">{registration.name}</p>
              </div>
              {registration.mode === "onsite" && !started ? (
                <div className="space-y-3">
                  {!needsDeposit(event.event_date) ? null : registration.deposit === "paid" ? (
                    <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                      특강에 참여하면 현장에서 보증금 {won(SPECIAL_DEPOSIT)}을 100% 돌려드려요. 그날 만나요!
                    </p>
                  ) : registration.deposit === "review" ? (
                    <p className="rounded-2xl bg-sky-soft p-4 text-sm text-slate-700"><b>입금 대기 · 확인 중이에요.</b><br />Vella쌤이 확인하면 신청이 확정돼요.</p>
                  ) : registration.deposit === "cancelled" ? (
                    <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600"><b>신청이 취소됐어요.</b><br />신청 후 {DEPOSIT_MINUTES}분 안에 보증금 입금이 확인되지 않았어요. 위에서 다시 신청할 수 있어요.</p>
                  ) : (
                    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
                      <p className="flex items-center gap-1.5 font-jua text-lg text-amber-700"><Icon name="people" size={26} />보증금 {won(SPECIAL_DEPOSIT)} 안내</p>
                      <p className="mt-1">보증금 1만 원을 <b>본인 이름으로</b> 입금해 주세요.<br />특강에 참여하면 <b>현장에서 100% 돌려드려요.</b><br />보증금은 &apos;이 특강, 꼭 함께하자&apos;는 우리 사이의 작은 약속이에요.</p>
                      <p className="mt-3 rounded-xl bg-white p-3 text-center font-bold text-sky-ink">{account || "계좌 안내 준비 중이에요"}</p>
                      <p className="mt-2 text-center">입금자명: <b>{registration.name}</b> · {won(SPECIAL_DEPOSIT)}</p>
                      <p className="mt-1 text-center text-xs text-slate-500">
                        {new Date(Date.parse(registration.created_at) + DEPOSIT_MINUTES * 60 * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}까지 입금해 주세요.
                        <br />신청 후 {DEPOSIT_MINUTES}분 안에 입금이 확인되지 않으면 신청이 자동 취소돼요.
                      </p>
                    </div>
                  )}
                  <p className="rounded-2xl bg-sky-soft p-4 text-sm text-slate-700">{specialWhen(event)} · 시작 10분 전까지 필기구를 챙겨 {CLASSROOM}로 와주세요.</p>
                </div>
              ) : !canSee ? (
                <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">{needsDeposit(event.event_date) ? "보증금이 확인된 신청만" : "확정된 신청만"} 지난 특강 자료와 영상을 볼 수 있어요.</p>
              ) : (
                <div className="space-y-3">
                  {past && (
                    <p className="rounded-2xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700"><Icon name="replay" size={20} className="mr-1" />지난 특강 · {viewPhase(w.end, w.until, today) === "extended" ? `${dayLabelKo(w.until)}까지` : `종강일(${dayLabelKo(w.end)})까지`} 다시 볼 수 있어요</p>
                  )}
                  {event.material_note && (
                    <div className="rounded-2xl border-2 border-sky-main bg-white p-4 text-center text-[15px] leading-relaxed text-slate-700">
                      {event.material_note.split("\n").map((line, i) =>
                        /^\(.*\)$/.test(line.trim())
                          ? <p key={i} className="mt-1 text-xs font-bold text-red-500"><IconText text={line} /></p>
                          : line.trim() ? <p key={i}><IconText text={line} /></p> : <p key={i} className="h-3" aria-hidden />,
                      )}
                    </div>
                  )}
                  {materials.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {materials.map((material) => (
                        <a key={material.id} href={`/special/material/${material.id}`} target="_blank" rel="noreferrer" className="btn-ghost gap-1.5 !py-2 text-sm"><Icon name="doc" size={20} />{material.file_name}</a>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-sky-soft p-4 text-sm text-slate-700">{past ? "올라온 자료가 없어요." : "자료는 특강 하루 전에 이 페이지에 올라와요."}</p>
                  )}
                  {event.youtube_id ? (
                    <a href={`https://youtu.be/${event.youtube_id}`} target="_blank" rel="noreferrer" className="btn flex w-full items-center justify-center gap-2 text-center"><Icon name={past ? "replay" : "mic"} size={28} />{past ? "특강 다시 보기 ↗" : "특강 입장하기 ↗"}</a>
                  ) : past ? (
                    <p className="rounded-2xl bg-sky-soft p-4 text-center text-sm text-slate-600">특강 영상이 준비되면 이곳에 올라와요.</p>
                  ) : (
                    <p className="rounded-2xl bg-sky-soft p-4 text-center text-sm font-bold text-sky-ink">
                      <Icon name="laptop" size={22} className="mr-1" />특강 링크는 {event.event_date === today ? "특강 시작 전에" : event.event_date === tomorrow ? "내일" : "특강 당일"} 이곳에 올라와요
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
      ) : guestView || (login.mode !== "pin" && loggedIn) ? null : (
        <SpecialLogin providers={login.providers} pin={login.pin} />
      )}
      </div>
      </div>
    </div>
  );
}
