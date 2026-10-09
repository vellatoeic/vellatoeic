import { listNoticeReads, listNotices } from "@/lib/db";
import { noticeIdentity, withLinks } from "@/lib/noticeView";
import { isForEveryone, isLive, myNotices, sortNotices } from "@/lib/notices";
import { todayKST } from "@/lib/config";
import { specialDay } from "@/lib/special";
import { readNotice } from "@/app/actions";
import { NoticeBody } from "@/components/notices/NoticeContent";

export const dynamic = "force-dynamic";
export const metadata = { title: "공지 · vella_toeic", robots: { index: false } };

// 🔔 공지 목록: 본인 대상 공지만 (지난 공지도 다시 볼 수 있어요)
export default async function NoticesPage() {
  const today = todayKST();
  const [{ loggedIn, apps }, all] = await Promise.all([noticeIdentity(), listNotices()]);
  const mine = await withLinks(loggedIn && apps.length
    ? myNotices(all, apps, today)
    : sortNotices(all.filter((n) => isForEveryone(n) && n.starts_on <= today)));
  const reads = new Set((await listNoticeReads({ appIds: apps.map((a) => a.id) })).map((r) => r.notice_id));

  return (
    <div className="space-y-4 pt-8">
      <h1 className="font-jua text-3xl text-sky-ink">🔔 공지</h1>
      {mine.length === 0 && <p className="card text-center text-slate-500">아직 공지가 없어요.</p>}
      {mine.map((n) => {
        const unread = loggedIn && !reads.has(n.id) && isLive(n, today);
        return (
          <details key={n.id} open={unread} className="overflow-hidden rounded-3xl bg-white shadow-[0_2px_0_#d5ecf9]">
            <summary className="flex cursor-pointer list-none items-start gap-2 px-5 py-4">
              <span className="flex-1">
                <span className="block font-jua text-lg text-sky-ink">{n.pinned && "📌 "}{n.title}</span>
                <span className="text-xs text-slate-400">{specialDay(n.starts_on)} ~ {specialDay(n.ends_on)}{n.to_label ? ` · ${n.to_label}` : ""}{!isLive(n, today) ? " · 지난 공지" : ""}</span>
              </span>
              {unread && <span className="shrink-0 rounded-full bg-[#e5484d] px-2 py-0.5 text-xs font-bold text-white">NEW</span>}
            </summary>
            <NoticeBody notice={n} />
            <div className="flex gap-2 px-5 pb-4 pt-2">
              {n.link_url && n.link_label && <a href={n.link_url} target="_blank" rel="noreferrer" className="grid place-items-center rounded-2xl bg-[#e2f7ee] px-3.5 py-3 font-jua text-[15px] text-[#2f9e6e]">{n.link_label}</a>}
              {unread && (
                <form action={readNotice} className="flex-1">
                  <input type="hidden" name="id" value={n.id} />
                  <button className="w-full rounded-2xl bg-sky-deep py-3 font-jua text-lg text-white">확인했어요 ✓</button>
                </form>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
