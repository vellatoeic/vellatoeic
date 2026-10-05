"use client";

import { useEffect, useMemo, useState } from "react";
import { cancelMyHomeworkDone, markHomeworkDone } from "@/app/actions";
import { weekDaysInMonth, type ScheduleClass } from "@/lib/schedule";
import Cloud from "@/components/Cloud";

type StampAttendance = { day: string; late: boolean };

export default function StickerBoard({
  appId,
  name,
  cohort,
  className: _className,
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
  attendance: StampAttendance[];
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
  const monthNumber = Number(cohort.slice(5));
  const monthName = `${monthNumber}월`;
  const firstName = name.length > 1 ? name.slice(1) : name;
  const [year, month] = cohort.split("-").map(Number);
  const startDate = scheduleDays[0] ? `${Number(scheduleDays[0].slice(5, 7))}/${Number(scheduleDays[0].slice(8, 10))}` : `${monthNumber}/1`;
  const displayClass = klass === "start-all" ? "시작반 종합"
    : klass === "start-mw" ? "시작반 격일 (월·수)"
      : klass === "start-tt" ? "시작반 격일 (화·목)"
        : klass === "solve-all" ? "문풀반 종합"
          : klass === "solve-mw" ? "문풀반 격일 (월·수)"
            : klass === "solve-tt" ? "문풀반 격일 (화·목)" : "속성반";
  const classSummary = `${displayClass} · ${startDate} 개강 · 총 ${total}회`;
  const todayIsLesson = lessonDays.has(today);
  const todayHomeworkDone = homeworkDays.has(today);

  const badgeStates = [
    { id: "attendance", title: "출석", count: `${attendanceCount}/${total}`, earned: attendanceCount > 0, icon: "cloud" as const, color: "#d9f0fd" },
    { id: "homework", title: "숙제", count: `${homeworkCount}/${total}`, earned: homeworkCount > 0, icon: "star" as const, color: "#fff3c4" },
    { id: "stickers", title: `스티커 ${stickerGoal}개`, count: `${Math.min(stickerCount, stickerGoal)}/${stickerGoal}`, earned: stickerCount >= stickerGoal, icon: "medal" as const, color: "#ffe1ea" },
    { id: "course", title: `${monthNumber}월 강의`, count: `${attendanceCount}/${total}`, earned: complete, icon: "rainbow" as const, color: "linear-gradient(135deg,#ffd6e0,#fff1b8,#cdeffd,#d9d2ff)" },
  ];

  useEffect(() => {
    try {
      const badgeKey = `vella-badges:${appId}:${cohort}`;
      const storedBadges: unknown = JSON.parse(localStorage.getItem(badgeKey) ?? "[]");
      const seenBadges = new Set(Array.isArray(storedBadges) ? storedBadges.filter((v): v is string => typeof v === "string") : []);
      const freshlyEarned = badgeStates.filter((badge) => badge.earned && !seenBadges.has(badge.id)).map((badge) => badge.id);
      badgeStates.filter((badge) => badge.earned).forEach((badge) => seenBadges.add(badge.id));
      localStorage.setItem(badgeKey, JSON.stringify([...seenBadges]));
      setNewBadges(freshlyEarned);

      const stickerKey = `vella-stickers:${appId}:${cohort}`;
      const storedStickers: unknown = JSON.parse(localStorage.getItem(stickerKey) ?? "[]");
      const seenStickers = new Set(Array.isArray(storedStickers) ? storedStickers.filter((v): v is string => typeof v === "string") : []);
      const presentToday = [attendanceByDay.has(today) ? `${today}:attendance` : "", homeworkDays.has(today) ? `${today}:homework` : ""].filter(Boolean);
      setNewStickers(presentToday.filter((key) => !seenStickers.has(key)));
      presentToday.forEach((key) => seenStickers.add(key));
      localStorage.setItem(stickerKey, JSON.stringify([...seenStickers]));
    } catch {
      setNewBadges([]);
      setNewStickers([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, cohort, today, attendanceCount, homeworkCount]);

  const downloadBoard = async () => {
    await document.fonts.ready;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const fullGradient = ctx.createLinearGradient(0, 0, 0, 1920);
    if (complete) {
      fullGradient.addColorStop(0, "#ffd9e4");
      fullGradient.addColorStop(0.35, "#fff3c4");
      fullGradient.addColorStop(0.7, "#d6f1ff");
      fullGradient.addColorStop(1, "#fff");
    } else {
      fullGradient.addColorStop(0, "#bfe6fb");
      fullGradient.addColorStop(0.6, "#e9f7ff");
      fullGradient.addColorStop(1, "#fff");
    }
    ctx.fillStyle = fullGradient;
    ctx.fillRect(0, 0, 1080, 1920);
    drawStoryCloud(ctx, -40, 250, 135, "rgba(255,255,255,.7)");
    drawStoryCloud(ctx, 810, 600, 120, "rgba(255,255,255,.7)");
    drawStoryCloud(ctx, 800, 1500, 135, "rgba(255,255,255,.7)");
    ctx.textAlign = "center";
    ctx.fillStyle = "#1f5a80";
    ctx.font = "72px Jua, sans-serif";
    ctx.fillText(`${firstName}의 ${monthName} 스티커판`, 540, 210);
    ctx.fillStyle = "#5b88a6";
    ctx.font = "34px 'Gowun Dodum', sans-serif";
    ctx.fillText(classSummary, 540, 275);

    const cols = 5;
    const colGap = 18;
    const side = 76;
    const contentWidth = 1080 - side * 2;
    const cellWidth = (contentWidth - colGap * (cols - 1)) / cols;
    const gridTop = 365;
    const cellHeight = 138;
    const rowGap = 14;
    const gridRows = weeks.length;
    roundRect(ctx, side, gridTop - 20, contentWidth, gridRows * cellHeight + (gridRows - 1) * rowGap + 40, 44, "#fff", "#cde8f8", 4);
    weeks.forEach((week, row) => week.forEach((day, col) => {
      if (!day) return;
      const x = side + col * (cellWidth + colGap);
      const y = gridTop + row * (cellHeight + rowGap);
      const isLesson = lessonDays.has(day);
      const isHoliday = !!holidays[day];
      ctx.fillStyle = isLesson ? "#fff" : "#f4fbff";
      roundRect(ctx, x, y, cellWidth, cellHeight, 26, ctx.fillStyle, isLesson ? "#c9e4f5" : "transparent", 2, isLesson ? [10, 8] : []);
      ctx.textAlign = "center";
      ctx.font = "36px Jua, sans-serif";
      ctx.fillStyle = isHoliday ? "#e5707e" : isLesson ? "#5b88a6" : "#c6dceb";
      ctx.fillText(String(Number(day.slice(-2))), x + cellWidth / 2, y + 51);
      if (isLesson) {
        const att = attendanceByDay.get(day);
        const homeworkDone = homeworkDays.has(day);
        if (att) drawStoryCloud(ctx, x + cellWidth / 2 - 49, y + 71, 42, att.late ? "#ffb685" : "#79c6ef", true);
        else drawStoryCircle(ctx, x + cellWidth / 2 - 45, y + 104, 13);
        if (homeworkDone) drawStoryStar(ctx, x + cellWidth / 2 + 10, y + 78, 48);
        else drawStoryCircle(ctx, x + cellWidth / 2 + 25, y + 104, 13);
      } else if (isHoliday) {
        ctx.font = "22px Jua, sans-serif";
        ctx.fillText(holidays[day], x + cellWidth / 2, y + 91);
      }
    }));

    if (complete) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#e0567a";
      ctx.font = "58px Jua, sans-serif";
      ctx.fillText(`🌈 ${monthName} 강의 완주! 🌈`, 540, 1395);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#1f5a80";
    ctx.font = "44px Jua, sans-serif";
    ctx.fillText(`☁️ 출석 ${attendanceCount}     ⭐ 숙제 ${homeworkCount}`, 540, 1515);
    ctx.font = "42px Jua, sans-serif";
    ctx.fillText(displayClass, 540, 1600);
    ctx.font = "38px Jua, sans-serif";
    ctx.fillStyle = "#2b8fc7";
    ctx.fillText("토익의 시작", 540, 1770);
    ctx.font = "30px Jua, sans-serif";
    ctx.fillStyle = "#7aa3bd";
    ctx.fillText("@vella_toeic ☁️", 540, 1815);

    const link = document.createElement("a");
    link.download = `${firstName}_${cohort}_sticker-board.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <section className="sticker-phone relative mx-auto mt-4 w-full max-w-[390px] overflow-hidden rounded-[36px] border-[10px] border-white bg-[#eef8fe] shadow-[0_18px_40px_rgba(31,90,128,.18)]">
      {complete && <Confetti />}
      <header className="relative z-[1] flex items-center justify-between border-b border-[#cfe9f8] bg-[#eef8fe]/95 px-4 py-3">
        <div>
          <small className="block font-jua text-[11px] text-[#7aa3bd]">토익의 시작</small>
          <strong className="font-jua text-[21px] font-normal text-[#1f5a80]">vella_toeic ☁️</strong>
        </div>
        <span className="rounded-full bg-[#9fd8f5] px-3 py-2 text-[13px] font-bold text-[#1f5a80]">강의실</span>
      </header>

      <main className="relative z-[1] px-[14px] pb-[22px] pt-[18px]">
        <h2 className="text-center font-jua text-[26px] font-normal text-[#1f5a80]">{firstName}님의 {monthName} 스티커판</h2>
        <p className="mt-1 text-center text-[13px] text-[#6b93ad]">{classSummary}</p>

        {complete ? (
          <div className="sticker-complete mt-[14px] rounded-[22px] px-4 py-4 text-center">
            <b className="block font-jua text-2xl font-normal">🎉 {monthName} 스티커판 완성!</b>
            <span className="mt-1 block text-[13.5px]">{total}회 강의 + 숙제 {total}개 완주<br />{firstName}님 정말 대단해요 🌈</span>
          </div>
        ) : (
          <div className="mt-[14px] rounded-[22px] bg-white p-4 shadow-[0_2px_0_#d5ecf9]">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span>☁️ 출석</span>
              <span><b className="font-jua text-lg font-normal">{attendanceCount}</b> / {total} {lateCount > 0 && <small className="text-[#e08a4e]">(지각 {lateCount})</small>}</span>
            </div>
            <Progress value={attendanceCount} total={total} color="#79c6ef" />
            <div className="mb-1.5 mt-3 flex items-baseline justify-between text-sm">
              <span>⭐ 숙제</span>
              <span><b className="font-jua text-lg font-normal">{homeworkCount}</b> / {total}</span>
            </div>
            <Progress value={homeworkCount} total={total} color="#ffd23f" />
            <p className="mt-3 rounded-[14px] bg-[#fff7d6] px-2 py-[9px] text-center font-jua text-base text-[#a7741a]">강의 완주까지 {Math.max(0, total - attendanceCount)}번 남았어요! 조금만 더 🔥</p>
          </div>
        )}

        {!complete && active && todayIsLesson && (
          todayHomeworkDone ? (
            <div className="mt-[14px] rounded-[22px] border-2 border-[#ffe9a3] bg-[#fffbea] px-4 py-3 text-center text-[#a7741a]">
              <p className="font-jua text-base">오늘 숙제 제출 완료! ⭐</p>
              <form action={cancelMyHomeworkDone} className="mt-1">
                <input type="hidden" name="app_id" value={appId} />
                <input type="hidden" name="day" value={today} />
                <button className="rounded-full px-3 py-1 text-xs text-[#a7741a]/70 underline underline-offset-2">잘못 눌렀어요 · 스티커 취소</button>
              </form>
            </div>
          ) : (
            <div className="mt-[14px] rounded-[22px] border-2 border-[#ffe58a] bg-gradient-to-br from-[#fff9e0] to-white p-4 shadow-[0_2px_0_#d5ecf9]">
              <a href={cafeUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!cafeUrl} className={`block w-full rounded-2xl bg-[#ffd23f] px-3 py-[13px] text-center font-jua text-lg text-[#5a3b00] shadow-[0_4px_0_#e0b400] ${cafeUrl ? "" : "pointer-events-none opacity-50"}`}>📝 숙제 제출하러 가기</a>
              <form action={markHomeworkDone} className="mt-2">
                <input type="hidden" name="app_id" value={appId} />
                <input type="hidden" name="day" value={today} />
                <button className="block w-full rounded-2xl border-2 border-dashed border-[#e0b400] bg-white px-3 py-2.5 font-jua text-[15px] text-[#a7741a]">숙제 제출했어요 ✓ 스티커 받기</button>
              </form>
            </div>
          )
        )}

        <div className="mt-[14px] rounded-[22px] bg-white p-4 shadow-[0_2px_0_#d5ecf9]">
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {badgeStates.map((badge) => (
              <div key={badge.id}>
                <div className={`relative mx-auto mb-1 grid h-[58px] w-[58px] place-items-center rounded-full border-[3px] border-white shadow-[0_2px_6px_rgba(31,90,128,.2)] ${badge.earned ? "" : "opacity-55 grayscale"}`} style={{ background: badge.earned ? badge.color : "#eef2f5" }}>
                  <BadgeIcon type={badge.icon} />
                  {newBadges.includes(badge.id) && <span className="absolute -mt-[60px] ml-[42px] rounded-full bg-[#ff6b8a] px-1.5 py-0.5 font-jua text-[10px] text-white">NEW</span>}
                </div>
                <p className="m-0 font-jua text-xs leading-[1.3] text-[#1f5a80]">{badge.title}<br /><small className="font-body text-[11px] text-[#7aa3bd]">{badge.count}</small></p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-[14px] rounded-[22px] bg-white p-4 shadow-[0_2px_0_#d5ecf9]">
          <div className="mb-1.5 grid grid-cols-5 gap-[5px] text-center font-jua text-[13px] text-[#7aa3bd]">
            {["월", "화", "수", "목", "금"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-5 gap-[5px]">
            {weeks.flatMap((week, weekIndex) => week.map((day, dayIndex) => {
              if (!day) return <div key={`blank-${weekIndex}-${dayIndex}`} className="invisible min-h-[74px]" />;
              const isLesson = lessonDays.has(day);
              const holiday = holidays[day];
              const isToday = day === today;
              const att = attendanceByDay.get(day);
              const didHomework = homeworkDays.has(day);
              const future = isLesson && day > today;
              const missed = isLesson && day <= today && !att;
              const rotation = ((Number(day.slice(-2)) * 7) % 25) - 12;
              const cloudNew = newStickers.includes(`${day}:attendance`);
              const starNew = newStickers.includes(`${day}:homework`);
              return (
                <div key={day} className={`relative min-h-[74px] min-w-0 rounded-[14px] border-2 px-px pb-1 pt-1 ${holiday ? "sticker-day-holiday" : !isLesson ? "border-2 border-transparent bg-transparent" : future || missed ? "border-dashed border-[#c4e2f4] bg-white" : isToday ? "border-[#2b8fc7] bg-[#eaf6fd]" : "border-[#e1f1fb] bg-[#f7fcff]"}`}>
                  {isToday && <span className="absolute -right-1 -top-2 rounded-full bg-[#2b8fc7] px-1.5 py-0.5 font-jua text-[10px] text-white">오늘</span>}
                  <div className={`pl-1 text-left font-jua text-sm ${holiday ? "text-[#e5707e]" : isToday ? "text-[#2b8fc7]" : isLesson ? "text-[#5b88a6]" : "text-[#c6dceb]"}`}>{Number(day.slice(-2))}</div>
                  {holiday && <div className="mt-2 truncate font-jua text-[10px] text-[#e5707e]">{holiday}</div>}
                  {isLesson && <div className="mt-[3px] flex h-[30px] justify-center">
                    <div className="grid w-7 place-items-center">
                      {att ? <span className={cloudNew ? "mock-pop" : ""} style={{ display: "inline-block", transform: `rotate(${rotation}deg)`, ["--r" as string]: `${rotation}deg` } as React.CSSProperties}><CloudSticker fill={att.late ? "#ffb685" : "#79c6ef"} size={27} /></span> : <EmptySlot />}
                    </div>
                    <div className="grid w-7 place-items-center">
                      {didHomework ? <span className={starNew ? "mock-pop" : ""} style={{ display: "inline-block", transform: `rotate(${-rotation}deg)`, ["--r" as string]: `${-rotation}deg` } as React.CSSProperties}><StarSticker size={23} /></span> : future ? <EmptySlot /> : missed ? <EmptySlot /> : null}
                    </div>
                  </div>}
                </div>
              );
            }))}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-[#5b88a6]">
            <span className="flex items-center gap-[3px]"><CloudSticker fill="#79c6ef" size={22} />출석</span>
            <span className="flex items-center gap-[3px]"><CloudSticker fill="#ffb685" size={22} />지각 출석</span>
            <span className="flex items-center gap-[3px]"><StarSticker size={18} />숙제</span>
          </div>
        </div>

        <button type="button" onClick={downloadBoard} className="mt-[14px] block w-full rounded-[18px] bg-[#2b8fc7] px-3 py-3.5 font-jua text-lg text-white shadow-[0_4px_0_#1f6f9d]">📸 스티커판 이미지로 저장</button>
      </main>
    </section>
  );
}

function Progress({ value, total, color }: { value: number; total: number; color: string }) {
  return <div className="mb-3 h-3 overflow-hidden rounded-full bg-[#e6f4fc]"><i className="block h-full rounded-full transition-all" style={{ width: `${total ? Math.min(100, value / total * 100) : 0}%`, background: color }} /></div>;
}

function BadgeIcon({ type }: { type: "cloud" | "star" | "medal" | "rainbow" }) {
  if (type === "cloud") return <CloudSticker fill="#79c6ef" size={34} face={false} />;
  if (type === "star") return <StarSticker size={32} face={false} />;
  return <span className="text-[26px]">{type === "medal" ? "🏅" : "🌈"}</span>;
}

function CloudSticker({ fill, size, face = true }: { fill: string; size: number; face?: boolean }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 64 50" aria-hidden="true" className="shrink-0">
      <g fill="white" stroke="white" strokeWidth="7" strokeLinejoin="round"><CloudParts /></g>
      <g fill={fill}><CloudParts /></g>
      {face && <g fill="#24445c">
        <circle cx="26" cy="31" r="2" /><circle cx="38" cy="31" r="2" />
        <path d="M29 35q3 3 6 0" stroke="#24445c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <ellipse cx="21" cy="35" rx="3" ry="1.8" fill="#ff9fb4" opacity=".8" /><ellipse cx="43" cy="35" rx="3" ry="1.8" fill="#ff9fb4" opacity=".8" />
      </g>}
    </svg>
  );
}

function CloudParts() {
  return <><circle cx="18" cy="30" r="10" /><circle cx="31" cy="22" r="13" /><circle cx="45" cy="29" r="10" /><rect x="9" y="27" width="46" height="14" rx="7" /></>;
}

function StarSticker({ size, face = true }: { size: number; face?: boolean }) {
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 ? 10.5 : 22;
    return `${(25 + radius * Math.cos(angle)).toFixed(1)},${(27 + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" aria-hidden="true" className="shrink-0">
      <polygon points={points} fill="white" stroke="white" strokeWidth="7" strokeLinejoin="round" />
      <polygon points={points} fill="#ffd23f" stroke="#f5b800" strokeWidth="1.2" strokeLinejoin="round" />
      {face && <g fill="#5a3b00"><circle cx="21" cy="27" r="1.8" /><circle cx="29" cy="27" r="1.8" /><path d="M22.5 31q2.5 2.5 5 0" stroke="#5a3b00" strokeWidth="1.6" fill="none" strokeLinecap="round" /></g>}
    </svg>
  );
}

function EmptySlot() {
  return <span className="h-[18px] w-[18px] rounded-full border-2 border-dashed border-[#cfe6f4]" />;
}

function Confetti() {
  const colors = ["#ff8fab", "#ffd23f", "#79c6ef", "#b9a7ff", "#8fe3b0"];
  return <div className="mock-confetti" aria-hidden="true">{Array.from({ length: 40 }, (_, index) => <i key={index} style={{ left: `${(index * 47 + 9) % 100}%`, background: colors[index % colors.length], animationDelay: `${-(index * 13 % 32) / 10}s`, animationDuration: `${2.6 + (index * 7 % 16) / 10}s` }} />)}</div>;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke = "transparent", lineWidth = 0, dash: number[] = []) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke !== "transparent") {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawStoryCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string, face = false) {
  const scale = size / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(18, 30, 10, 0, Math.PI * 2);
  ctx.arc(31, 22, 13, 0, Math.PI * 2);
  ctx.arc(45, 29, 10, 0, Math.PI * 2);
  ctx.roundRect(9, 27, 46, 14, 7);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(18, 30, 10, 0, Math.PI * 2);
  ctx.arc(31, 22, 13, 0, Math.PI * 2);
  ctx.arc(45, 29, 10, 0, Math.PI * 2);
  ctx.roundRect(9, 27, 46, 14, 7);
  ctx.fill();
  if (face) {
    ctx.fillStyle = "#24445c";
    ctx.beginPath();
    ctx.arc(26, 31, 1.8, 0, Math.PI * 2);
    ctx.arc(38, 31, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStoryStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 50, size / 50);
  ctx.beginPath();
  for (let index = 0; index < 10; index++) {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 ? 10.5 : 22;
    const px = 25 + radius * Math.cos(angle);
    const py = 27 + radius * Math.sin(angle);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "white";
  ctx.strokeStyle = "white";
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffd23f";
  ctx.strokeStyle = "#f5b800";
  ctx.lineWidth = 1.2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStoryCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#cfe6f4";
  ctx.lineWidth = 4;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
