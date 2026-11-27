"use client";

// [일정표] 한 장 편집 (2026-11-27 Vella): 달은 페이지 맨 위에서 먼저 고르고, [월수반]·[화목반]·[특강] 버튼을 골라 날짜를 눌러요.
// 주 4일반 = 월수반 + 화목반 전부. 특강은 날짜를 누르면 어떤 특강인지 골라요. 공휴일은 자동(빨간 날), 공휴일에 수업을 넣으면 수업이 우선.
// 앞달 마지막 주 ~ 다음 달 첫 주까지 보여줘서 11월 말 개강하는 12월반도 넣을 수 있어요. 저장하면 모든 학생 화면이 이 일정표를 따라가요.
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";
import { saveTimetable } from "@/app/actions";
import { autoFill, holidaysFor, specialInMonth, specialTimes, summarize, timetableWarnings, timetableWeeks, SPECIAL_KINDS, SPECIAL_MAX, type DayMark, type Marks, type SpecialPick } from "@/lib/timetable";
import { dayNumberLabel } from "@/lib/schedule";
import { COLORS, dayLabel, drawTimetable, legendLines, shareTimetable } from "./timetableImage";

type Special = { id: string; date: string; title: string; starts_at: string; ends_at: string | null; published: boolean };
type Brush = DayMark | "special";
const BRUSHES: { key: Brush; label: string; color: string }[] = [
  { key: "mw", label: "월수반", color: COLORS.mw },
  { key: "tt", label: "화목반", color: COLORS.tt },
  { key: "special", label: "특강", color: COLORS.special },
];
const MARK_NAME: Record<DayMark, string> = { mw: "월수반", tt: "화목반" };
const kindShort = (title: string) => (/PART\s*5/i.test(title) ? "PART 5" : title.includes("모의고사") ? "모의고사" : title.slice(0, 5));
const sortPicks = (p: SpecialPick[]) => [...p].sort((a, b) => a.date.localeCompare(b.date));

export default function TimetableEditor({ cohort, initialMarks, savedHolidays, specials, saved }: {
  cohort: string;
  initialMarks: Marks;
  savedHolidays: Record<string, string>;
  specials: Special[];
  saved: boolean;
}) {
  const initialPicks = useMemo(() => sortPicks(specials.map((p) => ({ date: p.date, title: p.title }))), [specials]);
  const [marks, setMarks] = useState<Marks>(initialMarks);
  const [picks, setPicks] = useState<SpecialPick[]>(initialPicks);
  const [brush, setBrush] = useState<Brush>("mw");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [chooser, setChooser] = useState<string | null>(null); // 특강 고르는 날짜
  const s = summarize(marks);
  const [fillStart, setFillStart] = useState(s.first ?? `${cohort}-01`);
  const [fillEnd, setFillEnd] = useState("");
  const weeks = useMemo(() => timetableWeeks(cohort), [cohort]);
  const holidays = useMemo(() => holidaysFor(cohort, savedHolidays, {}), [cohort, savedHolidays]); // 자동 공휴일 (수업을 넣어도 이름은 보여요)
  const locked = new Set(specials.filter((p) => p.published).map((p) => p.date));
  const month = Number(cohort.slice(5, 7));
  const dirty = JSON.stringify([marks, picks]) !== JSON.stringify([initialMarks, initialPicks]);

  // 특강 줄(이미지·요약): 공개한 특강은 그 시간 그대로, 나머지는 종류별 시간
  const specialRows = picks.map((p) => {
    const pub = specials.find((x) => x.published && x.date === p.date);
    const t = pub ?? specialTimes(p.title);
    return { date: p.date, title: pub?.title ?? p.title, starts_at: t.starts_at, ends_at: t.ends_at };
  });

  const tap = (day: string) => {
    const w = new Date(`${day}T00:00:00Z`).getUTCDay();
    setMsg("");
    if (brush === "special") {
      if (!specialInMonth(day, cohort)) return setMsg(`특강은 ${month}월 안의 날짜로 골라 주세요. (그 달 수강생만 신청할 수 있어요)`);
      if (locked.has(day)) return setMsg("이미 공개한 특강이에요. 날짜·이름은 [특강 관리]에서 바꿔 주세요.");
      return setChooser(day);
    }
    if (w === 0 || w === 6) return setMsg("주말에는 정규 수업을 넣지 않아요. 특강은 [특강] 버튼으로 넣어 주세요.");
    setMarks((m) => {
      const next = { ...m };
      if (next[day] === brush) delete next[day];
      else next[day] = brush;
      return next;
    });
    if (holidays[day] && marks[day] !== brush) setMsg(`${dayLabel(day)}은 공휴일(${holidays[day]})이지만 ${MARK_NAME[brush]} 수업으로 넣었어요.`);
  };

  const pickSpecial = (title: string | null) => {
    const day = chooser;
    setChooser(null);
    if (!day) return;
    if (title === null) return setPicks((p) => p.filter((x) => x.date !== day));
    if (!picks.some((x) => x.date === day) && picks.length >= SPECIAL_MAX) return setMsg("특강은 한 달에 2번까지 넣어요. 먼저 다른 특강을 눌러 [특강 빼기] 해 주세요.");
    setPicks((p) => sortPicks([...p.filter((x) => x.date !== day), { date: day, title }]));
    if (holidays[day]) setMsg(`${dayLabel(day)}은 공휴일(${holidays[day]})이에요. 맞는지 한 번 더 확인해 주세요.`);
  };

  const fill = () => {
    if (!weeks.flat().includes(fillStart)) return setMsg("개강일을 달력 안의 날짜로 골라 주세요.");
    if (s.total && !window.confirm("지금 넣은 수업일을 지우고 개강일부터 새로 채울까요? (특강은 그대로예요)")) return;
    const next = autoFill(cohort, fillStart, holidays, fillEnd || null);
    setMarks(next);
    const n = summarize(next);
    setMsg(`${dayLabel(fillStart)}부터 ${n.total}회 채웠어요${n.last ? ` · 종강 ${dayLabel(n.last)}` : ""}. 다른 날은 눌러서 고쳐 주세요.`);
  };

  const share = async () => {
    setBusy(true);
    try {
      const canvas = await drawTimetable(cohort, marks, specialRows, holidaysFor(cohort, savedHolidays, marks));
      const r = await shareTimetable(canvas, cohort);
      setMsg(r === "saved" ? "이미지를 저장했어요. 사진첩·다운로드에서 학원에 보내 주세요." : r === "shared" ? "이미지를 보냈어요." : r === "fail" ? "이미지를 만들지 못했어요. 다시 눌러 주세요." : "");
    } finally {
      setBusy(false);
    }
  };

  const warnings = timetableWarnings(marks);
  const lines = legendLines(marks, specialRows, Object.fromEntries(Object.entries(holidaysFor(cohort, savedHolidays, marks)).filter(([d]) => d.startsWith(`${cohort}-`))));
  const chosen = chooser ? picks.find((p) => p.date === chooser) : null;

  return (
    <form action={saveTimetable} className="space-y-4">
      <input type="hidden" name="cohort" value={cohort} />
      <input type="hidden" name="marks" value={JSON.stringify(marks)} />
      <input type="hidden" name="specials" value={JSON.stringify(picks)} />

      {/* 학원 제출용 이미지 · 저장 */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={share} disabled={busy} className="btn-ghost flex items-center justify-center gap-1.5 !py-3">
          <Icon name="camera" size={20} />{busy ? "만드는 중…" : "이미지로 보내기"}
        </button>
        <button className="btn flex items-center justify-center gap-1.5 !py-3">
          <Icon name="check" size={20} />{dirty || !saved ? "일정표 저장" : "저장됨"}
        </button>
      </div>
      {!saved && <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700">아직 저장하지 않은 달이에요. 지금 보이는 날짜는 기본값(첫째 월요일부터)이에요. 날짜를 눌러 고친 뒤 꼭 저장해 주세요.</p>}
      {dirty && <p className="text-center text-xs font-bold text-red-600">저장하지 않은 내용이 있어요 · 저장해야 학생들에게 연동돼요</p>}

      <section className="card space-y-3 !p-3 sm:!p-5">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <h2 className="font-jua text-2xl text-sky-ink">{month}월 수업 일정표</h2>
          <p className="text-sm font-bold text-slate-600">{s.first ? <>개강 <b className="text-sky-deep">{dayLabel(s.first)}</b> · 종강 <b className="text-sky-ink">{dayLabel(s.last!)}</b></> : "수업일을 넣어 주세요"}</p>
        </div>

        {/* ② 버튼 고르기 */}
        <p className="px-1 text-sm font-bold text-sky-ink">② 버튼을 고르고 아래 날짜를 눌러요</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="넣을 것">
          {BRUSHES.map((b) => (
            <button key={b.key} type="button" role="radio" aria-checked={brush === b.key} onClick={() => { setBrush(b.key); setMsg(""); }}
              className={`rounded-2xl px-2 py-3 text-base font-extrabold transition ${brush === b.key ? "text-white shadow-[0_3px_0_rgba(0,0,0,0.2)]" : "bg-slate-100 text-slate-500"}`}
              style={brush === b.key ? { background: b.color } : undefined}>
              {b.label}
            </button>
          ))}
        </div>
        <p className="px-1 text-xs text-slate-500">
          {brush === "special"
            ? "특강 날짜를 누르면 어떤 특강인지 골라요 (한 달 2번)."
            : `날짜를 누르면 ${MARK_NAME[brush]} 수업일이 돼요. 한 번 더 누르면 빠져요. 주 4일반은 월수반·화목반을 모두 들어요.`}
          {" "}빨간 날은 공휴일이에요(자동).
        </p>
        {msg && <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm font-bold text-sky-ink">{msg}</p>}

        {/* 달력 (일~토, 앞달 마지막 주 ~ 다음 달 첫 주) */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {[..."일월화수목금토"].map((d, i) => <div key={d} className={`py-1 text-xs font-bold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-600" : "text-slate-500"}`}>{d}</div>)}
          {weeks.flat().map((day, i) => {
            const w = i % 7;
            const other = !day.startsWith(`${cohort}-`);
            const hol = holidays[day];
            const m = marks[day];
            const sp = picks.find((p) => p.date === day);
            const si = sp ? picks.indexOf(sp) : -1;
            return (
              <button key={day} type="button" onClick={() => tap(day)}
                aria-label={`${dayLabel(day)}${m ? ` ${MARK_NAME[m]}` : ""}${sp ? ` 특강 ${sp.title}` : ""}${hol ? ` 공휴일 ${hol}` : ""}`}
                className={`flex min-h-[4.6rem] flex-col items-stretch gap-0.5 rounded-xl border p-1 text-left ${hol ? "border-red-200 bg-red-50" : m || sp ? "border-sky-main/40 bg-white" : other ? "border-transparent bg-slate-50/60" : "border-slate-100 bg-slate-50"}`}>
                <span className="flex flex-wrap items-start justify-between gap-0.5">
                  <span className={`font-extrabold leading-none ${other ? "text-[10px]" : "text-sm"} ${hol || w === 0 ? "text-red-500" : w === 6 ? "text-blue-600" : other && !m ? "text-slate-400" : "text-sky-ink"}`}>{dayNumberLabel(day, cohort)}</span>
                  {(day === s.first || day === s.last) && <span className={`rounded-full px-1 text-[9px] font-extrabold leading-4 text-white ${day === s.first ? "bg-[#2b8fc7]" : "bg-[#12466b]"}`}>{day === s.first ? "개강" : "종강"}</span>}
                </span>
                {hol && <span className="truncate text-[10px] font-bold leading-tight text-red-500">{hol}</span>}
                {m && <span className="rounded-md py-0.5 text-center text-[11px] font-extrabold text-white" style={{ background: m === "mw" ? COLORS.mw : COLORS.tt }}>{m === "mw" ? "월수" : "화목"} {s.nth[day]}</span>}
                {sp && (
                  <span className="rounded-md py-0.5 text-center leading-tight text-white" style={{ background: COLORS.special }} title={sp.title}>
                    <span className="block text-[10px] font-extrabold">특강 {si + 1}</span>
                    <span className="block truncate text-[9px] font-bold opacity-90">{kindShort(sp.title)}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {warnings.length > 0 && <ul className="space-y-1 px-1 text-sm font-bold text-amber-700">{warnings.map((w) => <li key={w} className="flex items-center gap-1"><Icon name="alert" size={16} />{w}</li>)}</ul>}
      </section>

      {/* 요약 (이미지 아래쪽과 같은 내용) */}
      <section className="card space-y-2 text-sm">
        <h3 className="font-jua text-lg text-sky-ink">이 일정표로 정해지는 것</h3>
        <ul className="space-y-1.5">
          {lines.map((l) => <li key={l.text} className="flex items-start gap-2"><span className="mt-1 size-3 flex-none rounded" style={{ background: l.color }} />{l.text}</li>)}
        </ul>
      </section>

      {/* 개강일만 넣고 자동으로 (선택) */}
      <details className="card">
        <summary className="flex cursor-pointer items-center gap-1.5 font-jua text-lg text-sky-ink"><Icon name="calendar" size={22} />개강일만 넣고 자동으로 채우기 (선택)</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">개강일</span><input type="date" className="input" value={fillStart} min={weeks[0][0]} max={weeks.at(-1)!.at(-1)} onChange={(e) => setFillStart(e.target.value)} /></label>
            <label><span className="label">종강일 (비우면 16회)</span><input type="date" className="input" value={fillEnd} min={fillStart} max={weeks.at(-1)!.at(-1)} onChange={(e) => setFillEnd(e.target.value)} /></label>
          </div>
          <button type="button" onClick={fill} className="btn-ghost w-full">이 기간으로 수업일 채우기</button>
          <p className="text-xs text-slate-500">주마다 월~목 4일(공휴일 있는 주·주 중간 개강 주는 금요일까지), 순서대로 월수반 → 화목반을 번갈아 채워요. 앞달 말 개강(예: 11/30)도 돼요.</p>
        </div>
      </details>

      <p className="px-1 text-sm font-bold text-sky-ink">③ 저장하면 시작반·문풀반·속성반 모든 학생의 강의실·출석·숙제·테스트·음원·다시 보기 기간이 이 일정표로 바뀌어요. 특강은 [특강 관리]에 공개 전 초안으로 들어가요.</p>
      <button className="btn w-full !py-3.5">{dirty || !saved ? "일정표 저장" : "저장됨 · 다시 저장"}</button>

      {/* 특강 고르기 창 (화면 전체를 덮는 창은 body로) */}
      {chooser && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={(e) => e.target === e.currentTarget && setChooser(null)}>
          <div className="w-full max-w-sm space-y-2 rounded-3xl bg-white p-4 shadow-xl" role="dialog" aria-modal="true" aria-label="특강 고르기">
            <p className="font-jua text-xl text-sky-ink">{dayLabel(chooser)} 어떤 특강을 할까요?</p>
            {SPECIAL_KINDS.map((k) => (
              <button key={k.title} type="button" onClick={() => pickSpecial(k.title)}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left font-bold ${chosen?.title === k.title ? "bg-[#7c4dcc] text-white" : "bg-slate-50 text-sky-ink"}`}>
                <span>{k.title}</span><span className="text-xs opacity-80">{k.starts_at}~{k.ends_at ?? ""}</span>
              </button>
            ))}
            <button type="button" onClick={() => { const t = window.prompt("특강 이름", chosen && !SPECIAL_KINDS.some((k) => k.title === chosen.title) ? chosen.title : ""); if (t?.trim()) pickSpecial(t.trim()); }}
              className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-left font-bold text-slate-600">다른 특강 (이름 쓰기)</button>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {chosen ? <button type="button" onClick={() => pickSpecial(null)} className="rounded-2xl bg-red-50 py-3 font-bold text-red-600">특강 빼기</button> : <span />}
              <button type="button" onClick={() => setChooser(null)} className="rounded-2xl bg-slate-100 py-3 font-bold text-slate-600">닫기</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </form>
  );
}
