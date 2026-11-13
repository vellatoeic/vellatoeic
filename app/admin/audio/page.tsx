import { isAdmin } from "@/lib/auth";
import { currentCohort, isPreview, listAudios, roundFor } from "@/lib/db";
import { BOOKS, cohortLabel, todayKST } from "@/lib/config";
import { AUDIO_BOOKS, audioExpiresOn } from "@/lib/audio";
import { addAudioLink, cleanupExpiredAudios, moveAudio, removeAudio } from "@/app/actions";
import { isDriveLink } from "@/lib/materialLink";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import CloseOnSubmitForm from "../CloseOnSubmitForm";
import LinkForm from "../LinkForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "LC 음원 · vella_toeic", robots: { index: false } };


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

  const usage = [...new Set(all.map((a) => a.cohort))].sort().reverse().map((co) => ({ cohort: co, count: all.filter((a) => a.cohort === co).length }));
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
        <LinkForm action={addAudioLink} hidden={{ cohort, book }} titlePlaceholder="제목 (예: PART 1)" />
        {list.length === 0 ? <p className="text-sm text-slate-500">아직 등록한 음원이 없어요.</p> : (
          <ol className="divide-y divide-sky-soft">
            {list.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2 py-2">
                <span className="font-jua w-7 shrink-0 text-center text-sky-deep">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {a.link_url
                    ? <a href={a.link_url} target="_blank" rel="noreferrer" className="underline decoration-sky-main underline-offset-2">🔗 {a.title}</a>
                    : <>{a.title} <span className="text-xs font-bold text-amber-600">예전 파일 (이사 후 없음 → 링크로 다시 등록하고 삭제해 주세요)</span></>}
                  {a.link_url && !isDriveLink(a.link_url) && <span className="ml-1 text-xs text-amber-600">구글 드라이브 링크가 아니에요</span>}
                </span>
                <form action={moveAudio} className="flex gap-1">
                  <input type="hidden" name="id" value={a.id} />
                  <button name="dir" value="up" disabled={i === 0} className="rounded-lg bg-sky-soft px-2 py-1 text-sm disabled:opacity-30" aria-label="위로">▲</button>
                  <button name="dir" value="down" disabled={i === list.length - 1} className="rounded-lg bg-sky-soft px-2 py-1 text-sm disabled:opacity-30" aria-label="아래로">▼</button>
                </form>
                <details className="relative text-sm">
                  <summary className="cursor-pointer list-none text-red-400">삭제</summary>
                  <CloseOnSubmitForm action={removeAudio} className="absolute right-0 z-10 mt-1">
                    <input type="hidden" name="id" value={a.id} />
                    <button className="whitespace-nowrap rounded-xl bg-red-50 px-3 py-1.5 font-bold text-red-600 shadow">정말 삭제</button>
                  </CloseOnSubmitForm>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card space-y-3">
        <h3 className="font-jua text-xl text-sky-ink">기수별 음원</h3>
        <p className="text-sm text-slate-600">음원 파일은 구글 드라이브에 있어요. 사이트에는 제목과 링크만 저장해요.</p>
        {usage.length > 0 && (
          <ul className="text-sm text-slate-600">
            {usage.map((u) => <li key={u.cohort}>{cohortLabel(u.cohort)} · {u.count}개</li>)}
          </ul>
        )}
        <form action={cleanupExpiredAudios} className="rounded-2xl bg-sky-soft p-3 text-sm">
          <p className="text-slate-600">그 기수 모든 반의 다운로드 기간(첫 수업일부터 14일)이 끝난 음원 <b>{expired.length}개</b></p>
          <button disabled={expired.length === 0} className="btn mt-2 !py-2 !text-sm">기간 지난 음원 목록 정리</button>
        </form>
      </section>
    </div>
  );
}
