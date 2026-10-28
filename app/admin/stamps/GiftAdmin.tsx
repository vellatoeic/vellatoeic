import { cohortLabel, todayKST } from "@/lib/config";
import { listGiftDraws, listGiftItems } from "@/lib/db";
import { cohortBoards, kindText, klassText, type StudentBoard } from "@/lib/gifts";
import { specialDay } from "@/lib/special";
import { cycleAttendance, cycleHomework, deleteGiftAction, markGiftSent, saveGiftAction } from "@/app/actions";
import CopyText from "../CopyText";
import CloseOnSubmitForm from "../CloseOnSubmitForm";
import SelectAll from "../SelectAll";

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const line = (b: StudentBoard) => `${b.app.name}\t${klassText(b.app)}\t${kindText(b.app)}`;

// 🎁 스티커판 완성 선물 ([출석·숙제] 맨 위). 격일반은 선물 대상이 아니라 빼요.
export default async function GiftAdmin({ cohort, q }: { cohort: string; q: string }) {
  const today = todayKST();
  const [boards, items, draws] = await Promise.all([cohortBoards(cohort, today), listGiftItems(cohort), listGiftDraws(cohort)]);
  const targets = boards.filter((b) => b.eligible).sort((a, b) => a.app.name.localeCompare(b.app.name, "ko"));
  const done = targets.filter((b) => b.status.complete);
  const lastOnly = targets.filter((b) => b.status.lastOnly);
  const near = targets.filter((b) => !b.status.complete && !b.status.lastOnly && b.status.missing.length <= 2);
  const drawnApp = new Set(draws.flatMap((d) => [d.app_id ?? "", d.student_key]));
  const notDrawn = done.filter((b) => !drawnApp.has(b.app.id));
  const used = (id: string) => draws.filter((d) => d.gift_id === id).length;
  const qq = q.replace(/\s/g, "").toUpperCase();
  const shown = qq ? draws.filter((d) => d.name.replace(/\s/g, "").includes(q.replace(/\s/g, "")) || d.code.includes(qq)) : draws;
  const who = (b: StudentBoard) => (
    <span><b className="text-sky-ink">{b.app.name}</b> <span className="text-xs text-slate-500">{klassText(b.app)} · {kindText(b.app)}</span></span>
  );

  return (
    <details className="card !p-4" open>
      <summary className="font-jua cursor-pointer text-xl text-sky-ink">🎁 스티커판 완성 선물 · {cohortLabel(cohort)}</summary>
      <div className="mt-3 space-y-4">
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <input type="month" name="gc" defaultValue={cohort} className="input !w-44 !py-1.5" />
          <button className="btn-ghost !py-1.5 text-sm">기수 보기</button>
          <span className="text-xs text-slate-500">완성 = 출석 전부(지각 포함) + 마지막 수업일 뺀 숙제 전부 · 격일반·환불 제외 · 중간 등록생은 신청 후 수업일</span>
        </form>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[["🎉 완성", done.length], ["⏳ 마지막 날 출석만", lastOnly.length], ["🟡 1~2개 모자람", near.length]].map(([t, n]) => (
            <div key={t as string} className="rounded-2xl bg-sky-soft p-2.5"><p className="text-xs text-slate-500">{t}</p><p className="font-jua text-2xl text-sky-ink">{n}명</p></div>
          ))}
        </div>

        {[
          { title: `🎉 완성 (${done.length}명)`, list: done },
          { title: `⏳ 마지막 날 출석만 남음 (${lastOnly.length}명)`, list: lastOnly },
        ].map((g) => (
          <div key={g.title} className="rounded-2xl bg-white p-3 ring-1 ring-sky-main">
            <div className="flex items-center justify-between gap-2">
              <p className="font-jua text-lg text-sky-ink">{g.title}</p>
              <CopyText label="명단 복사" text={g.list.map(line).join("\n")} />
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">{g.list.length ? g.list.map((b) => <span key={b.app.id}>{who(b)}</span>) : <span className="text-slate-400">없어요</span>}</p>
          </div>
        ))}

        <div className="rounded-2xl bg-white p-3 ring-1 ring-amber-200">
          <div className="flex items-center justify-between gap-2">
            <p className="font-jua text-lg text-amber-700">🟡 1~2개 모자람 ({near.length}명) <span className="text-xs font-normal text-slate-500">· 날짜를 누르면 바로 스티커를 붙여요</span></p>
            <CopyText label="명단 복사" text={near.map((b) => `${line(b)}\t${b.status.missing.map((m) => `${specialDay(m.day)} ${m.kind}`).join(", ")}`).join("\n")} />
          </div>
          <ul className="mt-1 space-y-1 text-sm">
            {near.length ? near.map((b) => (
              <li key={b.app.id} className="flex flex-wrap items-center gap-2">
                {who(b)}
                {b.status.missing.map((m) => (
                  <form key={`${m.day}${m.kind}`} action={m.kind === "출석" ? cycleAttendance : cycleHomework} className="inline">
                    <input type="hidden" name="id" value={b.app.id} />
                    <input type="hidden" name="day" value={m.day} />
                    <button className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">{specialDay(m.day)} {m.kind === "출석" ? "☁️ 출석" : "⭐ 숙제"} +</button>
                  </form>
                ))}
              </li>
            )) : <li className="text-slate-400">없어요</li>}
          </ul>
        </div>

        <div className="rounded-2xl bg-sky-soft p-3">
          <p className="font-jua text-lg text-sky-ink">🎁 선물 목록 <span className="text-xs font-normal text-slate-500">· 수량을 비우면 무제한 기본 선물 (수량 있는 선물이 다 떨어지면 이걸로)</span></p>
          <ul className="mt-2 space-y-1.5">
            {items.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 text-sm">
                <CloseOnSubmitForm action={saveGiftAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="cohort" value={cohort} />
                  <input name="name" defaultValue={g.name} className="input !w-48 !py-1.5" />
                  <input name="quantity" type="number" min={0} defaultValue={g.quantity ?? ""} placeholder="무제한" className="input !w-24 !py-1.5" />
                  <button className="btn-ghost !py-1.5 text-xs">수정</button>
                </CloseOnSubmitForm>
                <span className="text-xs text-slate-600">{g.quantity === null ? `무제한 · ${used(g.id)}명 당첨` : `남은 ${Math.max(0, g.quantity - used(g.id))} / ${g.quantity}`}</span>
                <form action={deleteGiftAction}><input type="hidden" name="id" value={g.id} /><button className="text-xs text-red-400 underline">삭제</button></form>
              </li>
            ))}
          </ul>
          <CloseOnSubmitForm action={saveGiftAction} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="cohort" value={cohort} />
            <input name="name" placeholder="예: 스타벅스 아메리카노" className="input !w-48 !py-1.5" />
            <input name="quantity" type="number" min={0} placeholder="수량(비우면 무제한)" className="input !w-36 !py-1.5" />
            <button className="btn !py-1.5 !text-sm">+ 선물 추가</button>
          </CloseOnSubmitForm>
        </div>

        <div className="rounded-2xl bg-white p-3 ring-1 ring-sky-main">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-jua text-lg text-sky-ink">🏆 당첨 명단 ({draws.length}명 · 보냄 {draws.filter((d) => d.sent_at).length})</p>
            <form className="flex items-center gap-1.5">
              <input type="hidden" name="gc" value={cohort} />
              <input name="gq" defaultValue={q} placeholder="이름 또는 확인 코드" className="input !w-40 !py-1.5 text-sm" />
              <button className="btn-ghost !py-1.5 text-sm">찾기</button>
            </form>
          </div>
          {shown.length === 0 ? <p className="mt-2 text-sm text-slate-400">{q ? "찾는 당첨자가 없어요." : "아직 뽑은 학생이 없어요."}</p> : (
            <form action={markGiftSent} className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-1.5 font-bold text-sky-ink"><SelectAll group="gifts" /> 전체 선택</label>
                <button name="sent" value="1" className="btn !py-1.5 !text-sm">체크한 사람 보냄 ✓</button>
                <button name="sent" value="0" className="btn-ghost !py-1.5 text-sm">보냄 취소</button>
                <CopyText label="명단 복사" text={shown.map((d) => `${d.name}\t${d.klass}\t${d.kind}\t${d.gift_name}\t${d.code}\t${when(d.drawn_at)}\t${d.sent_at ? "보냄" : ""}`).join("\n")} />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b border-sky-main text-left text-xs text-slate-500"><th className="py-1.5" /><th className="pr-3">이름</th><th className="pr-3">반</th><th className="pr-3">현장/불라방</th><th className="pr-3">상품</th><th className="pr-3">확인 코드</th><th className="pr-3">뽑은 시각</th><th>보냄</th></tr></thead>
                  <tbody>
                    {shown.map((d) => (
                      <tr key={d.id} className={`border-b border-sky-soft ${d.sent_at ? "opacity-60" : ""}`}>
                        <td className="py-1.5 pr-2"><input type="checkbox" name="ids" value={d.id} data-group="gifts" className="h-4 w-4 accent-sky-deep" /></td>
                        <td className="pr-3 font-bold text-sky-ink">{d.name}</td>
                        <td className="whitespace-nowrap pr-3 text-slate-600">{d.klass}</td>
                        <td className="pr-3">{d.kind}</td>
                        <td className="pr-3 font-bold text-[#e5707e]">{d.gift_name}</td>
                        <td className="pr-3 font-mono font-bold tracking-widest">{d.code}</td>
                        <td className="whitespace-nowrap pr-3 text-xs text-slate-500">{when(d.drawn_at)}</td>
                        <td><button name="one" value={`${d.id}|${d.sent_at ? "0" : "1"}`} className={`rounded-full px-2.5 py-1 text-xs font-bold ${d.sent_at ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{d.sent_at ? "✅ 보냄" : "보냄"}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </form>
          )}
        </div>

        <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-2">
            <p className="font-jua text-lg text-slate-600">⌛ 완성했지만 아직 안 뽑은 학생 ({notDrawn.length}명)</p>
            <CopyText label="명단 복사" text={notDrawn.map(line).join("\n")} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">{notDrawn.length ? notDrawn.map((b) => <span key={b.app.id}>{who(b)}</span>) : <span className="text-slate-400">없어요</span>}</p>
        </div>
      </div>
    </details>
  );
}
