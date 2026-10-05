"use client";

import { useMemo, useState } from "react";
import { copyPreviousSchedule, saveSchoolSchedule } from "@/app/actions";
import { cohortLabel } from "@/lib/config";
import { SCHEDULE_CLASSES, type ScheduleClass, weekDaysInMonth } from "@/lib/schedule";

export default function ScheduleEditor({
  cohort,
  klass,
  initialDays,
  initialHolidays,
}: {
  cohort: string;
  klass: ScheduleClass;
  initialDays: string[];
  initialHolidays: Record<string, string>;
}) {
  const [days, setDays] = useState(() => new Set(initialDays));
  const [holidays, setHolidays] = useState(initialHolidays);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const weeks = useMemo(() => weekDaysInMonth(cohort), [cohort]);
  const dateOptions = weeks.flat().filter((day): day is string => !!day);
  const month = Number(cohort.slice(5));

  const toggleDay = (day: string) => {
    if (holidays[day]) return;
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const addHoliday = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!holidayDate || !holidayName.trim()) return;
    setHolidays((prev) => ({ ...prev, [holidayDate]: holidayName.trim().slice(0, 40) }));
    setDays((prev) => {
      const next = new Set(prev);
      next.delete(holidayDate);
      return next;
    });
    setHolidayName("");
  };

  return (
    <div className="space-y-5">
      <form method="get" className="card grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">기수</span>
          <input type="month" name="cohort" defaultValue={cohort} className="input" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
        </label>
        <label>
          <span className="label">반</span>
          <select name="klass" defaultValue={klass} className="input" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
            {Object.entries(SCHEDULE_CLASSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </form>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-jua text-2xl text-sky-ink">{cohortLabel(cohort)} · {SCHEDULE_CLASSES[klass]} 수업일</h2>
            <p className="mt-1 text-sm text-slate-500">요일 기준 날짜가 먼저 선택돼요.<br />날짜를 눌러 더하거나 빼고, 공휴일은 이름을 등록해 주세요.</p>
          </div>
          <span className="rounded-full bg-sky-soft px-4 py-2 font-bold text-sky-ink">선택 {days.size}일</span>
        </div>

        <div className="grid grid-cols-5 gap-1 text-center text-sm font-bold text-slate-500">
          {["월", "화", "수", "목", "금"].map((day) => <div key={day} className="py-2">{day}</div>)}
          {weeks.flatMap((week, weekIndex) => week.map((day, dayIndex) => {
            if (!day) return <div key={`blank-${weekIndex}-${dayIndex}`} />;
            const selected = days.has(day);
            const holiday = holidays[day];
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`min-h-16 rounded-xl border-2 p-1 text-center transition ${holiday ? "border-red-100 bg-red-50 text-red-500" : selected ? "border-sky-deep bg-sky-soft text-sky-ink" : "border-dashed border-slate-200 bg-slate-50 text-slate-400"}`}
                aria-pressed={selected}
                title={holiday || (selected ? "수업일 · 누르면 제외" : "수업 없음 · 누르면 추가")}
              >
                <span className="block font-jua text-lg">{Number(day.slice(-2))}</span>
                <span className="block truncate text-[10px] leading-tight">{holiday || (selected ? "수업" : "—")}</span>
              </button>
            );
          }))}
        </div>

        <form onSubmit={addHoliday} className="grid gap-2 rounded-2xl bg-sky-soft p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label>
            <span className="label">공휴일 날짜</span>
            <select value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} className="input">
              <option value="">날짜 선택</option>
              {dateOptions.map((day) => <option key={day} value={day}>{Number(day.slice(5, 7))}/{Number(day.slice(8, 10))}</option>)}
            </select>
          </label>
          <label>
            <span className="label">공휴일 이름</span>
            <input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} className="input" placeholder="예: 한글날" maxLength={40} />
          </label>
          <button className="btn-ghost !py-3" type="submit">공휴일 등록</button>
        </form>

        <form action={saveSchoolSchedule} className="flex flex-wrap gap-3">
          <input type="hidden" name="cohort" value={cohort} />
          <input type="hidden" name="klass" value={klass} />
          <input type="hidden" name="days" value={JSON.stringify([...days].sort())} />
          <input type="hidden" name="holidays" value={JSON.stringify(holidays)} />
          <button className="btn flex-1">수업일 설정 저장</button>
        </form>

        <form action={copyPreviousSchedule}>
          <input type="hidden" name="cohort" value={cohort} />
          <input type="hidden" name="klass" value={klass} />
          <button className="btn-ghost w-full" formAction={copyPreviousSchedule}>지난달 설정 복사</button>
        </form>
      </section>

      {Object.keys(holidays).length > 0 && (
        <section className="card">
          <h3 className="font-jua text-lg text-sky-ink">등록한 공휴일</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Object.entries(holidays).sort(([a], [b]) => a.localeCompare(b)).map(([day, label]) => (
              <li key={day} className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-600">
                {Number(day.slice(5, 7))}/{Number(day.slice(8, 10))} {label}
                <button type="button" onClick={() => setHolidays((prev) => {
                  const next = { ...prev };
                  delete next[day];
                  return next;
                })} className="ml-2 font-bold" aria-label={`${label} 삭제`}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="px-2 text-sm text-slate-500">수업일이 아닌 평일은 학생 달력에 날짜만 흐리게 보여요.<br />공휴일은 이름과 함께 빨간색으로 표시돼요.</p>
    </div>
  );
}
