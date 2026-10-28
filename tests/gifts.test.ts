// 스티커판 완성 · 선물 뽑기 테스트 (임시 저장소에서만)
import { test } from "node:test";
import assert from "node:assert/strict";
import { boardStatus, giftEligibleTrack, giftWindowOpen } from "@/lib/stickerComplete";
import { drawGift, isPreview, listGiftDraws, saveGiftItem, listGiftItems } from "@/lib/db";
import { watchSummary } from "@/lib/watchlist";

const days = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"];
const at = (day: string) => `${day}T03:00:00Z`; // 그날 낮 (별 인정)
const all = (list: string[]) => list.map((day) => ({ day }));
const hws = (list: string[]) => list.map((day) => ({ day, created_at: at(day) }));

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

test("마지막 수업일은 숙제 없이 출석만 하면 완성", () => {
  const s = boardStatus(days, all(days), hws(["2026-10-26", "2026-10-27", "2026-10-28"]), "2026-10-29");
  assert.equal(s.hwTotal, 3);
  assert.equal(s.complete, true);
});

test("지각도 출석으로 인정", () => {
  const s = boardStatus(days, days.map((day) => ({ day, late: true })), hws(days.slice(0, 3)), "2026-10-29");
  assert.equal(s.complete, true);
});

test("마지막 날 출석만 남으면 '마지막 날 출석만'", () => {
  const s = boardStatus(days, all(days.slice(0, 3)), hws(days.slice(0, 3)), "2026-10-28");
  assert.equal(s.complete, false);
  assert.equal(s.lastOnly, true);
  assert.deepEqual(s.missing, []);
});

test("모자란 날짜와 종류를 알려줘요 (늦게 낸 숙제는 별 없음)", () => {
  const late = [{ day: "2026-10-27", created_at: at("2026-10-29") }];
  const s = boardStatus(days, all(["2026-10-27", "2026-10-28"]), [...hws(["2026-10-26", "2026-10-28"]), ...late], "2026-10-28");
  assert.deepEqual(s.missing, [{ day: "2026-10-26", kind: "출석" }, { day: "2026-10-27", kind: "숙제" }]);
});

test("관리자가 붙인 ⭐(수업일 낮 시각)는 언제 붙여도 별로 인정", () => {
  const admin = [{ day: "2026-10-27", created_at: new Date("2026-10-27T12:00:00+09:00").toISOString() }];
  const s = boardStatus(days, all(days), [...hws(["2026-10-26", "2026-10-28"]), ...admin], "2026-10-30");
  assert.equal(s.complete, true);
});

test("관리 필요 집계도 마지막 날 숙제는 세지 않아요", () => {
  const s = watchSummary(days, all(days), ["2026-10-27", "2026-10-28"], "2026-11-05");
  assert.equal(s.hwMissing, 0); // 첫날·마지막 날 제외 → 10/27, 10/28만
});

test("선물 대상: 종합·속성·단과 O, 격일반 X", () => {
  assert.equal(giftEligibleTrack("all"), true);
  assert.equal(giftEligibleTrack("rc"), true);
  assert.equal(giftEligibleTrack("lc"), true);
  assert.equal(giftEligibleTrack("alt_mw"), false);
  assert.equal(giftEligibleTrack("alt_tt"), false);
});

test("뽑기 버튼은 마지막 수업일 하루에만", () => {
  assert.equal(giftWindowOpen("2026-10-29", "2026-10-28"), false);
  assert.equal(giftWindowOpen("2026-10-29", "2026-10-29"), true);
  assert.equal(giftWindowOpen("2026-10-29", "2026-10-30"), false);
  assert.equal(giftWindowOpen(null, "2026-10-29"), false);
});

test("뽑기: 학생 1명당 기수마다 1번, 수량을 넘지 않고, 다 떨어지면 무제한 기본 선물", async () => {
  const cohort = "2099-01";
  await saveGiftItem({ cohort, name: "커피", quantity: 2 });
  await saveGiftItem({ cohort, name: "기본 간식", quantity: null });
  const p = (k: string) => ({ cohort, student_key: k, app_id: k, name: k, klass: "", kind: "", code: "AB12" });
  const first = await drawGift(p("s1"));
  assert.equal((await drawGift(p("s1"))).id, first.id); // 다시 눌러도 같은 결과
  for (const k of ["s2", "s3", "s4", "s5"]) await drawGift(p(k));
  const draws = await listGiftDraws(cohort);
  assert.equal(draws.length, 5);
  const coffee = (await listGiftItems(cohort)).find((g) => g.name === "커피")!;
  assert.equal(draws.filter((d) => d.gift_id === coffee.id).length, 2); // 수량 2 그대로
  assert.equal(draws.filter((d) => d.gift_name === "기본 간식").length, 3);
});
