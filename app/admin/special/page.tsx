import { isAdmin } from "@/lib/auth";
import { expireSpecialDeposits, listDepositEvents, listSpecialLectures, listSpecialMaterials, listSpecialRegistrations, listWaitingDeposits, isPreview, type SpecialLecture, type SpecialRegistration } from "@/lib/db";
import { addSpecialLecture, bulkSpecialOnsite, removeSpecialLecture, removeSpecialMaterial, removeSpecialRegistration, resolveDepositEvent, saveSpecialLecture } from "@/app/actions";
import { DEPOSIT_MINUTES, DEPOSIT_LABEL, SPECIAL_DEPOSIT, won, type DepositStatus } from "@/lib/config";
import SmsTest from "./SmsTest";
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


const DEPOSIT_TONE: Record<DepositStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  review: "bg-amber-100 text-amber-700",
  cancelled: "bg-slate-100 text-slate-400",
};
const kst = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function Roster({ title, items, onsiteForm }: { title: string; items: SpecialRegistration[]; onsiteForm?: string }) {
  const rank: Record<DepositStatus, number> = { review: 0, pending: 1, paid: 2, cancelled: 3 };
  const sorted = [...items].sort((a, b) => (onsiteForm ? rank[a.deposit ?? "pending"] - rank[b.deposit ?? "pending"] : 0) || a.name.localeCompare(b.name, "ko"));
  return (
    <div className="mt-3">
      <h4 className="font-jua text-sky-deep">{title} · {items.length}명</h4>
      {sorted.length === 0 ? <p className="mt-1 text-xs text-slate-400">신청자 없음</p> : (
        <ul className="divide-y divide-sky-soft">
          {sorted.map((r) => {
            const d = r.deposit ?? "pending";
            return (
              <li key={r.id} className={`flex items-center justify-between gap-3 py-2 text-[15px] ${d === "cancelled" ? "opacity-50" : ""}`}>
                <span className="flex flex-wrap items-center gap-1.5">
                  {onsiteForm && <input type="checkbox" name="ids" value={r.id} form={onsiteForm} aria-label={`${r.name} 선택`} className="h-4 w-4 accent-sky-deep" />}
                  <b className="text-sky-ink">{r.name}</b>
                  {onsiteForm && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${DEPOSIT_TONE[d]}`}>{d === "review" ? "입금 대기" : DEPOSIT_LABEL[d]}</span>}
                  {onsiteForm && d === "pending" && <span className="text-xs text-slate-400">신청 {kst(r.created_at)}</span>}
                </span>
                <details className="text-sm">
                  <summary className="cursor-pointer text-red-400">삭제</summary>
                  <CloseOnSubmitForm action={removeSpecialRegistration} className="mt-1">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-xl bg-red-50 px-3 py-1 font-bold text-red-600">{r.name} 신청 삭제</button>
                  </CloseOnSubmitForm>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default async function SpecialAdminPage() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  await expireSpecialDeposits(DEPOSIT_MINUTES);
  const [events, depositEvents, waitingDeposits] = await Promise.all([listSpecialLectures(), listDepositEvents(20), listWaitingDeposits()]);
  const toCheck = depositEvents.filter((e) => e.target === "special" && (e.result === "review" || e.result === "unmatched"));
  const webhookOn = (process.env.DEPOSIT_WEBHOOK_TOKEN ?? "").length >= 16;
  const rows = await Promise.all(events.map(async (event) => ({
    event,
    registrations: await listSpecialRegistrations(event.id),
    materials: await listSpecialMaterials(event.id),
  })));

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="special" />

      {toCheck.length > 0 && (
        <section className="rounded-3xl border-2 border-red-200 bg-red-50 p-5">
          <p className="font-jua text-xl text-red-600">⚠️ 입금 문자 확인 필요 {toCheck.length}건</p>
          <p className="mt-1 text-sm text-slate-600">자동으로 확정하지 못한 입금이에요. 맞는 신청을 골라 확정하거나, 관계없는 입금이면 [무시]를 눌러 주세요.</p>
          <ul className="mt-3 space-y-2">
            {toCheck.map((e) => (
              <li key={e.id} className="rounded-2xl bg-white p-3 text-sm">
                <p><b className="text-sky-ink">{e.name || "(이름 못 읽음)"}</b> · {e.amount ? won(e.amount) : "금액 못 읽음"} · {kst(e.received_at)} · <span className="text-red-500">{e.result === "review" ? "같은 이름 대기 신청 여러 건" : "일치하는 신청 없음"}</span></p>
                <CloseOnSubmitForm action={resolveDepositEvent} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="event_id" value={e.id} />
                  <select name="registration_id" className="input !w-auto min-w-0 flex-1 !py-2">
                    <option value="">관계없는 입금 (무시)</option>
                    {waitingDeposits
                      .sort((x, y) => Number(y.name === e.name) - Number(x.name === e.name))
                      .map((r) => <option key={r.id} value={r.id}>{r.name} · {DEPOSIT_LABEL[r.deposit ?? "pending"]} · 신청 {kst(r.created_at)}</option>)}
                  </select>
                  <button className="btn !py-2 !text-sm">처리</button>
                </CloseOnSubmitForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="card">
        <summary className="font-jua cursor-pointer text-lg text-sky-ink">📩 입금 문자 자동 확인 {webhookOn ? "· 켜짐" : "· 꺼짐 (토큰 설정 필요)"}</summary>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          <p>아이폰 단축어가 은행 입금 문자를 보내면, 입금자명과 {won(SPECIAL_DEPOSIT)}이 맞는 &apos;입금 대기&apos; 현장 신청을 자동으로 확정해요. 문자 원문은 저장하지 않아요.</p>
          <p className="font-bold text-sky-ink">은행 문자가 잘 읽히는지 확인하기</p>
          <SmsTest />
        </div>
      </details>

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-jua text-xl text-sky-ink">📨 입금 문자 수신 기록</h2>
          <span className="text-xs text-slate-400">최근 20건 · 특강 보증금·교재비</span>
        </div>
        {depositEvents.length === 0 ? (
          <p className="text-sm text-slate-500">아직 받은 입금 문자가 없어요. 단축어로 테스트하면 여기에 바로 나타나요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-sky-main text-slate-500">
                  <th className="py-2 pr-2">받은 시각</th>
                  <th className="py-2 pr-2">종류</th>
                  <th className="py-2 pr-2">입금자명</th>
                  <th className="py-2 pr-2">금액</th>
                  <th className="py-2">매칭 결과</th>
                </tr>
              </thead>
              <tbody>
                {depositEvents.map((e) => {
                  const result = {
                    matched: { label: "자동 확정", tone: "bg-emerald-100 text-emerald-700" },
                    resolved: { label: "직접 확정", tone: "bg-emerald-100 text-emerald-700" },
                    review: { label: "확인 필요 · 같은 이름 여러 건", tone: "bg-red-100 text-red-600" },
                    unmatched: { label: !e.name ? "확인 필요 · 문자를 못 읽음" : "확인 필요 · 맞는 신청 없음", tone: "bg-red-100 text-red-600" },
                    dismissed: { label: "무시", tone: "bg-slate-100 text-slate-500" },
                  }[e.result];
                  return (
                    <tr key={e.id} className="border-b border-sky-soft align-top">
                      <td className="whitespace-nowrap py-2 pr-2 text-slate-500">{kst(e.received_at)}</td>
                      <td className="whitespace-nowrap py-2 pr-2 text-slate-500">{e.target === "book" ? "교재비" : "특강"}</td>
                      <td className="py-2 pr-2 font-bold text-sky-ink">{e.name || "?"}</td>
                      <td className="whitespace-nowrap py-2 pr-2">{e.amount ? won(e.amount) : "?"}</td>
                      <td className="py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${result.tone}`}>{result.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
              <Roster title="현장" items={onsite} onsiteForm={`onsite-${event.id}`} />
              {onsite.length > 0 && (
                <CloseOnSubmitForm id={`onsite-${event.id}`} action={bulkSpecialOnsite} className="mt-2 space-y-2 rounded-2xl bg-amber-50 p-3 text-sm">
                  <p className="text-slate-600">
                    보증금 {won(SPECIAL_DEPOSIT)} · 입금 대기 {onsite.filter((r) => !r.deposit || r.deposit === "pending" || r.deposit === "review").length}명 · 확정 {onsite.filter((r) => r.deposit === "paid").length}명
                  </p>
                  <label className="flex items-center gap-2 font-bold text-sky-ink"><SelectAll group="*" /> 현장 신청 전체 선택</label>
                  <div className="flex flex-wrap gap-2">
                    <button name="op" value="confirm" className="btn !py-2 !text-sm">선택 입금 확정</button>
                    <button name="op" value="pending" className="btn-ghost !py-2 text-sm">입금 대기로 되돌리기</button>
                  </div>
                  <p className="text-xs text-slate-500">입금 문자가 오면 자동으로 확정돼요. 신청 후 {DEPOSIT_MINUTES}분 안에 입금이 없으면 자동 취소돼요. 보증금은 특강 당일 현장에서 돌려주세요.</p>
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
