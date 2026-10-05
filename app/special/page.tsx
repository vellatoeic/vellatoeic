import { getSpecialIds } from "@/lib/auth";
import { getSpecialRegistrations, listSpecialLectures, listSpecialMaterials } from "@/lib/db";
import { CLASSROOM } from "@/lib/config";
import { specialLogout } from "@/app/actions";
import { specialRegistrationOpen, specialWhen } from "@/lib/special";
import SpecialForm from "./SpecialForm";
import SpecialLogin from "./SpecialLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "특강 신청 · vella_toeic", robots: { index: false } };

export default async function SpecialPage() {
  const [events, mine] = await Promise.all([listSpecialLectures(), getSpecialIds().then(getSpecialRegistrations)]);
  const open = events.filter((event) => specialRegistrationOpen(event.event_date, event.starts_at));
  const eventById = new Map(events.map((event) => [event.id, event]));
  const myRows = await Promise.all(
    mine
      .filter((registration) => eventById.has(registration.special_lecture_id))
      .map(async (registration) => ({
        registration,
        event: eventById.get(registration.special_lecture_id)!,
        materials: registration.mode === "online" ? await listSpecialMaterials(registration.special_lecture_id) : [],
      })),
  );
  myRows.sort((a, b) => a.event.event_date.localeCompare(b.event.event_date));

  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <span className="rounded-full bg-sky-main px-4 py-1.5 text-sm font-bold text-sky-ink">토요 특강</span>
        <h1 className="font-jua mt-3 text-4xl text-sky-ink">특강 신청</h1>
        <p className="mt-2 text-slate-600">현장 또는 불라방으로 신청할 수 있어요.</p>
      </div>

      {open.length > 0
        ? <SpecialForm events={open.map((event) => ({ id: event.id, title: event.title, when: specialWhen(event) }))} />
        : <p className="card text-center text-slate-500">지금 신청할 수 있는 특강이 없어요.</p>}

      {myRows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-jua text-2xl text-sky-ink">내 특강 신청</h2>
          {myRows.map(({ registration, event, materials }) => (
            <div key={registration.id} className="card space-y-3">
              <div>
                <p className="text-sm text-sky-deep">{specialWhen(event)}</p>
                <p className="font-jua text-xl text-sky-ink">{event.title} · {registration.mode === "onsite" ? "현장" : "불라방"}</p>
                <p className="text-sm text-slate-500">{registration.name}</p>
              </div>
              {registration.mode === "onsite" ? (
                <p className="rounded-2xl bg-sky-soft p-4 text-sm text-slate-700">특강 당일 10시까지 필기구를 챙겨 {CLASSROOM}로 와주세요.</p>
              ) : materials.length === 0 && !event.youtube_id ? (
                <p className="rounded-2xl bg-sky-soft p-4 text-sm text-slate-700">특강 시작 전에 이 페이지에 자료와 유튜브 링크가 올라와요.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {materials.map((material) => (
                    <a key={material.id} href={`/special/material/${material.id}`} className="btn-ghost !py-2 text-sm">📄 {material.file_name}</a>
                  ))}
                  {event.youtube_id && (
                    <a href={`https://youtu.be/${event.youtube_id}`} target="_blank" rel="noreferrer" className="btn !py-2 !text-sm">유튜브 특강 보기 ↗</a>
                  )}
                </div>
              )}
            </div>
          ))}
          <form action={specialLogout} className="text-center">
            <button className="text-sm text-slate-500 underline">다른 이름으로 확인하기</button>
          </form>
        </section>
      ) : (
        <SpecialLogin />
      )}
    </div>
  );
}
