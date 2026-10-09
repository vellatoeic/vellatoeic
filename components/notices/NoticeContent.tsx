import type { Notice } from "@/lib/notices";

// **굵게** 표시를 굵은 글씨(첫 문장에서는 형광펜)로 바꿔요. '+ '로 시작하는 줄은 작은 보조 글씨예요.
function Rich({ text, highlight = false }: { text: string; highlight?: boolean }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const sub = line.startsWith("+ ");
        const parts = line.split(/\*\*(.+?)\*\*/g);
        const content = parts.map((p, j) => (j % 2 === 1
          ? <b key={j} className={highlight ? "bg-[linear-gradient(transparent_60%,#fff1a8_60%)] font-bold text-sky-ink" : "text-sky-ink"}>{p}</b>
          : <span key={j}>{p}</span>));
        return <span key={i} className={`block ${sub ? "text-[12.5px] text-[#7aa3bd]" : ""}`}>{content}</span>;
      })}
    </>
  );
}

// 섹션 아이콘 배경 (시안 색)
const ICON_BG: Record<string, string> = { "🕘": "#e3f4fd", "✏️": "#fff5cc", "❓": "#ffe9ea", "✅": "#e2f7ee" };
const FALLBACK_BG = ["#e3f4fd", "#fff5cc", "#ffe9ea", "#e2f7ee", "#f3efff"];

export function NoticeHeader({ notice, page }: { notice: Pick<Notice, "title" | "to_label">; page?: string }) {
  return (
    <div className="relative bg-gradient-to-br from-[#bfe6fb] to-[#e9f7ff] px-[18px] pb-3.5 pt-4">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-jua text-sm text-sky-deep">📢 새로운 공지를 확인해주세요!</span>
      {page && <span className="absolute right-[18px] top-[18px] font-jua text-xs text-[#7aa3bd]">{page}</span>}
      <h2 className="mt-2.5 font-jua text-[21px] leading-snug text-[#1f5a80]">{notice.title}</h2>
      {notice.to_label && <p className="mt-1 text-xs text-[#5b88a6]">{notice.to_label}</p>}
    </div>
  );
}

export function NoticeBody({ notice }: { notice: Pick<Notice, "lead" | "sections"> }) {
  return (
    <div className="px-[18px] pb-1.5 pt-3.5 text-[#1f5a80]">
      {notice.lead && <p className="mb-2 text-[14.5px] leading-relaxed"><Rich text={notice.lead} highlight /></p>}
      {notice.sections.map((s, i) => s.gray ? (
        <div key={i} className="mt-1 rounded-[14px] bg-[#f4f9fd] px-3 py-2.5 text-[13px] leading-relaxed text-[#3d6b88]">
          <b className="font-jua text-sm font-normal text-[#1f5a80]">{s.icon} {s.title}</b>
          <Rich text={s.body} />
        </div>
      ) : (
        <div key={i} className="flex gap-2.5 border-t border-dashed border-[#e1eef7] py-2.5">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-xl text-[17px]" style={{ background: ICON_BG[s.icon] ?? FALLBACK_BG[i % FALLBACK_BG.length] }}>{s.icon}</span>
          <div>
            <p className="font-jua text-[15.5px]">{s.title}</p>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-[#3d6b88]"><Rich text={s.body} /></p>
          </div>
        </div>
      ))}
    </div>
  );
}
