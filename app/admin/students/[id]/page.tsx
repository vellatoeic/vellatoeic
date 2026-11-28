import { DESK } from "@/lib/config";
import Icon from "@/components/Icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOKS, COURSES, KINDS, TRACKS, classSlotLabel, bookStatusLabel, cohortLabel, todayKST, won } from "@/lib/config";
import { getApplication, getSpecialRegistrationsFor, isPreview, listApplications, listMissions, listSpecialLectures, listStamps, listTestResults } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { classDaysOf, holidaysOf } from "@/lib/classCalendar";
import { isHomeworkStickerEligible } from "@/lib/schedule";
import { needsDeposit, specialDay } from "@/lib/special";
import { TEST_LABEL } from "@/lib/tests";
import { missionCount } from "@/lib/mission";
import { watchSummary } from "@/lib/watchlist";
import { changeCohort, cycleAttendance, cycleHomework, extendAudio, unlinkLogin, viewAsStudent } from "@/app/actions";
import { listLoginLinks, getStudentProfiles } from "@/lib/db";
import { phoneLabel as profilePhone, reasonLabel } from "@/lib/profile";
import { PROVIDER_LABEL } from "@/lib/socialLogin";
import { movableCohorts } from "@/lib/cohortMove";
import { thisMonthKST } from "@/lib/config";
import CloseOnSubmitForm from "../../CloseOnSubmitForm";
import { getSetting } from "@/lib/db";
import { defaultHolidays, holidayKey, parseHolidays, schoolDaysFor, scheduleClassFor, scheduleKey } from "@/lib/schedule";
import StickerBoard from "@/app/class/StickerBoard";
import AdminTabs from "../../AdminTabs";
import LoginForm from "../../LoginForm";
import { studentDays } from "@/lib/studentDays";
import { audioBooksFor, studentAudioWindow } from "@/lib/audio";
import { visibleToAdmin } from "@/lib/cancellations";
import { GRADE_LABEL, gradeOf, groupStudents, seenLabel } from "@/lib/grades";
import { cohortWindows } from "@/lib/viewWindowServer";
import { STATUS_SHORT, monthLabel, photoOf } from "@/lib/rosterServer";
import { examResultsByNos } from "@/lib/db";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata = { title: "학생 정보 · vella_toeic", robots: { index: false } };

const STATUS = { pending: "미납", paid: "납부 완료", shipped: "납부 완료", refunded: "환불", cancelled: "취소" } as const;
const DEPOSIT = { pending: "보증금 대기", review: "입금 확인 중", paid: "보증금 확정", cancelled: "취소" } as const;

// 학생 한 명의 모든 정보: 신청·납부·교재 / 출석·숙제·테스트 / 미션 / 특강 / 수강 이력
export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mv?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { id } = await params;
  const { mv = "" } = await searchParams;
  const a = await getApplication(id);
  if (!a) notFound();
  const today = todayKST();
  const [days, holidays, { attendance, homework }, tests, [mission], regs, events, apps] = await Promise.all([
    classDaysOf(a), holidaysOf(a.cohort), listStamps([a.id]), listTestResults({ cohort: a.cohort, appIds: [a.id] }),
    listMissions([a.id]), getSpecialRegistrationsFor([a.id]), listSpecialLectures(), listApplications(),
  ]);
  const classDays = days.filter((d) => !holidays[d]);
  // 학생 강의실과 똑같은 스티커판 (보기 전용)
  const klass = scheduleClassFor(a.course, a.track);
  const [rawDays, rawHolidays, cafeUrl] = await Promise.all([getSetting(scheduleKey(a.cohort, klass)), getSetting(holidayKey(a.cohort)), getSetting("cafe_homework_url")]);
  const offDays = attendance.map((x) => x.day).filter((d) => !classDays.includes(d));
  const all = [...new Set([...classDays, ...offDays])].sort();
  const lastDay = classDays.at(-1) ?? ""; // 마지막 수업일은 숙제 없이 출석만
  const s = watchSummary(studentDays(classDays, a.created_at), attendance, homework.map((h) => h.day), today);
  const testsOf = (d: string) => tests.filter((t) => t.day === d).sort((x, y) => x.kind.localeCompare(y.kind) || x.test_no - y.test_no);
  const pct = (kind: "word" | "rc") => {
    const list = tests.filter((t) => t.kind === kind);
    return list.length ? Math.round((list.reduce((sum, t) => sum + t.score / t.questions, 0) / list.length) * 100) : null;
  };
  const eventById = new Map(events.map((e) => [e.id, e]));
  const audioWin = audioBooksFor(a).length > 0 ? await studentAudioWindow(a) : null;
  // 같은 학생(개인번호 → 카카오·구글 번호로 묶음, 학생 명단과 같은 규칙)의 모든 달 신청
  const group = groupStudents(apps.filter(visibleToAdmin)).find((g) => g.some((x) => x.id === a.id)) ?? [a];
  const no = a.student_no ?? group.find((x) => x.student_no)?.student_no ?? null;
  const accounts = [...new Set(group.map((x) => x.account_id).filter((x): x is string => !!x))];
  // 학생 '내 정보'(휴대폰 · 목표 점수 · 공부 이유 · 마지막 로그인 · 최근 접속) · 연결된 구글·카카오 로그인 · 등급 · 모의고사
  const [profile, links, windows, exams] = await Promise.all([
    no ? getStudentProfiles([no]).then((x) => x[0] ?? null).catch(() => null) : Promise.resolve(null),
    accounts.length ? listLoginLinks(accounts) : Promise.resolve([]),
    safe("student.windows", () => cohortWindows(group.map((x) => x.cohort)), new Map()),
    no ? safe("student.exams", () => examResultsByNos([no]), []) : Promise.resolve([]),
  ]);
  const grade = gradeOf(group, windows, today, Date.now());
  const photo = photoOf(links);
  const VIA: Record<string, string> = { pin: "이름+비밀번호", kakao: "카카오", google: "구글" };
  const at = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  // 수강 이력: 같은 학생의 모든 달 + 이름만 같은 다른 신청(동명이인일 수 있어요) — 최신 달이 위
  const groupIds = new Set(group.map((x) => x.id));
  const bare = (n: string) => n.replace(/\s/g, "");
  const history = apps.filter((x) => groupIds.has(x.id) || bare(x.name) === bare(a.name)).sort((x, y) => y.cohort.localeCompare(x.cohort) || y.created_at.localeCompare(x.created_at));
  const phone = a.phone?.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3");
  const chip = "rounded-full px-2.5 py-0.5 text-xs font-bold";

  return (
    <div className="space-y-5 pt-8">
      <AdminTabs active="students" />
      {mv && (() => {
        const [target, n, changed, errors] = mv.split("|");
        return (
          <div className="space-y-1 rounded-3xl border-2 border-sky-main bg-white p-4 text-sm">
            {Number(n) > 0 && <p className="font-jua text-lg text-sky-ink"><Icon name="repeat" size={22} className="mr-1" />{cohortLabel(target)}(으)로 옮겼어요 · 교재를 새 기수 회차로 다시 계산했어요</p>}
            {changed && <p className="font-bold text-amber-700"><Icon name="coins" size={20} className="mr-1" />금액 변경됨: {changed}</p>}
            {errors && <p className="font-bold text-red-600"><Icon name="alert" size={20} className="mr-1" />옮기지 못함: {errors}</p>}
          </div>
        );
      })()}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" referrerPolicy="no-referrer" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-sky-main" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-sky-soft font-jua text-2xl text-sky-deep">{a.name.slice(0, 1)}</span>
          )}
          <div>
            <p className="text-sm text-slate-500">{cohortLabel(a.cohort)} · {classSlotLabel(a)} · {KINDS[a.kind].short}</p>
            <h2 className="font-jua text-3xl text-sky-ink">{a.name}{no && <span className="ml-2 align-middle font-body text-base font-bold tracking-widest text-sky-deep" title="모의고사 개인번호">#{no}</span>}</h2>
            {/* 등급(날짜로 자동) · 로그인 방법 · 최근 접속 */}
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {grade.grades.includes("student") && <span className={`${chip} bg-emerald-100 text-emerald-700`}>{GRADE_LABEL.student} · {grade.current.map((c) => `${Number(c.slice(5, 7))}월`).join("·")}</span>}
              {grade.pre.map((p) => <span key={p.cohort} className={`${chip} ${p.pending ? "bg-amber-100 text-amber-700" : "bg-sky-main/60 text-sky-ink"}`}>{Number(p.cohort.slice(5, 7))}월 {GRADE_LABEL.pre}{p.pending ? " · 입금 대기" : ""}</span>)}
              {grade.grades.includes("general") && <span className={`${chip} bg-slate-100 text-slate-500`}>{GRADE_LABEL.general}</span>}
              {links.length === 0 ? <span className={`${chip} bg-slate-100 text-slate-500`}>이름+비밀번호</span> : [...new Set(links.map((l) => l.provider))].map((p) => (
                <span key={p} className={`${chip} ${p === "kakao" ? "bg-[#fee500] text-[#3c1e1e]" : "bg-white text-slate-700 ring-1 ring-slate-300"}`}>{PROVIDER_LABEL[p]}</span>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              최근 접속 <b className="text-sky-ink">{seenLabel(profile?.last_seen_at, today)}</b>
              {profile?.last_login_at && <> · 마지막 로그인 {VIA[profile.last_login_via ?? ""] ?? ""} {at(profile.last_login_at)}</>}
            </p>
            {profile && (
              <p className="mt-1 text-sm text-slate-600">
                {profile.phone && <>휴대폰 <b>{profilePhone(profile.phone)}</b> · </>}
                {profile.target_score && <>목표 <b>{profile.target_score}점</b> · </>}
                {profile.reasons.length > 0 && <>이유 {profile.reasons.map(reasonLabel).join(", ")}{profile.reason_note ? ` (${profile.reason_note})` : ""}</>}
              </p>
            )}
          </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* 이 학생이 보는 화면(대시보드·강의실)을 보기 전용으로 열어요 */}
            <form action={viewAsStudent}>
              <input type="hidden" name="app_id" value={a.id} />
              <button className="btn !py-2 !text-sm">이 학생 화면으로 보기</button>
            </form>
            <Link href={`/admin?c=${a.cohort}&q=${encodeURIComponent(a.name)}`} className="btn-ghost !py-2 text-sm">신청 관리에서 바꾸기 (납부·반·시간·환불)</Link>
            <details className="relative text-sm">
              <summary className="btn-ghost cursor-pointer list-none !py-2">기수 변경</summary>
              <CloseOnSubmitForm action={changeCohort} className="absolute right-0 z-20 mt-1 flex gap-2 rounded-2xl bg-white p-3 shadow-lg">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="back" value={`/admin/students/${a.id}`} />
                <select name="cohort" className="input !w-40 !py-2">
                  {movableCohorts(thisMonthKST()).filter((x) => x !== a.cohort).map((x) => <option key={x} value={x}>{cohortLabel(x)}</option>)}
                </select>
                <label className="flex items-center gap-1 whitespace-nowrap text-xs text-slate-500"><input type="checkbox" name="force" value="1" className="h-4 w-4" />같은 이름이 있어도 옮기기</label>
                <button className="btn whitespace-nowrap !py-2 !text-sm">옮기기</button>
              </CloseOnSubmitForm>
            </details>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`${chip} ${a.status === "pending" ? "bg-amber-100 text-amber-700" : a.status === "refunded" ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{STATUS[a.status]}</span>
          {a.kind === "online" && <span className={`${chip} bg-sky-soft text-sky-ink`}>교재 {a.pickup === "delivery" ? "택배" : `현장 수령(${DESK})`} · {bookStatusLabel(a)}</span>}
          {a.continuing && <span className={`${chip} bg-slate-100 text-slate-600`}>이어듣기</span>}
          <span className={`${chip} ${missionCount(mission) === 4 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>미션 {missionCount(mission)}/4</span>
        </div>
        <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
          <dt className="text-slate-500">교재비</dt><dd>{won(a.amount)} · {a.books.map((b) => BOOKS[b]).join(", ")}{a.depositor !== a.name ? ` · 입금자 ${a.depositor}` : ""}</dd>
          {phone && <><dt className="text-slate-500">연락처</dt><dd>{phone}</dd></>}
          {a.address && <><dt className="text-slate-500">주소</dt><dd>{a.address}</dd></>}
          <dt className="text-slate-500">신청</dt><dd>{new Date(a.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</dd>
        </dl>
        {audioWin && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-sky-soft p-3 text-sm">
            <span><Icon name="headphones" size={18} className="mr-1" />LC 음원 기간 <b className="text-sky-ink">{specialDay(audioWin.start)} ~ {specialDay(audioWin.end)}</b>{audioWin.end < today ? " (지남)" : ""}{a.audio_extended_until ? " · 다시 열어 줌" : ""}</span>
            <form action={extendAudio} className="ml-auto">
              <input type="hidden" name="id" value={a.id} />
              <button className="btn-ghost !py-1.5 text-sm">음원 7일 다시 열기</button>
            </form>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
          <span className="font-bold text-slate-600">로그인 연결</span>
          {links.length === 0 ? (
            <span className="text-slate-500">없음 (이름 + 비밀번호로만 들어와요)</span>
          ) : links.map((l) => (
            <form key={`${l.provider}:${l.subject}`} action={unlinkLogin} className="flex items-center gap-2 rounded-full bg-white px-3 py-1">
              <input type="hidden" name="provider" value={l.provider} />
              <input type="hidden" name="subject" value={l.subject} />
              <input type="hidden" name="id" value={a.id} />
              {l.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.photo_url} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover" />
              )}
              <span>
                {PROVIDER_LABEL[l.provider]}{l.email || l.nickname ? ` · ${l.email ?? l.nickname}` : ""}
                {l.last_login_at && <span className="text-slate-400"> · 마지막 {new Date(l.last_login_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" })}</span>}
              </span>
              <button className="text-xs font-bold text-red-600 underline">연결 끊기</button>
            </form>
          ))}
        </div>
        {mission?.intro_at && (
          <p className="rounded-2xl bg-sky-soft p-3 text-sm text-slate-600">
            <Icon name="clipboard" size={16} className="mr-1" />{mission.prev_score} → 목표 {mission.target_score} · 시험 {mission.exam_month}
            {mission.affiliation && ` · ${mission.affiliation}`}{mission.instagram && ` · ${mission.instagram}`}
            {mission.message && <span className="block text-sky-ink">“{mission.message}”</span>}
          </p>
        )}
      </section>

      <section className="card space-y-2">
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[
            { label: "출석", value: `${s.attended}/${s.past}`, sub: s.late ? `지각 ${s.late}` : "지난 수업 기준" },
            { label: "결석", value: `${s.absent}회`, sub: s.streak ? `최근 ${s.streak}회 연속` : "연속 결석 없음", warn: s.absent >= 3 || s.streak >= 2 },
            { label: "숙제", value: `${s.hwDue - s.hwMissing}/${s.hwDue}`, sub: `별 ${homework.filter((h) => isHomeworkStickerEligible(h.day, h.created_at)).length}개`, warn: s.hwMissing >= 3 },
            { label: "테스트 평균", value: tests.length ? `${pct("rc") ?? "-"}%` : "-", sub: tests.length ? `RC · 단어 ${pct("word") ?? "-"}% · ${tests.length}회 제출` : "제출 기록 없음" },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl bg-sky-soft p-2.5">
              <p className="text-xs text-slate-500">{x.label}</p>
              <p className={`font-jua text-2xl ${x.warn ? "text-red-500" : "text-sky-ink"}`}>{x.value}</p>
              <p className="text-[11px] text-slate-400">{x.sub}</p>
            </div>
          ))}
        </div>
        {s.reasons.length > 0 && <p className="flex flex-wrap gap-1">{s.reasons.map((r) => <span key={r} className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600"><Icon name="siren" size={14} className="mr-1" />{r}</span>)}</p>}
      </section>

      {(regs.length > 0 || history.length > 1 || exams.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {exams.length > 0 && (
            <section className="card text-sm">
              <p className="flex items-center gap-1 font-jua text-lg text-sky-ink"><Icon name="chart" size={24} />모의고사 <span className="text-sm text-slate-400">({exams.length}회 · 최근이 위)</span></p>
              <ul className="mt-2 divide-y divide-sky-soft">
                {exams.slice(0, 6).map((r) => (
                  <li key={r.result_id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="text-slate-500">{Number(r.exam_date.slice(5, 7))}/{Number(r.exam_date.slice(8, 10))}</span>
                    <span className="flex-1 text-slate-700">{r.exam_title}</span>
                    {r.blank_sheet ? <span className="text-slate-400">채점 못 함</span> : <><b className="font-jua text-lg text-sky-ink">{r.total}</b><span className="text-xs text-slate-500">LC {r.lc_score} · RC {r.rc_score}</span></>}
                  </li>
                ))}
              </ul>
              <Link href="/admin/scores" className="mt-1 inline-block text-xs text-sky-deep underline">모의고사 관리로</Link>
            </section>
          )}
          {regs.length > 0 && (
            <section className="card text-sm">
              <p className="flex items-center gap-1 font-jua text-lg text-sky-ink"><Icon name="mic" size={24} />특강 신청</p>
              <ul className="mt-2 divide-y divide-sky-soft">
                {[...regs].sort((x, y) => y.created_at.localeCompare(x.created_at)).map((r) => {
                  const e = eventById.get(r.special_lecture_id);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                      <b className="text-sky-ink">{e ? `${specialDay(e.event_date)} ${e.title}` : "특강"}</b>
                      <span className="text-slate-500">{r.mode === "onsite" ? `현장 · ${r.deposit == null && e && !needsDeposit(e.event_date) ? "확정" : DEPOSIT[r.deposit ?? "pending"]}` : "불라방"}</span>
                      {r.deposit_refunded_at && <span className={`${chip} bg-emerald-100 text-emerald-700`}>보증금 환불 완료</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {history.length > 1 && (
            <section className="card text-sm">
              <p className="flex items-center gap-1 font-jua text-lg text-sky-ink"><Icon name="book" size={24} />수강 이력 <span className="text-sm text-slate-400">(최근 달이 위)</span></p>
              <ul className="mt-2 divide-y divide-sky-soft">
                {history.map((h) => (
                  <li key={h.id} className="py-2">
                    {h.id === a.id ? <b className="text-sky-ink"><Icon name="play" size={16} className="mr-1" />{monthLabel(h)} (지금 보는 신청)</b> : (
                      <Link href={`/admin/students/${h.id}`} className="text-sky-deep underline">{monthLabel(h)}</Link>
                    )}
                    <span className={`ml-2 text-xs ${h.status === "pending" ? "font-bold text-amber-600" : "text-slate-400"}`}>{h.status === "cancelled" && h.cancel_reason === "timeout" ? "자동 취소됨" : STATUS_SHORT[h.status]}</span>
                    {!groupIds.has(h.id) && <span className="ml-1 text-xs text-amber-600">(이름만 같음 · 동명이인일 수 있어요)</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[400px_1fr]">
      <div className="mx-auto w-full max-w-[400px]">
        <StickerBoard
          appId={a.id}
          name={a.name}
          cohort={a.cohort}
          className={`${COURSES[a.course].label} ${TRACKS[a.track]}`}
          klass={klass}
          scheduleDays={studentDays(schoolDaysFor(rawDays, a.cohort, klass).filter((d) => !(rawHolidays ? parseHolidays(rawHolidays, a.cohort) : defaultHolidays(a.cohort))[d]), a.created_at)}
          holidays={rawHolidays ? parseHolidays(rawHolidays, a.cohort) : defaultHolidays(a.cohort)}
          attendance={attendance}
          homework={homework.map(({ day, created_at }) => ({ day, created_at }))}
          cafeUrl={cafeUrl}
          today={today}
          welcome={missionCount(mission) === 4}
          readOnly
        />
      </div>
      <section className="card !p-4">
        <p className="flex items-center gap-1 font-jua px-1 text-lg text-sky-ink"><Icon name="calendar" size={24} />날짜별 출석·숙제·테스트 (고치기)</p>
        <p className="px-1 text-xs text-slate-500">출석 칸을 누르면 출석 → 지각 → 결석 순서로 바뀌어요. 숙제를 누르면 기록을 취소해요.</p>
        <ul className="mt-2 divide-y divide-sky-soft">
          {all.map((d) => {
            const att = attendance.find((x) => x.day === d);
            const hw = homework.find((x) => x.day === d);
            const star = !!hw && isHomeworkStickerEligible(d, hw.created_at);
            const off = !classDays.includes(d);
            return (
              <li key={d} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className={`w-24 font-bold ${off ? "text-amber-600" : "text-sky-ink"}`}>{specialDay(d)}{off ? " · 수업 없음" : ""}</span>
                {d > today ? <span className="text-slate-300">아직</span> : (
                  <form action={cycleAttendance}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="day" value={d} />
                    <button className="rounded-full bg-sky-soft px-3 py-1 font-bold" title="누르면 출석 → 지각 → 결석 순서로 바뀌어요">
                      {att ? (att.late ? "◐ 지각" : "● 출석") : d === today ? "○ 아직" : "· 결석"}
                    </button>
                  </form>
                )}
                {d === lastDay && !hw ? <span className="text-xs text-slate-400">마지막 날 · 출석만</span> : d > today && !hw ? null : (
                  // 누를 때마다 없음 → ⭐ 숙제 → 없음 (늦은 숙제 ✓는 누르면 ⭐)
                  <form action={cycleHomework}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="day" value={d} />
                    <button className={`rounded-full px-3 py-1 ${star ? "bg-amber-100 font-bold text-amber-700" : hw ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-400"}`} title="누르면 없음 → 별 숙제 → 없음 순서로 바뀌어요">
                      {star ? <><Icon name="star" size={16} className="mr-0.5" />숙제</> : hw ? "✓ 숙제(늦음) → 눌러서 별" : "· 숙제 없음"}
                    </button>
                  </form>
                )}
                {testsOf(d).map((t) => (
                  <span key={t.id} className="rounded-full bg-white px-3 py-1 ring-1 ring-sky-main"><Icon name="stopwatch" size={16} className="mr-1" />{TEST_LABEL[t.kind]} {t.test_no} · <b className="text-sky-ink">{t.score}/{t.questions}</b></span>
                ))}
              </li>
            );
          })}
        </ul>
      </section>
      </div>
    </div>
  );
}
