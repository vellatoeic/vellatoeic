"use client";

import { useState } from "react";
import { saveNoticeAction } from "@/app/actions";
import { TRACK_GROUP_LABEL, type Notice, type NoticeSection, type NoticeTarget, type TrackGroup } from "@/lib/notices";
import { NoticeBody, NoticeHeader } from "@/components/notices/NoticeContent";

const COURSE_LABEL = { start: "시작반", solve: "문풀반", intensive: "속성반" } as const;
const KIND_LABEL = { onsite: "현장", online: "불라방" } as const;
const SLOT_LABEL = { am: "오전반", pm: "저녁반" } as const;

type Props = { notice?: Notice; today: string; monthEnd: string };

// 공지 쓰기·고치기. 섹션과 대상 조건은 여러 개 추가할 수 있어요. 오른쪽(아래)에 미리보기가 보여요.
export default function NoticeEditor({ notice, today, monthEnd }: Props) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [toLabel, setToLabel] = useState(notice?.to_label ?? "");
  const [lead, setLead] = useState(notice?.lead ?? "");
  const [sections, setSections] = useState<NoticeSection[]>(notice?.sections ?? [{ icon: "📌", title: "", body: "" }]);
  const [targets, setTargets] = useState<NoticeTarget[]>(notice?.targets ?? []);
  const [study, setStudy] = useState(notice ? notice.link_url === "@study" : true);

  const setSec = (i: number, patch: Partial<NoticeSection>) => setSections((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const toggle = <K extends keyof NoticeTarget>(i: number, key: K, v: string) =>
    setTargets((l) => l.map((t, j) => {
      if (j !== i) return t;
      const cur = (t[key] ?? []) as string[];
      return { ...t, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    }));
  const chip = (on: boolean) => `rounded-full border px-2.5 py-1 text-xs font-bold ${on ? "border-sky-deep bg-sky-deep text-white" : "border-sky-main bg-white text-sky-ink"}`;

  return (
    <form action={saveNoticeAction} onSubmit={(e) => e.currentTarget.closest("details")?.removeAttribute("open")} className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3 text-sm">
        {notice && <input type="hidden" name="id" value={notice.id} />}
        <input type="hidden" name="sections_json" value={JSON.stringify(sections)} />
        <input type="hidden" name="targets_json" value={JSON.stringify(targets)} />
        <label className="block"><span className="label">제목</span><input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="input" placeholder="📚 다음 수업부터 문풀반 스터디 시작!" /></label>
        <label className="block"><span className="label">대상 안내 문구 <span className="font-normal text-slate-400">(제목 아래 작은 글씨)</span></span><input name="to_label" value={toLabel} onChange={(e) => setToLabel(e.target.value)} className="input" placeholder="문풀반 · 현장 수강생 안내" /></label>
        <label className="block"><span className="label">첫 문장 <span className="font-normal text-slate-400">(**이렇게** 감싸면 형광펜 강조)</span></span><textarea name="lead" value={lead} onChange={(e) => setLead(e.target.value)} rows={3} className="input" /></label>

        <div className="space-y-2">
          <p className="label">섹션 <span className="font-normal text-slate-400">(**굵게**, &apos;+ &apos;로 시작하는 줄은 작은 글씨)</span></p>
          {sections.map((s, i) => (
            <div key={i} className="space-y-2 rounded-2xl bg-sky-soft p-3">
              <div className="flex gap-2">
                <input value={s.icon} onChange={(e) => setSec(i, { icon: e.target.value })} className="input !w-16 !py-2 text-center" aria-label="아이콘" />
                <input value={s.title} onChange={(e) => setSec(i, { title: e.target.value })} className="input !py-2" placeholder="소제목" />
              </div>
              <textarea value={s.body} onChange={(e) => setSec(i, { body: e.target.value })} rows={2} className="input !py-2" placeholder="내용" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!s.gray} onChange={(e) => setSec(i, { gray: e.target.checked })} className="accent-sky-deep" /> 회색 상자로</label>
                <span className="flex gap-2">
                  <button type="button" disabled={i === 0} onClick={() => setSections((l) => { const c = [...l]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })} className="disabled:opacity-30">▲</button>
                  <button type="button" disabled={i === sections.length - 1} onClick={() => setSections((l) => { const c = [...l]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; return c; })} className="disabled:opacity-30">▼</button>
                  <button type="button" onClick={() => setSections((l) => l.filter((_, j) => j !== i))} className="text-red-400">삭제</button>
                </span>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setSections((l) => [...l, { icon: "📌", title: "", body: "" }])} className="btn-ghost !py-2 text-sm">+ 섹션 추가</button>
        </div>

        <div className="space-y-2">
          <p className="label">하단 링크 버튼 <span className="font-normal text-slate-400">(선택)</span></p>
          <input name="link_label" defaultValue={notice?.link_label ?? "✅ 인증하러 가기"} className="input !py-2" placeholder="버튼 문구" />
          <label className="flex items-center gap-1.5"><input type="checkbox" name="link_study" checked={study} onChange={(e) => setStudy(e.target.checked)} className="accent-sky-deep" /> 스터디 인증 게시판 링크 쓰기 (신청 관리 기본 설정의 주소)</label>
          {!study && <input name="link_url" defaultValue={notice?.link_url && notice.link_url !== "@study" ? notice.link_url : ""} className="input !py-2" placeholder="https://..." />}
        </div>

        <div className="space-y-2">
          <p className="label">대상 <span className="font-normal text-slate-400">(조건이 없으면 전체 · 여러 줄이면 하나라도 맞으면 대상 · 칸 안에서 아무것도 안 고르면 모두)</span></p>
          {targets.map((t, i) => (
            <div key={i} className="space-y-1.5 rounded-2xl border border-sky-main/60 p-3">
              <div className="flex flex-wrap gap-1">{(["start", "solve", "intensive"] as const).map((v) => <button type="button" key={v} onClick={() => toggle(i, "courses", v)} className={chip(!!t.courses?.includes(v))}>{COURSE_LABEL[v]}</button>)}</div>
              <div className="flex flex-wrap gap-1">{(["all", "alt", "rc", "lc"] as TrackGroup[]).map((v) => <button type="button" key={v} onClick={() => toggle(i, "tracks", v)} className={chip(!!t.tracks?.includes(v))}>{TRACK_GROUP_LABEL[v]}</button>)}</div>
              <div className="flex flex-wrap gap-1">
                {(["onsite", "online"] as const).map((v) => <button type="button" key={v} onClick={() => toggle(i, "kinds", v)} className={chip(!!t.kinds?.includes(v))}>{KIND_LABEL[v]}</button>)}
                <span className="mx-1 text-slate-300">|</span>
                {(["am", "pm"] as const).map((v) => <button type="button" key={v} onClick={() => toggle(i, "slots", v)} className={chip(!!t.slots?.includes(v))}>{SLOT_LABEL[v]}</button>)}
              </div>
              <button type="button" onClick={() => setTargets((l) => l.filter((_, j) => j !== i))} className="text-xs text-red-400">이 조건 삭제</button>
            </div>
          ))}
          <button type="button" onClick={() => setTargets((l) => [...l, {}])} className="btn-ghost !py-2 text-sm">+ 대상 조건 추가</button>
          {targets.length === 0 && <p className="text-xs text-amber-600">조건이 없으면 전체 공지예요 (로그인 안 한 방문자에게도 기기당 한 번 떠요).</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">게시 시작</span><input type="date" name="starts_on" defaultValue={notice?.starts_on ?? today} required className="input !py-2" /></label>
          <label><span className="label">게시 종료</span><input type="date" name="ends_on" defaultValue={notice?.ends_on ?? monthEnd} required className="input !py-2" /></label>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5"><input type="checkbox" name="popup" defaultChecked={notice?.popup ?? true} className="accent-sky-deep" /> 팝업으로 띄우기</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" name="pinned" defaultChecked={notice?.pinned ?? false} className="accent-sky-deep" /> 📌 상단 고정</label>
        </div>
        <button className="btn w-full !py-3 !text-base">{notice ? "수정 저장" : "공지 올리기"}</button>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-slate-500">미리보기</p>
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_4px_24px_rgba(43,143,199,0.15)]">
          <NoticeHeader notice={{ title: title || "제목", to_label: toLabel }} page="1 / 1" />
          <NoticeBody notice={{ lead, sections }} />
          <div className="flex gap-2 px-[18px] pb-4 pt-2.5">
            <span className="grid place-items-center rounded-2xl bg-[#e2f7ee] px-3.5 py-3.5 font-jua text-[15px] text-[#2f9e6e]">✅ 링크</span>
            <span className="flex-1 rounded-2xl bg-sky-deep py-3.5 text-center font-jua text-lg text-white">확인했어요 ✓</span>
          </div>
        </div>
      </div>
    </form>
  );
}
