// [일정표] 이미지 (학원 제출용): 달력 + 반별 기간 + 특강 + 공휴일을 한 장(가로 1080px)으로 그려
// 휴대폰이면 공유 창(카톡 등)으로 바로 보내고, 안 되면 파일로 저장해요. 이모티콘은 쓰지 않아요.
import { summarize, type Marks } from "@/lib/timetable";

const FONT = "'Pretendard Variable', Pretendard, sans-serif";
export const COLORS = { mw: "#2b8fc7", tt: "#f08a24", special: "#7c4dcc", holiday: "#e5484d", ink: "#12466b", sub: "#5b7a90", sat: "#2b6fd6" };
const DOW = "일월화수목금토";
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
export const dayLabel = (d: string) => `${md(d)}(${DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;
export const specialShort = (title: string) => (/PART\s*5/i.test(title) ? "PART 5 특강" : title.includes("모의고사") ? "모의고사 특강" : "특강");

export type ImageSpecial = { date: string; title: string; starts_at: string; ends_at: string | null };

export function monthWeeks(cohort: string): (string | null)[][] {
  const [y, m] = cohort.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(new Date(Date.UTC(y, m - 1, 1)).getUTCDay()).fill(null);
  for (let d = 1; d <= last; d++) cells.push(`${cohort}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function legendLines(marks: Marks, specials: ImageSpecial[], holidays: Record<string, string>) {
  const s = summarize(marks);
  const span = (a: string[]) => (a.length ? `${dayLabel(a[0])} ~ ${dayLabel(a.at(-1)!)}` : "수업 없음");
  const all = Object.keys(marks).sort();
  return [
    { color: COLORS.mw, text: `월수반 (격일반) ${s.mw.length}회 · ${span(s.mw)}` },
    { color: COLORS.tt, text: `화목반 (격일반) ${s.tt.length}회 · ${span(s.tt)}` },
    { color: COLORS.ink, text: `주 4일반 (종합·단과·속성) = 월수반 + 화목반 ${s.total}회 · ${span(all)}` },
    ...specials.map((p, i) => ({ color: COLORS.special, text: `특강 ${i + 1}차 ${dayLabel(p.date)} ${p.starts_at}~${p.ends_at ?? ""} ${p.title}` })),
    ...Object.entries(holidays).sort(([a], [b]) => a.localeCompare(b)).map(([d, n]) => ({ color: COLORS.holiday, text: `공휴일 ${dayLabel(d)} ${n}` })),
  ];
}

export async function drawTimetable(cohort: string, marks: Marks, specials: ImageSpecial[], holidays: Record<string, string>) {
  await Promise.all([document.fonts.load(`800 40px ${FONT}`, "일정표 0123456789 월수 화목 특강 개강 종강"), document.fonts.load(`600 28px ${FONT}`, "주 4일반 공휴일")]).catch(() => undefined);
  const s = summarize(marks);
  const weeks = monthWeeks(cohort);
  const lines = legendLines(marks, specials, holidays);
  const W = 1080, P = 56, cw = (W - P * 2) / 7, ch = 150, headH = 300, gridTop = headH + 70;
  const legendTop = gridTop + weeks.length * ch + 48;
  const H = legendTop + 60 + lines.length * 54 + 150;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4faff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // 머리: 로고 · 제목 · 개강/종강
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.mw;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText("VELLA TOEIC", P, 92);
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 68px ${FONT}`;
  ctx.fillText(`${Number(cohort.slice(5, 7))}월 수업 일정표`, P, 176);
  ctx.fillStyle = COLORS.sub;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText(`${cohort.slice(0, 4)}년 ${Number(cohort.slice(5, 7))}월 · YBM어학원 부산 서면센터 · 벨라토익`, P, 222);
  const tags = [s.first ? `개강 ${dayLabel(s.first)}` : "", s.last ? `종강 ${dayLabel(s.last)}` : "", `주 4일반 ${s.total}회`].filter(Boolean);
  let tx = P;
  ctx.font = `800 26px ${FONT}`;
  for (const [i, t] of tags.entries()) {
    const w = ctx.measureText(t).width + 36;
    pill(ctx, tx, 244, w, 44, 22, i === 0 ? COLORS.mw : i === 1 ? COLORS.ink : "#ffffff");
    ctx.fillStyle = i < 2 ? "#ffffff" : COLORS.ink;
    ctx.fillText(t, tx + 18, 275);
    tx += w + 12;
  }

  // 달력
  pill(ctx, P - 12, gridTop - 66, W - P * 2 + 24, weeks.length * ch + 78, 28, "#ffffff");
  ctx.textAlign = "center";
  ctx.font = `800 26px ${FONT}`;
  [...DOW].forEach((d, i) => {
    ctx.fillStyle = i === 0 ? COLORS.holiday : i === 6 ? COLORS.sat : COLORS.sub;
    ctx.fillText(d, P + cw * i + cw / 2, gridTop - 22);
  });
  const sp = [...specials].sort((a, b) => a.date.localeCompare(b.date));
  weeks.forEach((week, r) => week.forEach((day, c) => {
    const x = P + c * cw, y = gridTop + r * ch;
    ctx.strokeStyle = "#e3eef6";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cw, ch);
    if (!day) return;
    const hol = holidays[day];
    if (hol) { ctx.fillStyle = "#fff1f1"; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2); }
    ctx.textAlign = "left";
    ctx.font = `800 30px ${FONT}`;
    ctx.fillStyle = hol || c === 0 ? COLORS.holiday : c === 6 ? COLORS.sat : COLORS.ink;
    ctx.fillText(String(Number(day.slice(8))), x + 12, y + 38);
    if (day === s.first || day === s.last) {
      const t = day === s.first ? "개강" : "종강";
      ctx.font = `800 18px ${FONT}`;
      const w = ctx.measureText(t).width + 16;
      pill(ctx, x + cw - w - 8, y + 14, w, 28, 14, day === s.first ? COLORS.mw : COLORS.ink);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(t, x + cw - w, y + 34);
    }
    let cy = y + 52;
    if (hol) {
      ctx.font = `700 19px ${FONT}`;
      ctx.fillStyle = COLORS.holiday;
      ctx.fillText(hol.length > 7 ? `${hol.slice(0, 7)}…` : hol, x + 12, cy + 18);
      cy += 28;
    }
    const chip = (label: string, color: string) => {
      pill(ctx, x + 8, cy, cw - 16, 38, 12, color);
      ctx.textAlign = "center";
      ctx.font = `800 21px ${FONT}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x + cw / 2, cy + 26);
      ctx.textAlign = "left";
      cy += 44;
    };
    const m = marks[day];
    if (m) chip(`${m === "mw" ? "월수" : "화목"} ${s.nth[day]}`, m === "mw" ? COLORS.mw : COLORS.tt);
    const si = sp.findIndex((p) => p.date === day);
    if (si >= 0) chip(specialShort(sp[si].title), COLORS.special);
  }));

  // 안내
  pill(ctx, P - 12, legendTop, W - P * 2 + 24, 36 + lines.length * 54, 28, "#ffffff");
  ctx.textAlign = "left";
  lines.forEach((l, i) => {
    const y = legendTop + 54 + i * 54;
    pill(ctx, P + 10, y - 22, 24, 24, 6, l.color);
    ctx.fillStyle = COLORS.ink;
    ctx.font = `700 27px ${FONT}`;
    let text = l.text;
    while (ctx.measureText(text).width > W - P * 2 - 60 && text.length > 4) text = text.slice(0, -2);
    ctx.fillText(text === l.text ? text : `${text}…`, P + 48, y);
  });
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.mw;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText("토익의 시작, 벨라토익", W / 2, H - 76);
  ctx.fillStyle = "#7aa3bd";
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText("@vella_toeic", W / 2, H - 40);
  return canvas;
}

// 휴대폰: 공유 창(카톡·문자 등) / 안 되면 파일 저장
export async function shareTimetable(canvas: HTMLCanvasElement, cohort: string) {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return "fail" as const;
  const name = `벨라토익_${cohort}_일정표.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${Number(cohort.slice(5, 7))}월 수업 일정표` });
      return "shared" as const;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled" as const;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "saved" as const;
}
