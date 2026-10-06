import { isAdmin } from "@/lib/auth";
import { currentCohort, isPreview, listAudios, roundFor } from "@/lib/db";
import { BOOKS, cohortLabel, todayKST } from "@/lib/config";
import { AUDIO_BOOKS, audioExpiresOn } from "@/lib/audio";
import { cleanupExpiredAudios, moveAudio, removeAudio } from "@/app/actions";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import AudioUploader from "./AudioUploader";

export const dynamic = "force-dynamic";
export const metadata = { title: "LC 음원 · vella_toeic", robots: { index: false } };

const FREE_STORAGE = 1024 * 1024 * 1024; // Supabase 무료 요금제 보관함 1GB
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;

export default async function AudioAdmin({ searchParams }: { searchParams: Promise<{ c?: string; k?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const now = await currentCohort();
  const { c = now, k = "" } = await searchParams;
  const cohort = /^\d{4}-\d{2}$/.test(c) ? c : now;
  // 처음 열면 그 기수 교재 회차의 LC 교재를 보여줘요.
  const book = k === "lc1" || k === "lc2" ? k : (await roundFor(cohort)) === 1 ? "lc1" : "lc2";
  const all = await listAudios();
  const list = all.filter((a) => a.cohort === cohort && a.book === book);
  const today = todayKST();

  const usage = [...new Set(all.map((a) => a.cohort))].sort().reverse().map((co) => ({
    cohort: co,
    bytes: all.filter((a) => a.cohort === co).reduce((s, a) => s + Number(a.size_bytes), 0),
    count: all.filter((a) => a.cohort === co).length,
  }));
  const total = usage.reduce((s, u) => s + u.bytes, 0);
  const expired = (await Promise.all([...new Set(all.map((a) => a.cohort))].map(async (co) => {
    const end = await audioExpiresOn(co);
    return end && end < today ? all.filter((a) => a.cohort === co) : [];
  }))).flat();

  const tab = (on: boolean) => `rounded-full px-4 py-2 text-sm font-bold ${on ? "bg-sky-deep text-white" : "bg-white text-sky-ink"}`;

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="audio" />

      <div className="card space-y-3 !p-4">
        <form className="flex flex-wrap items-end gap-2">
          <label><span className="label">기수</span><input type="month" name="c" defaultValue={cohort} className="input !py-2" /></label>
          <input type="hidden" name="k" value={book} />
          <button className="btn-ghost !py-2 text-sm">기수 보기</button>
        </form>
        <div className="flex gap-2">
          {AUDIO_BOOKS.map((b) => (
            <a key={b} href={`/admin/audio?c=${cohort}&k=${b}`} className={tab(book === b)}>{BOOKS[b]} 교재</a>
          ))}
        </div>
        <p className="text-xs text-slate-500">신청 교재에 이 LC 교재가 있는 학생(시작반·문풀반·속성반 공통)에게 보여요. RC 단과 학생에게는 보이지 않아요.</p>
      </div>

      <section className="card space-y-4">
        <h2 className="font-jua text-2xl text-sky-ink">{cohortLabel(cohort)} {BOOKS[book]} 음원 <span className="text-base text-slate-400">· {list.length}개</span></h2>
        <AudioUploader cohort={cohort} book={book} />
        {list.length === 0 ? <p className="text-sm text-slate-500">아직 올린 음원이 없어요.</p> : (
          <ol className="divide-y divide-sky-soft">
            {list.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2 py-2">
                <span className="font-jua w-7 shrink-0 text-center text-sky-deep">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{a.title} <span className="text-xs text-slate-400">{mb(Number(a.size_bytes))}</span></span>
                <form action={moveAudio} className="flex gap-1">
                  <input type="hidden" name="id" value={a.id} />
                  <button name="dir" value="up" disabled={i === 0} className="rounded-lg bg-sky-soft px-2 py-1 text-sm disabled:opacity-30" aria-label="위로">▲</button>
                  <button name="dir" value="down" disabled={i === list.length - 1} className="rounded-lg bg-sky-soft px-2 py-1 text-sm disabled:opacity-30" aria-label="아래로">▼</button>
                </form>
                <details className="relative text-sm">
                  <summary className="cursor-pointer list-none text-red-400">삭제</summary>
                  <form action={removeAudio} className="absolute right-0 z-10 mt-1">
                    <input type="hidden" name="id" value={a.id} />
                    <button className="whitespace-nowrap rounded-xl bg-red-50 px-3 py-1.5 font-bold text-red-600 shadow">정말 삭제</button>
                  </form>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card space-y-3">
        <h3 className="font-jua text-xl text-sky-ink">보관함 용량</h3>
        <p className="text-sm text-slate-600">전체 {mb(total)} / 무료 1GB ({Math.round((total / FREE_STORAGE) * 100)}%)</p>
        <div className="h-2.5 overflow-hidden rounded-full bg-sky-soft"><i className={`block h-full ${total > FREE_STORAGE * 0.8 ? "bg-red-400" : "bg-sky-deep"}`} style={{ width: `${Math.min(100, (total / FREE_STORAGE) * 100)}%` }} /></div>
        {usage.length > 0 && (
          <ul className="text-sm text-slate-600">
            {usage.map((u) => <li key={u.cohort}>{cohortLabel(u.cohort)} · {u.count}개 · {mb(u.bytes)}</li>)}
          </ul>
        )}
        <form action={cleanupExpiredAudios} className="rounded-2xl bg-sky-soft p-3 text-sm">
          <p className="text-slate-600">그 기수 모든 반의 다운로드 기간(첫 수업일부터 14일)이 끝난 음원 <b>{expired.length}개 · {mb(expired.reduce((s, a) => s + Number(a.size_bytes), 0))}</b></p>
          <button disabled={expired.length === 0} className="btn mt-2 !py-2 !text-sm">기간 지난 음원 정리 (파일 삭제)</button>
        </form>
      </section>
    </div>
  );
}
