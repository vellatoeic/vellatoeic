"use client";

import { useEffect, useMemo, useState } from "react";
import { markHomeworkDone } from "@/app/actions";
import { cohortLabel, dayLabel } from "@/lib/config";
import { weekDaysInMonth, type ScheduleClass } from "@/lib/schedule";
import Cloud from "@/components/Cloud";

export default function StickerBoard({
  appId,
  name,
  cohort,
  className,
  klass,
  scheduleDays,
  holidays,
  attendance,
  homework,
  cafeUrl,
  today,
  active,
}: {
  appId: string;
  name: string;
  cohort: string;
  className: string;
  klass: ScheduleClass;
  scheduleDays: string[];
  holidays: Record<string, string>;
  attendance: { day: string; late: boolean }[];
  homework: string[];
  cafeUrl: string;
  today: string;
  active: boolean;
}) {
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [newStickers, setNewStickers] = useState<string[]>([]);
  const weeks = useMemo(() => weekDaysInMonth(cohort), [cohort]);
  const lessonDays = useMemo(() => new Set(scheduleDays), [scheduleDays]);
  const attendanceByDay = useMemo(() => new Map(attendance.map((item) => [item.day, item])), [attendance]);
  const homeworkDays = useMemo(() => new Set(homework), [homework]);
  const total = scheduleDays.length;
  const attendanceCount = scheduleDays.filter((day) => attendanceByDay.has(day)).length;
  const lateCount = scheduleDays.filter((day) => attendanceByDay.get(day)?.late).length;
  const homeworkCount = scheduleDays.filter((day) => homeworkDays.has(day)).length;
  const stickerCount = attendanceCount + homeworkCount;
  const alternating = klass.endsWith("-mw") || klass.endsWith("-tt");
  const stickerGoal = alternating ? 10 : 20;
  const complete = total > 0 && attendanceCount === total && homeworkCount === total;
  const finishedLessons = total > 0 && attendanceCount === total;
  const firstName = name.length > 1 ? name.slice(1) : name;
  const monthName = `${Number(cohort.slice(5))}월`;
  const badgeStates = [
    { id: "attendance", title: "출석", value: `${attendanceCount}/${total}`, earned: total > 0 && attendanceCount === total },
    { id: "homework", title: "숙제", value: `${homeworkCount}/${total}`, earned: total > 0 && homeworkCount === total },
    { id: "stickers", title: "스티커", value: `${stickerCount}개`, earned: stickerCount >= stickerGoal },
    { id: "course", title: `${monthName} 강의`, value: finishedLessons ? "완주!" : "도전 중", earned: finishedLessons },
  ];

  useEffect(() => {
    const badgeKey = `vella-badges:${appId}:${cohort}`;
    const seenBadges = new Set<string>(JSON.parse(localStorage.getItem(badgeKey) ?? "[]"));
    const freshlyEarned = badgeStates.filter((badge) => badge.earned && !seenBadges.has(badge.id)).map((badge) => badge.id);
    badgeStates.filter((badge) => badge.earned).forEach((badge) => seenBadges.add(badge.id));
    localStorage.setItem(badgeKey, JSON.stringify([...seenBadges]));
    setNewBadges(freshlyEarned);

    const stickerKey = `vella-stickers:${appId}:${cohort}`;
    const seenStickers = new Set<string>(JSON.parse(localStorage.getItem(stickerKey) ?? "[]"));
    const presentToday = [attendanceByDay.has(today) ? `${today}:attendance` : "", homeworkDays.has(today) ? `${today}:homework` : ""].filter(Boolean);
    setNewStickers(presentToday.filter((key) => !seenStickers.has(key)));
    presentToday.forEach((key) => seenStickers.add(key));
    localStorage.setItem(stickerKey, JSON.stringify([...seenStickers]));
  // New earned items are evaluated once on entry, including after the server action refreshes this page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, cohort, today, attendanceCount, homeworkCount]);

  const downloadBoard = async () => {
    await document.fonts.ready;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
    if (complete) {
      gradient.addColorStop(0, "#fff1fb");
      gradient.addColorStop(0.5, "#e8f8ff");
      gradient.addColorStop(1, "#fff8dd");
    } else {
      gradient.addColorStop(0, "#eaf6fd");
      gradient.addColorStop(1, "#ffffff");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.textAlign = "center";
    ctx.fillStyle = "#12405c";
    ctx.font = "bold 68px Jua, sans-serif";
    ctx.fillText(`${firstName}의 ${monthName} 스티커판`, 540, 150);
    ctx.font = "40px Jua, sans-serif";
    ctx.fillStyle = "#2b8fc7";
    ctx.fillText(className, 540, 220);
    if (complete) {
      ctx.font = "bold 56px Jua, sans-serif";
      ctx.fillText(`🌈 ${monthName} 강의 완주! 🌈`, 540, 315);
    }

    const left = 94;
    const top = complete ? 430 : 355;
    const cellW = 178;
    const cellH = 205;
    const gap = 20;
    ctx.font = "34px Jua, sans-serif";
    ["월", "화", "수", "목", "금"].forEach((label, i) => {
      ctx.fillStyle = i === 4 ? "#e87979" : "#52768b";
      ctx.fillText(label, left + i * (cellW + gap) + cellW / 2, top - 28);
    });
    weeks.forEach((week, row) => week.forEach((day, col) => {
      if (!day) return;
      const x = left + col * (cellW + gap);
      const y = top + row * (cellH + gap);
      const schoolDay = lessonDays.has(day);
      const holiday = holidays[day];
      ctx.fillStyle = schoolDay ? "rgba(255,255,255,.96)" : "rgba(255,255,255,.54)";
      ctx.beginPath();
      ctx.roundRect(x, y, cellW, cellH, 28);
      ctx.fill();
      ctx.fillStyle = holiday ? "#e35e66" : schoolDay ? "#12405c" : "#aabac3";
      ctx.font = "36px Jua, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(String(Number(day.slice(-2))), x + 22, y + 48);
      if (holiday) {
        ctx.font = "22px Jua, sans-serif";
        ctx.fillText(holiday.slice(0, 8), x + 20, y + 83);
      }
      if (schoolDay) {
        const att = attendanceByDay.get(day);
        ctx.textAlign = "center";
        ctx.font = "55px sans-serif";
        ctx.fillText(att ? (att.late ? "🟠☁️" : "☁️") : "☁️", x + 60, y + 132);
        ctx.fillText(homeworkDays.has(day) ? "⭐" : "☆", x + 132, y + 132);
      }
    }));

    ctx.textAlign = "center";
    ctx.fillStyle = "#12405c";
    ctx.font = "bold 42px Jua, sans-serif";
    ctx.fillText(`출석 ${attendanceCount}/${total}  ·  숙제 ${homeworkCount}/${total}`, 540, 1605);
    ctx.font = "34px Jua, sans-serif";
    ctx.fillStyle = "#2b8fc7";
    ctx.fillText("토익의 시작  @vella_toeic", 540, 1790);
    const link = document.createElement("a");
    link.download = `${firstName}_${cohort}_sticker-board.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <section className={`sticker-board relative mt-4 overflow-hidden rounded-[2rem] border border-sky-main/60 p-4 shadow-[0_8px_30px_rgba(43,143,199,0.12)] sm:p-6 ${complete ? "sticker-rainbow" : "bg-white"}`}>
      {complete && <div className="sticker-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <span key={index} style={{ left: `${(index * 37) % 100}%`, animationDelay: `${(index % 8) * -0.7}s`, color: ["#f28b82", "#f7c96b", "#74c9aa", "#8db9f5", "#c49bea"][index % 5] }}>✦</span>)}</div>}
      <div className="relative z-[1]">
        {complete ? (
          <div className="mb-4 rounded-2xl bg-white/75 px-4 py-4 text-center shadow-sm">
            <p className="font-jua text-2xl text-sky-ink">🎉 {monthName} 스티커판 완성!</p>
            <p className="mt-1 font-jua text-sky-deep">{total}회 강의 + 숙제 {total}개 완주</p>
            <p className="mt-1 text-slate-700">{firstName}님 정말 대단해요 🌈</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-sky-deep">{cohortLabel(cohort)} · {className}</p>
                <h3 className="font-jua text-2xl text-sky-ink">{firstName}의 스티커판 ☁️</h3>
              </div>
              <span className="rounded-full bg-sky-soft px-3 py-1 text-sm font-bold text-sky-ink">{monthName}</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Progress label={`출석 ${attendanceCount}/${total} (지각 ${lateCount})`} value={attendanceCount} total={total} tone="sky" />
              <Progress label={`숙제 ${homeworkCount}/${total}`} value={homeworkCount} total={total} tone="amber" />
            </div>
            <p className="mt-3 text-center font-jua text-sky-ink">강의 완주까지 {Math.max(0, total - attendanceCount)}번 남았어요! 조금만 더 🔥</p>
          </>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2">
          {badgeStates.map((badge) => (
            <div key={badge.id} className={`relative rounded-2xl px-1 py-3 text-center transition ${badge.earned ? "bg-sky-soft text-sky-ink" : "bg-slate-100 text-slate-400 grayscale"}`}>
              {newBadges.includes(badge.id) && <span className="absolute -right-1 -top-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">NEW</span>}
              <span className="block text-xl">{badge.id === "attendance" ? "☁️" : badge.id === "homework" ? "⭐" : badge.id === "stickers" ? "💎" : "🏅"}</span>
              <span className="mt-1 block text-[10px] font-bold leading-tight">{badge.title}</span>
              <span className="mt-0.5 block text-[10px]">{badge.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-5 gap-1 text-center text-xs font-bold text-slate-500">
          {["월", "화", "수", "목", "금"].map((day) => <div key={day} className="py-1">{day}</div>)}
          {weeks.flatMap((week, weekIndex) => week.map((day, dayIndex) => {
            if (!day) return <div key={`empty-${weekIndex}-${dayIndex}`} />;
            const schoolDay = lessonDays.has(day);
            const holiday = holidays[day];
            const att = attendanceByDay.get(day);
            const didHomework = homeworkDays.has(day);
            const isNewAttendance = newStickers.includes(`${day}:attendance`);
            const isNewHomework = newStickers.includes(`${day}:homework`);
            const rotation = ((Number(day.slice(-2)) % 5) - 2) * 3;
            return (
              <div key={day} className={`relative flex min-h-[76px] flex-col items-center rounded-xl p-1 sm:min-h-[92px] ${schoolDay ? "border-2 border-dashed border-sky-main bg-sky-soft/70" : holiday ? "bg-red-50" : "bg-slate-50/70"} ${day === today ? "ring-2 ring-sky-deep" : ""}`}>
                <span className={`self-start text-[11px] ${holiday ? "font-bold text-red-500" : schoolDay ? "text-sky-ink" : "text-slate-300"}`}>{Number(day.slice(-2))}</span>
                {holiday && <span className="w-full truncate text-[9px] leading-tight text-red-500">{holiday}</span>}
                {schoolDay && <div className="mt-1 flex h-7 items-center justify-center gap-1 sm:gap-2">
                  <span className={`relative inline-flex ${isNewAttendance ? "sticker-pop" : ""}`} style={{ transform: `rotate(${rotation}deg)` }} title={att?.late ? "지각 출석" : att ? "출석" : "출석 기다리는 중"}>
                    <Cloud className={`h-6 w-7 ${att ? att.late ? "fill-orange-300" : "fill-sky-main" : "fill-white"}`} />
                    {att?.late && <span className="absolute -right-1 -top-1 text-[9px]">⏰</span>}
                  </span>
                  <span className={`inline-block text-base leading-none ${didHomework ? "text-amber-400" : "text-white"} ${isNewHomework ? "sticker-pop" : ""}`} style={{ transform: `rotate(${-rotation}deg)` }} title={didHomework ? "숙제 완료" : "숙제 기다리는 중"}>{didHomework ? "★" : "☆"}</span>
                </div>}
                {!schoolDay && !holiday && <span className="mt-2 text-sm text-slate-200">·</span>}
              </div>
            );
          }))}
        </div>

        {active && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {cafeUrl ? (
              <a href={cafeUrl} target="_blank" rel="noreferrer" className="btn-ghost !py-3">📝 숙제 제출하러 가기</a>
            ) : (
              <button type="button" disabled className="btn-ghost !py-3">📝 숙제 제출하러 가기</button>
            )}
            {homeworkDays.has(today) ? (
              <div className="flex items-center justify-center rounded-2xl bg-amber-50 px-3 py-3 text-center font-jua text-amber-700">오늘 숙제 제출 완료! ⭐</div>
            ) : (
              <form action={markHomeworkDone}>
                <input type="hidden" name="app_id" value={appId} />
                <input type="hidden" name="day" value={today} />
                <button type="submit" disabled={!lessonDays.has(today)} className="btn w-full !py-3">숙제 제출했어요 ✓ 스티커 받기</button>
              </form>
            )}
          </div>
        )}
        <button type="button" onClick={downloadBoard} className="btn-ghost mt-3 w-full !py-3">📸 스티커판 이미지로 저장</button>
      </div>
    </section>
  );
}

function Progress({ label, value, total, tone }: { label: string; value: number; total: number; tone: "sky" | "amber" }) {
  return (
    <div className="rounded-xl bg-white/80 px-3 py-2">
      <div className="flex justify-between text-xs font-bold text-slate-600"><span>{label}</span><span>{total ? Math.round(value / total * 100) : 0}%</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${tone === "sky" ? "bg-sky-deep" : "bg-amber-400"}`} style={{ width: `${total ? Math.min(100, value / total * 100) : 0}%` }} />
      </div>
    </div>
  );
}
