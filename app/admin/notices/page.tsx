import { isAdmin } from "@/lib/auth";
import { currentCohort, isPreview, listApplications, listNoticeReads, listNotices } from "@/lib/db";
import { COURSES, TRACKS, KINDS, TIME_SLOTS, todayKST } from "@/lib/config";
import { isActive } from "@/lib/access";
import { isLive, noticeMatches, sortNotices, TRACK_GROUP_LABEL, type NoticeTarget } from "@/lib/notices";
import { specialDay } from "@/lib/special";
import { deleteNoticeAction } from "@/app/actions";
import AdminTabs from "../AdminTabs";
import LoginForm from "../LoginForm";
import CloseOnSubmitForm from "../CloseOnSubmitForm";
import NoticeEditor from "./NoticeEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "공지 · vella_toeic", robots: { index: false } };

const COURSE_LABEL = { start: "시작반", solve: "문풀반", intensive: "속성반" } as const;

function describe(targets: NoticeTarget[]) {
  if (targets.length === 0) return "전체 (방문자 포함)";
  return targets.map((t) => [
    t.courses?.length ? t.courses.map((c) => COURSE_LABEL[c]).join("·") : "모든 반",
    t.tracks?.length ? t.tracks.map((x) => TRACK_GROUP_LABEL[x]).join("·") : "",
    t.kinds?.length ? t.kinds.map((k) => KINDS[k].short).join("·") : "",
    t.slots?.length ? t.slots.map((s) => TIME_SLOTS[s]).join("·") : "",
  ].filter(Boolean).join(" ")).join("  또는  ");
}

export default async function NoticesAdmin() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const today = todayKST();
  const [y, m] = today.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const cohort = await currentCohort();
  const [notices, apps, reads] = await Promise.all([listNotices(), listApplications(), listNoticeReads()]);
  // 대상 인원: 이번 모집 기수의 환불되지 않은 신청 (학생 1명 = 신청 1건)
  const people = apps.filter((a) => a.cohort === cohort && isActive(a));

  return (
    <div className="space-y-5 pt-8">
      <AdminTabs active="notices" />

      <details className="card">
        <summary className="font-jua cursor-pointer text-lg text-sky-ink">+ 새 공지 쓰기</summary>
        <div className="mt-4"><NoticeEditor today={today} monthEnd={monthEnd} /></div>
      </details>

      {notices.length === 0 && <p className="card text-center text-slate-500">아직 공지가 없어요.</p>}

      {sortNotices(notices).map((n) => {
        const audience = people.filter((a) => noticeMatches(n, [a]));
        const readSet = new Set(reads.filter((r) => r.notice_id === n.id).map((r) => r.app_id));
        const unread = audience.filter((a) => !readSet.has(a.id));
        return (
          <section key={n.id} className="card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-jua text-xl text-sky-ink">{n.pinned && "📌 "}{n.title}</p>
                <p className="text-sm text-slate-500">
                  {specialDay(n.starts_on)} ~ {specialDay(n.ends_on)} · {isLive(n, today) ? "게시 중" : n.starts_on > today ? "게시 예정" : "게시 끝"} · {n.popup ? "팝업 O" : "팝업 X"}
                </p>
                <p className="text-sm text-slate-500">대상: {describe(n.targets)}</p>
              </div>
              <p className="text-right text-sm text-slate-500">확인 <b className="font-jua text-2xl text-sky-ink">{audience.length - unread.length}</b> / {audience.length}명</p>
            </div>
            {unread.length > 0 && (
              <details className="rounded-2xl bg-amber-50 p-3 text-sm">
                <summary className="cursor-pointer font-bold text-amber-700">미확인 {unread.length}명 보기</summary>
                <p className="mt-2 text-slate-700">{unread.sort((a, b) => a.name.localeCompare(b.name, "ko")).map((a) => `${a.name}(${COURSES[a.course].label} ${TRACKS[a.track]}·${KINDS[a.kind].short}${a.slot ? `·${TIME_SLOTS[a.slot]}` : ""})`).join(", ")}</p>
              </details>
            )}
            <details>
              <summary className="cursor-pointer text-sm text-slate-500">수정</summary>
              <div className="mt-3"><NoticeEditor notice={n} today={today} monthEnd={monthEnd} /></div>
            </details>
            <details className="text-sm">
              <summary className="cursor-pointer text-red-400">삭제</summary>
              <CloseOnSubmitForm action={deleteNoticeAction} className="mt-2">
                <input type="hidden" name="id" value={n.id} />
                <button className="rounded-xl bg-red-50 px-3 py-2 font-bold text-red-600">이 공지와 확인 기록 삭제 (되돌릴 수 없어요)</button>
              </CloseOnSubmitForm>
            </details>
          </section>
        );
      })}
    </div>
  );
}
