/**
 * 시험용 수강증 **글자** — YBM 수강증 카드의 칸 차례대로 OCR 이 내놓는 모양을 흉내 낸다 (그림은 만들지 않는다).
 * 값은 벨라토익 12월 강좌 표기. 이름은 예시(홍길동).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Section } from "@/lib/receipt/match";

export type CardOpts = { captured: string; month: string; title: string; goal: string; name: string; level: string; room: string; days: string; time: string; extra: string };

export function card(o: Partial<CardOpts> = {}): string {
  return [
    `현재시간 ${o.captured ?? "2026-11-24 19:01:58"}`,
    o.month ?? "12월 과정",
    `벨라토익 ${o.title ?? "[종합반]"}`,
    o.goal ?? "750 목표",
    `수강생 _ ${o.name ?? "홍길동"}`,
    "수강센터 부산 서면센터",
    "강사 _ 벨라(김지민)",
    `레벨 ${o.level ?? "750+"}`,
    `강의실 ${o.room ?? "801호"}`,
    `수강요일 ${o.days ?? "[4주-12/01] 월화수목 (월16회)"}`,
    `수강시간 ${o.time ?? "18:00~20:10"}`,
    o.extra ?? "",
  ].join("\n");
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(fs.readFileSync(path.join(here, "sections.sample.json"), "utf8")) as { sections: Section[] };

/** 12월 반 22개 (YBM 강좌 페이지 표기) — term · 개강일을 바꿔 다른 달도 만든다 */
export function sectionsFor(term = "2026-12", startsOn = "2026-12-07", endsOn = "2026-12-31"): Section[] {
  const mm = term.slice(5, 7);
  return sample.sections.map((s) => ({ ...s, id: s.id.replace(/^12-/, `${mm}-`), term, startsOn, endsOn }));
}
