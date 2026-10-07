import { isAdmin } from "@/lib/auth";
import { listSpecialLectures, listSpecialMaterials, listSpecialRegistrations, isPreview, type SpecialLecture, type SpecialRegistration } from "@/lib/db";
import { addSpecialLecture, bulkSpecialDeposit, removeSpecialLecture, removeSpecialMaterial, removeSpecialRegistration, saveSpecialLecture } from "@/app/actions";
import { SPECIAL_DEPOSIT, won } from "@/lib/config";
import SelectAll from "../SelectAll";
import { specialWhen } from "@/lib/special";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import CloseOnSubmitForm from "../CloseOnSubmitForm";
import MaterialUpload from "./MaterialUpload";

export const dynamic = "force-dynamic";
export const metadata = { title: "특강 관리 · vella_toeic", robots: { index: false } };

function LectureFields({ event }: { event?: SpecialLecture }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label><span className="label">날짜</span><input type="date" name="event_date" defaultValue={event?.event_date} required className="input" /></label>
        <label><span className="label">특강 제목</span><input name="title" defaultValue={event?.title} required placeholder="예: PART 5 액기스 특강" className="input" /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">시작 시각</span><input type="time" name="starts_at" defaultValue={event?.starts_at.slice(0, 5) ?? "10:00"} required className="input" /></label>
        <label><span className="label">종료 시각 (모르면 비워두기)</span><input type="time" name="ends_at" defaultValue={event?.ends_at?.slice(0, 5) ?? ""} className="input" /></label>
      </div>
    </>
  );
}


function Roster({ title, items, depositForm }: { title: string; items: SpecialRegistration[]; depositForm?: string }) {
  const waiting = (r: SpecialRegistration) => !r.deposit || r.deposit === "pending";
  const sorted = [...items].sort((a, b) => (depositForm ? Number(waiting(b)) - Number(waiting(a)) : 0) || a.name.localeCompare(b.name, "ko"));
  return (
    <div className="mt-3">
      <h4 className="font-jua text-sky-deep">{title} · {items.length}명</h4>
      {sorted.length === 0 ? <p className="mt-1 text-xs text-slate-400">신청자 없음</p> : (
        <ul className="divide-y divide-sky-soft">
          {sorted.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-[15px]">
              <span className="flex items-center gap-2">
                {depositForm && <input type="checkbox" name="ids" value={r.id} form={depositForm} aria-label={`${r.name} 선택`} className="h-4 w-4 accent-sky-deep" />}
                <b className="text-sky-ink">{r.name}</b>
                {depositForm && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${waiting(r) ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>보증금 {waiting(r) ? "입금 대기" : "입금 확인"}</span>}
              </span>
              <details className="text-sm">
                <summary className="cursor-pointer text-red-400">삭제</summary>
                <CloseOnSubmitForm action={removeSpecialRegistration} className="mt-1">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded-xl bg-red-50 px-3 py-1 font-bold text-red-600">{r.name} 신청 삭제</button>
                </CloseOnSubmitForm>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function SpecialAdminPage() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const events = await listSpecialLectures();
  const rows = await Promise.all(events.map(async (event) => ({
    event,
    registrations: await listSpecialRegistrations(event.id),
    materials: await listSpecialMaterials(event.id),
  })));

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="special" />

      <details className="card">
        <summary className="font-jua cursor-pointer text-lg text-sky-ink">+ 특강 추가하기</summary>
        <CloseOnSubmitForm action={addSpecialLecture} className="mt-3 grid gap-3">
          <LectureFields />
          <button className="btn justify-self-start !py-2 !text-sm">특강 추가</button>
        </CloseOnSubmitForm>
      </details>

      {rows.length === 0 && <p className="card text-center text-slate-500">등록된 특강이 없어요.</p>}

      {rows.map(({ event, registrations, materials }) => {
        const onsite = registrations.filter((r) => r.mode === "onsite");
        const online = registrations.filter((r) => r.mode === "online");
        return (
          <section key={event.id} className="card space-y-5">
            <div>
              <p className="text-sm text-slate-500">{specialWhen(event)}</p>
              <h2 className="font-jua text-2xl text-sky-ink">{event.title}</h2>
              <p className="text-sm text-slate-600">현장 {onsite.length}명 · 불라방 {online.length}명</p>
            </div>

            <details className="rounded-2xl bg-sky-soft p-4">
              <summary className="cursor-pointer font-bold text-sky-ink">날짜·시간·제목·유튜브 링크 수정</summary>
              <CloseOnSubmitForm action={saveSpecialLecture} className="mt-3 grid gap-3">
                <input type="hidden" name="id" value={event.id} />
                <LectureFields event={event} />
                <label><span className="label">불라방 유튜브 링크</span><input type="url" name="youtube_url" defaultValue={event.youtube_id ? `https://youtu.be/${event.youtube_id}` : ""} placeholder="https://youtu.be/..." className="input" /></label>
                <button className="btn-ghost justify-self-start !py-2">저장</button>
              </CloseOnSubmitForm>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-red-400">특강 삭제</summary>
                <CloseOnSubmitForm action={removeSpecialLecture} className="mt-2">
                  <input type="hidden" name="id" value={event.id} />
                  <button className="rounded-xl bg-red-50 px-3 py-2 font-bold text-red-600">이 특강과 신청 명단·자료 모두 삭제 (되돌릴 수 없어요)</button>
                </CloseOnSubmitForm>
              </details>
            </details>

            <div className="rounded-2xl border border-sky-main/60 p-4">
              <h3 className="font-jua text-lg text-sky-ink">불라방 자료 · 유튜브</h3>
              <p className="mt-1 text-sm text-slate-500">불라방 신청자가 강의실 이름·비밀번호로 로그인하면 [특강 신청] 페이지에서 볼 수 있어요.</p>
              <p className="mt-2 text-sm">
                유튜브: {event.youtube_id
                  ? <a href={`https://youtu.be/${event.youtube_id}`} target="_blank" rel="noreferrer" className="text-sky-deep underline">youtu.be/{event.youtube_id}</a>
                  : <span className="text-slate-400">아직 없어요 (위 수정 메뉴에서 등록)</span>}
              </p>
              {materials.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {materials.map((material) => (
                    <li key={material.id} className="flex items-center justify-between gap-2 text-sm">
                      <a href={`/special/material/${material.id}`} className="text-sky-deep underline">📄 {material.file_name}</a>
                      <form action={removeSpecialMaterial}>
                        <input type="hidden" name="id" value={material.id} />
                        <button className="text-red-400 underline">자료 삭제</button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-slate-500">아직 올린 자료가 없어요.</p>}
              <MaterialUpload eventId={event.id} />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-jua text-lg text-sky-ink">신청 명단 {registrations.length}명</h3>
                <a href={`/admin/special/csv?id=${event.id}`} className="btn-ghost !py-2 text-sm">CSV 받기</a>
              </div>
              <Roster title="현장" items={onsite} depositForm={`deposit-${event.id}`} />
              {onsite.length > 0 && (
                <CloseOnSubmitForm id={`deposit-${event.id}`} action={bulkSpecialDeposit} className="mt-2 space-y-2 rounded-2xl bg-amber-50 p-3 text-sm">
                  <p className="text-slate-600">
                    보증금 {won(SPECIAL_DEPOSIT)} · 입금 대기 {onsite.filter((r) => !r.deposit || r.deposit === "pending").length}명 · 입금 확인 {onsite.filter((r) => r.deposit && r.deposit !== "pending").length}명
                  </p>
                  <label className="flex items-center gap-2 font-bold text-sky-ink"><SelectAll group="*" /> 현장 신청 전체 선택</label>
                  <div className="flex flex-wrap gap-2">
                    <button name="deposit" value="paid" className="btn !py-2 !text-sm">선택 입금 확인</button>
                    <button name="deposit" value="pending" className="btn-ghost !py-2 text-sm">입금 대기로 되돌리기</button>
                  </div>
                  <p className="text-xs text-slate-500">입금을 확인하면 학생 화면에 &apos;보증금 입금 확인 완료! 특강 당일 현장에서 환급해 드려요&apos;가 보여요. 환급은 현장에서 직접 해 주세요.</p>
                </CloseOnSubmitForm>
              )}
              <Roster title="불라방" items={online} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
