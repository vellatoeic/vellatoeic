// 개강 전 학생의 강의실·홈 맨 위 카드 (2026-11-27 Vella): '○월 수업 준비 중' + 개강일 + 지금 할 일.
// 11월 말에 미리 들어온 12월 학생이 지난달 공지·단톡방 안내를 보고 헷갈리지 않게, 이번 달 안내는 개강 전날부터 열린다고 알려 줘요.
import Icon from "@/components/Icon";
import { CLASSROOM, COURSES, DESK, KINDS, TIME_SLOTS, TRACKS } from "@/lib/config";
import { timeBlockOf } from "@/lib/receipt/classes";
import { dayLabelKo } from "@/lib/viewWindow";
import type { ChatGate, PreCourse } from "@/lib/preCourse";

type Row = { icon: string; done: boolean; title: string; sub: string };

export default function PreCourseCard({ pre, chat }: { pre: PreCourse; chat: ChatGate }) {
  const a = pre.app;
  const month = Number(a.cohort.slice(5, 7));
  const time = a.slot ? timeBlockOf(a, a.slot) : "";
  const paid = a.status === "paid" || a.status === "shipped";
  const rows: Row[] = [];
  if (a.receipt_status) {
    rows.push({ icon: "doc", done: a.receipt_status !== "review", title: "YBM 수강증", sub: a.receipt_status === "review" ? "선생님이 확인하고 있어요" : "확인됐어요" });
  }
  rows.push({ icon: "coins", done: paid, title: "교재비", sub: paid ? "입금 확인됐어요" : "입금 확인 중이에요 (위 안내대로 입금해 주세요)" });
  if (a.kind === "onsite") {
    rows.push({ icon: "book", done: false, title: "교재", sub: `첫 수업 날 ${CLASSROOM}에서 받아요` });
  } else if (a.pickup === "delivery") {
    rows.push({ icon: "parcel", done: a.status === "shipped", title: "교재 택배", sub: a.status === "shipped" ? "발송했어요 (평일 2~3일)" : paid ? "발송 준비 중이에요 (평일 2~3일)" : "입금 확인 뒤 보내 드려요" });
  } else {
    const when = a.pickup_date ? `${dayLabelKo(a.pickup_date)}${a.pickup_time ? ` ${a.pickup_time}` : ""}` : "수령 희망일";
    rows.push({ icon: "parcel", done: a.status === "shipped", title: `교재 ${DESK} 수령`, sub: a.status === "shipped" ? "받았어요" : `${when}에 ${DESK}에서 받아요` });
  }
  rows.push({
    icon: "chat", done: chat?.open === true, title: "단톡방",
    sub: chat && !chat.open ? `${dayLabelKo(chat.opensOn)}부터 이 화면에 입장 버튼이 생겨요` : chat?.open ? "아래 단톡방 카드로 들어와 주세요" : "개강 전날부터 이 화면에 입장 버튼이 생겨요",
  });
  rows.push(a.kind === "online"
    ? { icon: "live", done: false, title: "첫 라이브", sub: `${dayLabelKo(pre.first)}${time ? ` ${time.split("~")[0]}` : ""} · 수업 10분 전 이 화면 맨 위 [라이브 입장]` }
    : { icon: "school", done: false, title: "첫 수업", sub: `${dayLabelKo(pre.first)}${time ? ` ${time.split("~")[0]}` : ""} · 수강 시간에 맞춰 ${CLASSROOM}으로 와 주세요` });

  return (
    <section className="card space-y-3 !border-2 !border-sky-main" aria-label={`${month}월 수업 준비`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-jua text-2xl text-sky-ink">{month}월 수업 준비 중이에요</p>
          <p className="text-sm text-slate-600">{COURSES[a.course].label} {TRACKS[a.track]}{a.slot ? ` · ${TIME_SLOTS[a.slot]}` : ""} · {KINDS[a.kind].short}</p>
        </div>
        <span className="shrink-0 rounded-2xl bg-sky-deep px-3 py-2 text-center font-jua text-white">
          <span className="block text-xs opacity-90">개강 {dayLabelKo(pre.first)}</span>D-{pre.dStart}
        </span>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
            <Icon name={r.icon} size={28} />
            <span className="min-w-0 flex-1">
              <b className="block text-sky-ink">{r.title}</b>
              <span className="block text-sm text-slate-600">{r.sub}</span>
            </span>
            {r.done && <Icon name="check" size={22} title="완료" />}
          </li>
        ))}
      </ul>
      <p className="rounded-2xl bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-800">
        지난달 공지·단톡방 안내는 지난달 수강생 안내예요. {month}월 안내는 개강 전날부터 이 화면과 단톡방에서 드려요.
      </p>
    </section>
  );
}
