// 강의·특강 열람 기간 · 종강일 연장 공지 테스트
import { test } from "node:test";
import assert from "node:assert/strict";
import { courseEndPopupOpen, viewOpen, viewPhase, viewUntil, viewableCohorts } from "@/lib/viewWindow";
import { courseEndNotices } from "@/lib/courseEndPopups";
import { canSeeSpecialMaterials } from "@/lib/special";
import { cohortUntil, studentEnd } from "@/lib/viewWindowServer";
import { createApplication, getApplication, isPreview } from "@/lib/db";
import { hashPin } from "@/lib/auth";

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

test("열람 마감일: 다음 달 첫 수업일 전날, 다음 달 수업일이 없으면 마지막 수업일 + 7일", () => {
  assert.equal(viewUntil("2026-11-02", ["2026-10-29"]), "2026-11-01");
  assert.equal(viewUntil(null, ["2026-10-27", "2026-10-29"]), "2026-11-05");
});

test("10월 기수 실제 마감일 = 11/1 (11/2 개강 전날)", async () => {
  assert.equal(await cohortUntil("2026-10"), "2026-11-01");
});

test("종강일: 종합반 10/29, 격일반은 8회차(월수 10/28 · 화목 10/29)", async () => {
  const mk = async (track: "all" | "alt_mw" | "alt_tt") => {
    const id = await createApplication({
      cohort: "2026-10", kind: "onsite", course: "start", track, continuing: false, slot: "am", pickup_date: null, pickup_time: null,
      books: [], pickup: "classroom", name: `종강${track}`, phone: null, depositor: "x", address: null, amount: 0, pin_hash: hashPin("1234"),
    });
    return studentEnd((await getApplication(id))!);
  };
  assert.equal(await mk("all"), "2026-10-29");
  const mw = await mk("alt_mw"), tt = await mk("alt_tt");
  assert.ok(mw <= "2026-10-29" && tt <= "2026-10-29", `${mw} ${tt}`);
});

test("마감 전날·당일·다음 날", () => {
  assert.equal(viewOpen("2026-11-01", "2026-10-31"), true);
  assert.equal(viewOpen("2026-11-01", "2026-11-01"), true);
  assert.equal(viewOpen("2026-11-01", "2026-11-02"), false);
});

test("안내 단계: 종강일 전·당일 → 종강일까지 / 다음 날 ~ 마감일 → 연장 / 그 뒤 → 끝", () => {
  assert.equal(viewPhase("2026-10-29", "2026-11-01", "2026-10-28"), "before");
  assert.equal(viewPhase("2026-10-29", "2026-11-01", "2026-10-29"), "endDay");
  assert.equal(viewPhase("2026-10-29", "2026-11-01", "2026-10-30"), "extended");
  assert.equal(viewPhase("2026-10-29", "2026-11-01", "2026-11-01"), "extended");
  assert.equal(viewPhase("2026-10-29", "2026-11-01", "2026-11-02"), "closed");
});

test("종강일 팝업: 종강일 당일 ~ 마감일, 격일반 종강일 기준", () => {
  assert.equal(courseEndPopupOpen("2026-10-29", "2026-11-01", "2026-10-28"), false);
  assert.equal(courseEndPopupOpen("2026-10-29", "2026-11-01", "2026-10-29"), true);
  assert.equal(courseEndPopupOpen("2026-10-28", "2026-11-01", "2026-10-28"), true); // 격일 월수 8회차
  assert.equal(courseEndPopupOpen("2026-10-29", "2026-11-01", "2026-11-02"), false);
});

test("종강일 팝업 문구: 다음 달 신청이 없으면 신청 버튼, 있으면 없음", () => {
  const base = { cohort: "2026-10", end: "2026-10-29", until: "2026-11-01", kind: "online" as const };
  const [no] = courseEndNotices([{ ...base, hasNext: false }], "2026-10-30");
  assert.equal(no.title, "🎁 종강 기념! 10월 강의를 11/1(일)까지 열어 둘게요");
  assert.equal(no.link_label, "11월 수강 신청하기");
  assert.equal(no.link_url, "/guide/online");
  const [yes] = courseEndNotices([{ ...base, hasNext: true }], "2026-10-30");
  assert.equal(yes.link_url, null);
  assert.equal(yes.sections.length, 0);
  assert.equal(yes.id, "course-end:2026-10"); // 기수별 확인 기록
});

test("특강 다시 보기도 같은 마감일 기준", () => {
  const online = { mode: "online" as const, deposit: null };
  assert.equal(canSeeSpecialMaterials(online, "2026-10-23", "2026-11-01", "2026-11-01"), true);
  assert.equal(canSeeSpecialMaterials(online, "2026-10-23", "2026-11-02", "2026-11-01"), false);
});

test("강의실 강의 기수: 열람 가능한 신청 기수만 (종강 후 다음 달 개강 전날까지 포함)", () => {
  const apps = [{ id: "sep", cohort: "2026-09" }, { id: "oct", cohort: "2026-10" }, { id: "nov", cohort: "2026-11" }, { id: "nov2", cohort: "2026-11" }];
  const w = new Map([["sep", { until: "2026-10-04" }], ["oct", { until: "2026-11-01" }], ["nov", { until: "2026-12-06" }], ["nov2", { until: "2026-12-06" }]]);
  // 10/30 종강 뒤 연장 기간: 10월 기수도 읽어요 (9월은 끝남)
  assert.deepEqual(viewableCohorts(apps, w, "2026-10-30"), ["2026-10", "2026-11"]);
  // 마감일 당일까지 포함
  assert.deepEqual(viewableCohorts(apps, w, "2026-11-01"), ["2026-10", "2026-11"]);
  // 다음 달 개강일부터 지난 기수는 빼요
  assert.deepEqual(viewableCohorts(apps, w, "2026-11-02"), ["2026-11"]);
  // 마감일을 모르면 닫힌 것으로 (강의실 viewable과 같은 규칙)
  assert.deepEqual(viewableCohorts([{ id: "x", cohort: "2026-11" }], new Map(), "2026-11-02"), []);
  // 계산 실패 시 강의실은 모두 열어 둬요 (9999-12-31)
  assert.deepEqual(viewableCohorts(apps, new Map(apps.map((a) => [a.id, { until: "9999-12-31" }])), "2026-11-13"), ["2026-09", "2026-10", "2026-11"]);
});
