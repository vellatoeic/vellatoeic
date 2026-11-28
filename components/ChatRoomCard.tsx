// 그 달 벨라토익 단톡방 카드 (강의실·학생 대시보드 공통, 규칙은 lib/preCourse.ts chatRoomFor)
// 단톡방은 달마다 새로 열어요(2026-11-28 Vella): 학생은 자기 수강 달 방만, 그 반 개강 전날부터 그 달 열람 마감일까지.
import Icon from "@/components/Icon";
import { dayLabelKo } from "@/lib/viewWindow";
import type { ChatRoom } from "@/lib/preCourse";

export default function ChatRoomCard({ chat }: { chat: ChatRoom }) {
  if (!chat) return null;
  const month = Number(chat.cohort.slice(5, 7));
  if (chat.state === "open") {
    return (
      <a href={chat.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#ffe58a] bg-[#fff9e0] px-4 py-3">
        <span>
          <span className="flex items-center gap-1.5 font-jua text-lg text-[#7d6728]"><Icon name="chat" size={24} />{month}월 벨라토익 단톡방</span>
          {chat.code && <span className="text-sm text-[#a7741a]">참여코드 <b className="font-jua text-lg tracking-widest">{chat.code}</b></span>}
        </span>
        <span className="shrink-0 text-sm font-bold text-[#a7741a]">들어가기 ↗</span>
      </a>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-slate-500">
      <Icon name="chat" size={24} />
      <span className="text-sm">
        <b className="font-jua text-base text-slate-600">{month}월 벨라토익 단톡방</b> · {chat.state === "soon" ? `${dayLabelKo(chat.opensOn)}부터 여기서 들어갈 수 있어요` : "링크가 곧 여기에 올라와요"}
      </span>
    </div>
  );
}
