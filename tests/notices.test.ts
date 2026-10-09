// 공지 대상 자동 테스트 (가짜 학생, DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { noticeMatches, popupNotices, type Notice, type NoticeTarget } from "@/lib/notices";

// supabase/17_notices.sql 첫 공지 2개와 같은 대상
const NOTICE1: NoticeTarget[] = [{ courses: ["solve"], tracks: ["all", "rc"], kinds: ["onsite"] }];
const NOTICE2: NoticeTarget[] = [{ courses: ["intensive"] }, { courses: ["solve"], tracks: ["all", "rc"], kinds: ["online"] }];
const mk = (id: string, targets: NoticeTarget[], extra: Partial<Notice> = {}): Notice => ({
  id, title: id, to_label: "", lead: "", sections: [], link_label: null, link_url: null, targets,
  starts_on: "2026-10-09", ends_on: "2026-10-31", popup: true, pinned: false, created_at: `2026-10-09T00:00:0${id === "n1" ? 1 : 2}Z`, ...extra,
});
const n1 = mk("n1", NOTICE1), n2 = mk("n2", NOTICE2);

type S = Parameters<typeof noticeMatches>[1][number];
const st = (course: S["course"], track: S["track"], kind: S["kind"], slot: S["slot"] = "am"): S => ({ course, track, kind, slot });

const cases: [string, S, boolean, boolean][] = [
  ["문풀 종합 · 현장", st("solve", "all", "onsite"), true, false],
  ["문풀 격일 월수 · 현장", st("solve", "alt_mw", "onsite"), true, false],
  ["문풀 격일 화목 · 현장 · 저녁", st("solve", "alt_tt", "onsite", "pm"), true, false],
  ["문풀 RC 단과 · 현장", st("solve", "rc", "onsite"), true, false],
  ["문풀 종합 · 불라방", st("solve", "all", "online"), false, true],
  ["문풀 격일 · 불라방", st("solve", "alt_mw", "online"), false, true],
  ["문풀 RC 단과 · 불라방", st("solve", "rc", "online"), false, true],
  ["속성반 · 현장", st("intensive", "all", "onsite"), false, true],
  ["속성반 · 불라방", st("intensive", "all", "online"), false, true],
  ["문풀 LC 단과 · 현장", st("solve", "lc", "onsite"), false, false],
  ["문풀 LC 단과 · 불라방", st("solve", "lc", "online"), false, false],
  ["시작반 종합 · 현장", st("start", "all", "onsite"), false, false],
  ["시작반 격일 · 불라방", st("start", "alt_tt", "online"), false, false],
];

for (const [label, s, see1, see2] of cases) {
  test(`공지 대상: ${label} → ①${see1 ? "보임" : "안 보임"} ②${see2 ? "보임" : "안 보임"}`, () => {
    assert.equal(noticeMatches(n1, [s]), see1);
    assert.equal(noticeMatches(n2, [s]), see2);
  });
}

test("로그인 안 한 방문자는 '전체' 공지만", () => {
  const all = mk("all", []);
  assert.equal(noticeMatches(all, []), true);
  assert.equal(noticeMatches(n1, []), false);
  assert.equal(noticeMatches(n2, []), false);
});

test("확인한 공지는 다시 안 떠요", () => {
  const s = st("solve", "all", "onsite");
  assert.deepEqual(popupNotices([n1, n2], [s], new Set(), "2026-10-10").map((n) => n.id), ["n1"]);
  assert.deepEqual(popupNotices([n1, n2], [s], new Set(["n1"]), "2026-10-10"), []);
});

test("게시 기간 밖이거나 팝업이 꺼진 공지는 안 떠요", () => {
  const s = st("solve", "all", "onsite");
  assert.deepEqual(popupNotices([n1], [s], new Set(), "2026-11-01"), []);
  assert.deepEqual(popupNotices([mk("n3", NOTICE1, { popup: false })], [s], new Set(), "2026-10-10"), []);
});

test("여러 개면 최신순 (상단 고정이 먼저)", () => {
  const s = st("intensive", "all", "online");
  const a = mk("a", [], { created_at: "2026-10-09T01:00:00Z" });
  const b = mk("b", [], { created_at: "2026-10-09T02:00:00Z" });
  const p = mk("p", [], { created_at: "2026-10-01T00:00:00Z", pinned: true });
  assert.deepEqual(popupNotices([a, b, p], [s], new Set(), "2026-10-10").map((n) => n.id), ["p", "b", "a"]);
});
