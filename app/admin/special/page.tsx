import { isAdmin } from "@/lib/auth";
import { listApplications, listSpecialLectures, listSpecialMaterials, listSpecialRegistrations, isPreview, type Application, type SpecialRegistration } from "@/lib/db";
import { confirmSpecialAttendance, confirmSpecialRegistration, markSpecialRefunded, saveSpecialLecture } from "@/app/actions";
import { cohortLabel, COURSES, KINDS, TRACKS } from "@/lib/config";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import MaterialUpload from "./MaterialUpload";

export const dynamic = "force-dynamic";
export const metadata = { title: "특강 관리 · vella_toeic", robots: { index: false } };

function timeLabel(value: string | null) {
  return value ? value.slice(0, 5) : "끝날 때까지";
}

function RegistrationRow({ registration, app }: { registration: SpecialRegistration; app?: Application }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-bold text-sky-ink">{app?.name ?? "신청자"} · {registration.mode === "onsite" ? "특강 현장 참여" : "특강 불라방"}</p>
        {app && <p className="text-xs text-slate-500">{KINDS[app.kind].short} 수강 · {COURSES[app.course].label} {TRACKS[app.track]}</p>}
        <p className="text-xs text-slate-500">
          {registration.mode === "online" ? registration.approved ? "신청 확인 완료 · 자료 공개" : "신청 확인 대기" : `보증금 ${registration.deposit_paid ? "입금 확인" : "입금 대기"} · 참석 ${registration.attended ? "확인" : "미확인"} · 환급 ${registration.refunded ? "완료" : "대기"}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!registration.approved && <form action={confirmSpecialRegistration}><input type="hidden" name="id" value={registration.id} /><button className="btn-ghost !py-2">{registration.mode === "onsite" ? "보증금 입금 확인" : "불라방 신청 확인"}</button></form>}
        {registration.mode === "onsite" && registration.approved && !registration.attended && <form action={confirmSpecialAttendance}><input type="hidden" name="id" value={registration.id} /><button className="btn-ghost !py-2">참석 확인</button></form>}
        {registration.mode === "onsite" && registration.attended && !registration.refunded && <form action={markSpecialRefunded}><input type="hidden" name="id" value={registration.id} /><button className="btn !py-2 !text-sm">1만원 환급 완료</button></form>}
      </div>
    </li>
  );
}

export default async function SpecialAdminPage() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const [events, applications] = await Promise.all([listSpecialLectures(), listApplications()]);
  const applicationById = new Map(applications.map((app) => [app.id, app]));
  const eventRows = await Promise.all(events.map(async (event) => ({
    event,
    registrations: await listSpecialRegistrations(event.id),
    materials: await listSpecialMaterials(event.id),
  })));

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="special" />
      <div className="card space-y-2 text-sm text-slate-600">
        <p className="font-jua text-lg text-sky-ink">특강 운영 안내</p>
        <p>현장 신청은 1만원 보증금을 확인해 주세요. 특강에 참석하면 100% 환급해요.</p>
        <p>불라방은 무료예요. 신청을 확인하면 이 페이지에서 자료와 유튜브 링크를 볼 수 있어요.</p>
      </div>

      {eventRows.map(({ event, registrations, materials }) => {
        const onsiteCount = registrations.filter((registration) => registration.mode === "onsite").length;
        const onlineCount = registrations.filter((registration) => registration.mode === "online").length;
        const onsiteRegistrations = registrations.filter((registration) => registration.mode === "onsite");
        const onlineRegistrations = registrations.filter((registration) => registration.mode === "online");
        return (
          <section key={event.id} className="card space-y-5">
            <div>
              <p className="text-sm text-slate-500">{cohortLabel(event.cohort)} · {event.event_date}</p>
              <h2 className="font-jua text-2xl text-sky-ink">{event.title}</h2>
              <p className="text-sm text-slate-600">{timeLabel(event.starts_at)} ~ {timeLabel(event.ends_at)} · 현장 {onsiteCount}명 · 불라방 {onlineCount}명</p>
            </div>

            <form action={saveSpecialLecture} className="grid gap-3 rounded-2xl bg-sky-soft p-4">
              <input type="hidden" name="id" value={event.id} />
              <label><span className="label">특강 제목</span><input name="title" defaultValue={event.title} required className="input" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className="label">시작 시각</span><input type="time" name="starts_at" defaultValue={event.starts_at.slice(0, 5)} required className="input" /></label>
                <label><span className="label">종료 시각 (모르면 비워두기)</span><input type="time" name="ends_at" defaultValue={event.ends_at?.slice(0, 5) ?? ""} className="input" /></label>
              </div>
              <label><span className="label">불라방 유튜브 링크</span><input type="url" name="youtube_url" defaultValue={event.youtube_id ? `https://youtu.be/${event.youtube_id}` : ""} placeholder="https://youtu.be/..." className="input" /></label>
              <button className="btn-ghost justify-self-start">특강 정보 저장</button>
            </form>

            <div className="rounded-2xl border border-sky-main/60 p-4">
              <h3 className="font-jua text-lg text-sky-ink">불라방 자료</h3>
              {materials.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {materials.map((material) => (
                    <li key={material.id}>
                      <a href={`/special/material/${material.id}`} target="_blank" rel="noreferrer" className="text-sky-deep underline">{material.file_name}</a>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-slate-500">아직 올린 자료가 없어요.</p>}
              <MaterialUpload eventId={event.id} />
            </div>

            <div>
              <h3 className="font-jua text-lg text-sky-ink">신청자 {registrations.length}명</h3>
              {registrations.length === 0 && <p className="mt-2 text-sm text-slate-500">아직 신청자가 없어요.</p>}
              {[
                { title: `현장 참여 · ${onsiteRegistrations.length}명`, items: onsiteRegistrations },
                { title: `불라방 참여 · ${onlineRegistrations.length}명`, items: onlineRegistrations },
              ].map((group) => (
                <div key={group.title} className="mt-3">
                  <h4 className="font-jua text-sky-deep">{group.title}</h4>
                  {group.items.length > 0 ? <ul className="divide-y divide-sky-soft">{group.items.map((registration) => <RegistrationRow key={registration.id} registration={registration} app={applicationById.get(registration.application_id)} />)}</ul> : <p className="mt-1 text-xs text-slate-400">신청자 없음</p>}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
