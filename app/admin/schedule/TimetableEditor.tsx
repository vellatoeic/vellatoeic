"use client";

// [일정표] 한 장 편집 (2026-11-27 Vella): 붓(월수반·화목반·특강·공휴일·지우기)을 고르고 날짜를 눌러요.
// 주 4일반 = 월수반 + 화목반 전부. 개강일 = 첫 수업일, 종강일 = 마지막 수업일. 저장하면 강의실·출석·음원·열람 기간·수강증 반 대조가 모두 이 일정표를 따라가요.
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { saveTimetable } from "@/app/actions";
import { autoFill, summarize, timetableWarnings, SPECIAL_MAX, type DayMark, type Marks } from "@/lib/timetable";
import { SPECIAL_SLOTS } from "@/lib/specialPlan";
import { COLORS, dayLabel, drawTimetable, legendLines, monthWeeks, shareTimetable } from "./timetableImage";

type Special = { id: string; date: string; title: string; starts_at: string; ends_at: string | null; published: boolean };
type Brush = DayMark | "special" | "holiday" | "clear";
const BRUSHES: { key: Brush; label: string; cls: string }[] = [
  { key: "mw", label: "월수반", cls: "bg-[#2b8fc7] text-white" },
  { key: "tt", label: "화목반", cls: "bg-[#f08a24] text-white" },
  { key: "special", label: "특강", cls: "bg-[#7c4dcc] text-white" },
  { key: "holiday", label: "공휴일", cls: "bg-[#e5484d] text-white" },
  { key: "clear", label: "지우기", cls: "bg-slate-600 text-white" },
];

export default function TimetableEditor({ cohort, initialMarks, initialHolidays, publicHolidays, specials, saved }: {
  cohort: string;
  initialMarks: Marks;
  initialHolidays: Record<string, string>;
  publicHolidays: Record<string, string>;
  specials: Special[];
  saved: boolean;
}) {
  const [marks, setMarks] = useState<Marks>(initialMarks);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [specialDates, setSpecialDates] = useState(() => [...new Set(specials.map((s) => s.date))].sort());
  const [brush, setBrush] = useState<Brush>("mw");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const s = summarize(marks);
  const [fillStart, setFillStart] = useState(s.first ?? `${cohort}-01`);
  const [fillEnd, setFillEnd] = useState("");
  const weeks = useMemo(() => monthWeeks(cohort), [cohort]);
  const locked = new Set(specials.filter((p) => p.published).map((p) => p.date));
  const month = Number(cohort.slice(5, 7));
  const last = weeks.flat().filter(Boolean).at(-1)!;
  const dirty = JSON.stringify([marks, holidays, specialDates]) !== JSON.stringify([initialMarks, initialHolidays, [...new Set(specials.map((p) => p.date))].sort()]);

  // 특강 칸 이름·시간: 공개·초안이 이미 있는 날은 그 특강, 새로 고른 날은 순서대로 1차·2차
  const specialRows = specialDates.map((date, i) => {
    const have = specials.find((p) => p.date === date);
    const slot = SPECIAL_SLOTS[i] ?? { title: "특강", starts_at: "10:00", ends_at: null };
    return { date, title: have?.published ? have.title : slot.title, starts_at: have?.published ? have.starts_at : slot.starts_at, ends_at: have?.published ? have.ends_at : slot.ends_at, published: !!have?.published };
  });

  const tap = (day: string) => {
    const w = new Date(`${day}T00:00:00Z`).getUTCDay();
    setMsg("");
    if (brush === "mw" || brush === "tt") {
      if (w === 0 || w === 6) return setMsg("주말에는 정규 수업을 넣지 않아요. 특강은 [특강]으로 넣어 주세요.");
      if (holidays[day]) return setMsg(`${dayLabel(day)}은 공휴일(${holidays[day]})이에요. 수업을 하려면 [공휴일]로 먼저 빼 주세요.`);
      setMarks((m) => {
        const next = { ...m };
        if (next[day] === brush) delete next[day];
        else next[day] = brush;
        return next;
      });
    } else if (brush === "special") {
      if (locked.has(day)) return setMsg("이미 공개한 특강이에요. 날짜는 [특강 관리]에서 바꿔 주세요.");
      if (specialDates.includes(day)) return setSpecialDates((d) => d.filter((x) => x !== day));
      if (specialDates.length >= SPECIAL_MAX) return setMsg("특강은 한 달에 2번까지 넣어요. 먼저 하나를 눌러 빼 주세요.");
      setSpecialDates((d) => [...d, day].sort());
      if (holidays[day]) setMsg(`${dayLabel(day)}은 공휴일(${holidays[day]})이에요. 맞는지 한 번 더 확인해 주세요.`);
    } else if (brush === "holiday") {
      if (holidays[day]) {
        setHolidays((h) => { const n = { ...h }; delete n[day]; return n; });
        return setMsg(`${dayLabel(day)} 공휴일을 뺐어요. 수업을 하려면 [월수반]·[화목반]으로 넣어 주세요.`);
      }
      const name = window.prompt(`${dayLabel(day)} 공휴일 이름 (예: 한글날, 휴강)`, publicHolidays[day] ?? "휴강");
      if (!name?.trim()) return;
      setHolidays((h) => ({ ...h, [day]: name.trim().slice(0, 40) }));
      if (marks[day]) {
        setMarks((m) => { const n = { ...m }; delete n[day]; return n; });
        setMsg(`${dayLabel(day)} ${MARK_NAME[marks[day]]} 수업이 빠졌어요. 보강하는 날을 [${MARK_NAME[marks[day]]}]으로 넣어 주세요.`);
      }
    } else {
      setMarks((m) => { const n = { ...m }; delete n[day]; return n; });
      if (!locked.has(day)) setSpecialDates((d) => d.filter((x) => x !== day));
    }
  };

  const fill = () => {
    if (!fillStart.startsWith(`${cohort}-`)) return setMsg("개강일을 이 달 안에서 골라 주세요.");
    if (s.total && !window.confirm("지금 넣은 수업일을 지우고 개강일부터 새로 채울까요? (공휴일·특강은 그대로예요)")) return;
    const next = autoFill(cohort, fillStart, holidays, fillEnd || null);
    setMarks(next);
    const n = summarize(next);
    setMsg(`${dayLabel(fillStart)}부터 ${n.total}회 채웠어요${n.last ? ` · 종강 ${dayLabel(n.last)}` : ""}. 다른 날은 눌러서 고쳐 주세요.`);
  };

  const share = async () => {
    setBusy(true);
    try {
      const canvas = await drawTimetable(cohort, marks, specialRows, holidays);
      const r = await shareTimetable(canvas, cohort);
      setMsg(r === "saved" ? "이미지를 저장했어요. 사진첩·다운로드에서 학원에 보내 주세요." : r === "shared" ? "이미지를 보냈어요." : r === "fail" ? "이미지를 만들지 못했어요. 다시 눌러 주세요." : "");
    } finally {
      setBusy(false);
    }
  };

  const warnings = timetableWarnings(marks);
  const lines = legendLines(marks, specialRows, holidays);

  return (
    <form action={saveTimetable} className="space-y-4">
      <input type="hidden" name="cohort" value={cohort} />
      <input type="hidden" name="marks" value={JSON.stringify(marks)} />
      <input type="hidden" name="holidays" value={JSON.stringify(holidays)} />
      <input type="hidden" name="specials" value={JSON.stringify(specialDates)} />

      {/* 맨 위: 학원 제출용 이미지 · 저장 */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={share} disabled={busy} className="btn-ghost flex items-center justify-center gap-1.5 !py-3">
          <Icon name="camera" size={20} />{busy ? "만드는 중…" : "이미지로 보내기"}
        </button>
        <button className="btn flex items-center justify-center gap-1.5 !py-3">
          <Icon name="check" size={20} />{dirty || !saved ? "일정표 저장" : "저장됨"}
        </button>
      </div>
      {!saved && <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700">아직 저장하지 않은 달이에요. 지금 보이는 날짜는 기본값(첫째 월요일부터)이에요. 개강일을 고르고 [자동 채우기] 뒤 저장해 주세요.</p>}
      {dirty && <p className="text-center text-xs font-bold text-red-600">저장하지 않은 내용이 있어요 · 이미지는 지금 화면 그대로 만들어져요</p>}

      <section className="card space-y-3 !p-3 sm:!p-5">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <h2 className="font-jua text-2xl text-sky-ink">{month}월 일정표</h2>
          <p className="text-sm font-bold text-slate-600">{s.first ? <>개강 <b className="text-sky-deep">{dayLabel(s.first)}</b> · 종강 <b className="text-sky-ink">{dayLabel(s.last!)}</b></> : "수업일을 넣어 주세요"}</p>
        </div>

        {/* 붓 고르기 */}
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="넣을 것">
          {BRUSHES.map((b) => (
            <button key={b.key} type="button" role="radio" aria-checked={brush === b.key} onClick={() => setBrush(b.key)}
              className={`rounded-xl px-1 py-2.5 text-sm font-bold transition ${brush === b.key ? `${b.cls} shadow-[0_3px_0_rgba(0,0,0,0.18)]` : "bg-slate-100 text-slate-500"}`}>
              {b.label}
            </button>
          ))}
        </div>
        <p className="px-1 text-xs text-slate-500">{HELP[brush]}</p>
        {msg && <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm font-bold text-sky-ink">{msg}</p>}

        {/* 달력 (일~토) */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {[..."일월화수목금토"].map((d, i) => <div key={d} className={`py-1 text-xs font-bold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-600" : "text-slate-500"}`}>{d}</div>)}
          {weeks.flat().map((day, i) => {
            if (!day) return <div key={`b${i}`} />;
            const w = i % 7;
            const hol = holidays[day];
            const pub = !hol && publicHolidays[day];
            const m = marks[day];
            const si = specialRows.findIndex((p) => p.date === day);
            return (
              <button key={day} type="button" onClick={() => tap(day)} aria-label={`${dayLabel(day)}${m ? ` ${MARK_NAME[m]}` : ""}${si >= 0 ? " 특강" : ""}${hol ? ` 공휴일 ${hol}` : ""}`}
                className={`flex min-h-[4.6rem] flex-col items-stretch gap-0.5 rounded-xl border p-1 text-left ${hol ? "border-red-200 bg-red-50" : m || si >= 0 ? "border-sky-main/40 bg-white" : "border-slate-100 bg-slate-50"}`}>
                <span className="flex items-start justify-between gap-0.5">
                  <span className={`text-sm font-extrabold leading-none ${hol || w === 0 ? "text-red-500" : w === 6 ? "text-blue-600" : "text-sky-ink"}`}>{Number(day.slice(8))}</span>
                  {(day === s.first || day === s.last) && <span className={`rounded-full px-1 text-[9px] font-extrabold leading-4 text-white ${day === s.first ? "bg-[#2b8fc7]" : "bg-[#12466b]"}`}>{day === s.first ? "개강" : "종강"}</span>}
                </span>
                {hol && <span className="truncate text-[10px] font-bold leading-tight text-red-500">{hol}</span>}
                {pub && <span className="truncate text-[10px] leading-tight text-red-300" title="공휴일 표에 있지만 이 달은 수업일로 저장했어요">{pub}</span>}
                {m && <span className="rounded-md py-0.5 text-center text-[11px] font-extrabold text-white" style={{ background: m === "mw" ? COLORS.mw : COLORS.tt }}>{m === "mw" ? "월수" : "화목"} {s.nth[day]}</span>}
                {si >= 0 && <span className="truncate rounded-md py-0.5 text-center text-[11px] font-extrabold text-white" style={{ background: COLORS.special }} title={specialRows[si].title}>특강 {si + 1}</span>}
              </button>
            );
          })}
        </div>
        {warnings.length > 0 && <ul className="space-y-1 px-1 text-sm font-bold text-amber-700">{warnings.map((w) => <li key={w} className="flex items-center gap-1"><Icon name="alert" size={16} />{w}</li>)}</ul>}
      </section>

      {/* 개강일 · 종강일로 자동 채우기 */}
      <section className="card space-y-3">
        <h3 className="flex items-center gap-1.5 font-jua text-lg text-sky-ink"><Icon name="calendar" size={22} />개강일 · 종강일로 자동 채우기</h3>
        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">개강일</span><input type="date" className="input" value={fillStart} min={`${cohort}-01`} max={last} onChange={(e) => setFillStart(e.target.value)} /></label>
          <label><span className="label">종강일 (비우면 16회)</span><input type="date" className="input" value={fillEnd} min={fillStart} max={last} onChange={(e) => setFillEnd(e.target.value)} /></label>
        </div>
        <button type="button" onClick={fill} className="btn-ghost w-full">이 기간으로 수업일 채우기</button>
        <p className="text-xs text-slate-500">주마다 월~목 4일(공휴일 있는 주·주 중간 개강 주는 금요일까지), 순서대로 월수반 → 화목반을 번갈아 채워요. 예: 12/1(화) 개강 → 1주차 화·목 월수반, 수·금 화목반.</p>
      </section>

      {/* 반별 요약 (이미지 아래쪽과 같은 내용) */}
      <section className="card space-y-2 text-sm">
        <h3 className="font-jua text-lg text-sky-ink">이 일정표로 정해지는 것</h3>
        <ul className="space-y-1.5">
          {lines.map((l) => <li key={l.text} className="flex items-start gap-2"><span className="mt-1 size-3 flex-none rounded" style={{ background: l.color }} />{l.text}</li>)}
        </ul>
        <p className="text-xs text-slate-500">저장하면 시작반·문풀반·속성반 수업일이 모두 이 일정표로 맞춰지고, 특강은 [특강 관리]에 공개 전 초안으로 들어가요(공개는 [특강 관리]에서).</p>
      </section>

      <button className="btn w-full !py-3.5">{dirty || !saved ? "일정표 저장" : "저장됨 · 다시 저장"}</button>
    </form>
  );
}

const MARK_NAME: Record<DayMark, string> = { mw: "월수반", tt: "화목반" };
const HELP: Record<Brush, string> = {
  mw: "날짜를 누르면 월수반 수업일이 돼요 (한 번 더 누르면 빠져요). 주 4일반은 월수반·화목반을 모두 들어요.",
  tt: "날짜를 누르면 화목반 수업일이 돼요 (한 번 더 누르면 빠져요). 주 4일반은 월수반·화목반을 모두 들어요.",
  special: "특강 날짜를 눌러요 (한 달에 2번). 먼저 고른 날이 1차 PART 5 액기스 특강, 다음이 2차 적중 모의고사 + 풀이예요.",
  holiday: "공휴일·휴강을 넣거나 빼요. 그날 수업은 빠지니 보강하는 날을 다시 넣어 주세요.",
  clear: "누른 날의 수업·특강을 지워요 (공개한 특강은 그대로).",
};
