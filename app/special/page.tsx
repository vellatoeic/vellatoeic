import Link from "next/link";
import { getStudentIds } from "@/lib/auth";
import { canWatch } from "@/lib/access";
import { getApplications, getSetting, listSpecialLectures, listSpecialMaterials, listSpecialRegistrations } from "@/lib/db";
import { todayKST, cohortLabel, CLASSROOM, COURSES, KINDS, TRACKS, won } from "@/lib/config";
import StudentLogin from "@/app/class/StudentLogin";
import { registerSpecialLecture } from "@/app/actions";
import { specialRegistrationOpen } from "@/lib/special";

export const dynamic = "force-dynamic";
export const metadata = { title: "특강 신청 · vella_toeic", robots: { index: false } };

function clock(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

export default async function SpecialPage() {
  const studentIds = await getStudentIds();
  if (studentIds.length === 0) return <StudentLogin next="/special" note="토요일 특강 신청은 강의실 로그인 후 할 수 있어요." />;

  const [applications, events, account] = await Promise.all([
    getApplications(studentIds),
    listSpecialLectures(),
    getSetting("bank_account"),
  ]);
  const paid = applications.filter(canWatch);
  const now = todayKST();
  const eventRows = await Promise.all(events.map(async (event) => {
    const eligible = paid.filter((app) => app.cohort === event.cohort);
    const registrations = await listSpecialRegistrations(event.id);
    const existing = registrations.find((registration) => studentIds.includes(registration.application_id));
    const application = existing
      ? eligible.find((app) => app.id === existing.application_id)
      : eligible[0];
    const materials = existing?.mode === "online" && existing.approved ? await listSpecialMaterials(event.id) : [];
    const videoUrl = existing?.mode === "online" && existing.approved && event.youtube_id ? `https://youtu.be/${event.youtube_id}` : "";
    return { event, eligible, existing, application, materials, videoUrl };
  }));

  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <span className="rounded-full bg-sky-main px-4 py-1.5 text-sm font-bold text-sky-ink">10월 특강</span>
        <h1 className="font-jua mt-3 text-4xl text-sky-ink">특강 신청</h1>
        <p className="mt-2 text-slate-600">현장 또는 불라방으로 신청할 수 있어요.</p>
      </div>

      {events.length === 0 && <p className="card text-center text-slate-500">아직 신청 가능한 특강이 없어요.</p>}

      {eventRows.map(({ event, eligible, existing, application, materials, videoUrl }) => {
        const canRegister = !existing && !!application && specialRegistrationOpen(event.event_date, event.starts_at);

        return (
          <section key={event.id} className="card space-y-4">
            <div>
              <p className="text-sm text-sky-deep">{cohortLabel(event.cohort)} · {event.event_date}</p>
              <h2 className="font-jua text-2xl text-sky-ink">{event.title}</h2>
              <p className="mt-1 text-slate-600">{event.ends_at ? `${clock(event.starts_at)}~${clock(event.ends_at)}` : `${clock(event.starts_at)} 시작 · 끝날 때까지`}</p>
            </div>

            {!application ? (
              <p className="rounded-2xl bg-sky-soft p-4 text-sm text-slate-600">이 특강 기수에 납부 확인된 수강 신청이 없어요. 실제 수강생만 신청할 수 있어요.</p>
            ) : existing ? (
              <div className="space-y-3 rounded-2xl bg-sky-soft p-4">
                <p className="font-jua text-lg text-sky-ink">{existing.mode === "onsite" ? "현장 신청" : "불라방 신청"} · {existing.approved ? "신청 확인 완료" : "신청 확인 중"}</p>
                {existing.mode === "onsite" ? (
                  <div className="space-y-1 text-sm text-slate-700">
                    <p>보증금 {won(10000)} · {existing.deposit_paid ? "입금 확인 완료" : "아래 계좌로 입금해 주세요"}</p>
                    {!existing.deposit_paid && <p className="rounded-xl bg-white p-3 font-bold text-sky-ink">{account || "계좌 안내 준비 중이에요"}</p>}
                    <p>{event.event_date} 오전 {clock(event.starts_at)}까지 필기구와 함께 {CLASSROOM}로 와주세요.</p>
                    <p>특강에 참석하면 보증금 {won(10000)}을 전액 환급해요.</p>
                    {existing.attended && <p className="font-bold text-emerald-700">참석 확인 완료 {existing.refunded ? "· 보증금 환급 완료" : "· 환급 처리 중이에요"}</p>}
                  </div>
                ) : (
                  <div className="space-y-3 text-sm text-slate-700">
                    {existing.approved ? <p>신청 확인이 완료됐어요. 아래에서 자료를 받고 라이브를 시청할 수 있어요.</p> : <p>무료 신청이 접수됐어요. 관리자가 신청을 확인하면 자료와 영상이 열려요.</p>}
                    {existing.approved && (
                      <div className="flex flex-wrap gap-2">
                        {materials.map((material) => <a key={material.id} href={`/special/material/${material.id}`} className="btn-ghost !py-2">자료 받기 · {material.file_name}</a>)}
                        {videoUrl && <a href={videoUrl} target="_blank" rel="noreferrer" className="btn !py-2 !text-sm">유튜브 특강 보기 ↗</a>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : canRegister ? (
              <form action={registerSpecialLecture} className="space-y-3 rounded-2xl bg-sky-soft p-4">
                {eligible.length > 1 && (
                  <label className="block">
                    <span className="label">수강 신청</span>
                    <select name="application_id" defaultValue={application.id} className="input">
                      {eligible.map((app) => <option key={app.id} value={app.id}>{COURSES[app.course].label} {TRACKS[app.track]}</option>)}
                    </select>
                  </label>
                )}
                {eligible.length === 1 && <input type="hidden" name="application_id" value={application.id} />}
                <input type="hidden" name="event_id" value={event.id} />
                <p className="text-sm text-slate-700">신청자: {application.name} · {KINDS[application.kind].label}</p>
                <label className="flex items-start gap-3 rounded-xl bg-white p-3">
                  <input type="radio" name="mode" value="onsite" required className="mt-1 accent-sky-deep" />
                  <span><b className="block text-sky-ink">현장 참여 · 보증금 1만원</b><span className="text-sm text-slate-600">참석하면 보증금 전액을 환급해요.</span></span>
                </label>
                <label className="flex items-start gap-3 rounded-xl bg-white p-3">
                  <input type="radio" name="mode" value="online" required className="mt-1 accent-sky-deep" />
                  <span><b className="block text-sky-ink">불라방 참여 · 무료</b><span className="text-sm text-slate-600">신청 확인 후 자료와 유튜브 링크가 열려요.</span></span>
                </label>
                <button className="btn w-full">특강 신청하기</button>
              </form>
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">신청 기간이 끝났어요.</p>
            )}
          </section>
        );
      })}
      <Link href="/class" className="btn-ghost w-full">강의실로 돌아가기</Link>
    </div>
  );
}
