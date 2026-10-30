// ── 특강 마감 안내 팝업 (공지 표에 쓰지 않고 코드로 만들어요) ──
// 공개된 특강마다 마감 전날 00:00(한국) ~ 마감 시각 동안, 그 특강 달 기수에 납부 완료된 수강생 중 아직 신청 안 한 학생에게.
import { CLASSROOM } from "./config";
import { deadlineOf, kstLabel, specialDay } from "./special";
import type { Notice } from "./notices";

type Ev = { id: string; event_date: string; starts_at: string; registration_deadline?: string | null; published?: boolean | null };
type App = { id: string; cohort: string; status: string };
type Reg = { special_lecture_id: string; application_id: string | null; deposit: string | null };

export const SPECIAL_POPUP_PREFIX = "special-deadline:";

// 마감 전날 00:00(한국)부터 마감 시각까지
export function deadlinePopupOpen(e: Ev, nowMs: number) {
  const deadline = Date.parse(deadlineOf(e));
  const kstDay = new Date(deadline + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const start = Date.parse(`${kstDay}T00:00:00+09:00`) - 86400000;
  return nowMs >= start && nowMs < deadline;
}

export function specialDeadlineNotices(events: Ev[], apps: App[], regs: Reg[], nowMs = Date.now()): Notice[] {
  const paid = apps.filter((a) => a.status === "paid" || a.status === "shipped");
  return events
    .filter((e) => e.published !== false && deadlinePopupOpen(e, nowMs))
    .filter((e) => paid.some((a) => a.cohort === e.event_date.slice(0, 7)))
    .filter((e) => !regs.some((r) => r.special_lecture_id === e.id && r.deposit !== "cancelled" && paid.some((a) => a.id === r.application_id)))
    .map((e) => {
      const deadline = kstLabel(deadlineOf(e));
      const today = new Date(nowMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
      return {
        id: `${SPECIAL_POPUP_PREFIX}${e.id}`,
        title: `🎤 ${specialDay(e.event_date)} 특강 · ${deadline} 신청 마감!`,
        to_label: "특강 신청 안내",
        lead: `특강 신청이 **${deadline}에 마감**돼요. 아직 신청 안 했다면 지금 신청해 주세요 :)`,
        sections: [
          { icon: "⏰", title: "신청 마감", body: `**${deadline}까지**` },
          { icon: "🏫", title: "현장 참여", body: `신청 후 **30분 안에 보증금 1만 원**을 입금하면 확정돼요. 참석하면 현장에서 100% 돌려드려요. 당일 **10시까지 필기구를 챙겨 ${CLASSROOM}**로 와 주세요.` },
          { icon: "💻", title: "불라방 참여", body: "신청하면 바로 확정돼요. 특강 페이지에 자료와 유튜브 링크가 올라와요." },
          { icon: "✅", title: "확정 확인", body: "특강 페이지 아래 **'내 특강 신청'**에서 확인할 수 있어요." },
        ],
        link_label: "🎤 특강 신청하러 가기",
        link_url: "/special",
        targets: [],
        starts_on: today,
        ends_on: today,
        popup: true,
        pinned: true,
        created_at: new Date(nowMs).toISOString(),
      } satisfies Notice;
    });
}
