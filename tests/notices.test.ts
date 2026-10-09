// 공지 대상 자동 테스트 (가짜 학생, DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { noticeMatches, popupNotices, type Notice, type NoticeTarget } from "@/lib/notices";

// supabase/17_notices.sql 첫 공지 2개와 같은 대상 (SQL을 고치면 여기도 같이 고쳐요)
// ① 문풀반(종합·격일·RC 단과) 현장 + 속성반 저녁반 현장
const NOTICE1: NoticeTarget[] = [
  { courses: ["solve"], tracks: ["all", "rc"], kinds: ["onsite"] },
  { courses: ["intensive"], kinds: ["onsite"], slots: ["pm"] },
];
// ② 문풀반(종합·격일·RC 단과) 불라방 + 속성반 오전반 전체 + 속성반 저녁반 불라방
const NOTICE2: NoticeTarget[] = [
  { courses: ["solve"], tracks: ["all", "rc"], kinds: ["online"] },
  { courses: ["intensive"], slots: ["am"] },
  { courses: ["intensive"], kinds: ["online"], slots: ["pm"] },
];
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
  ["속성반 오전 · 현장", st("intensive", "all", "onsite", "am"), false, true],
  ["속성반 오전 · 불라방", st("intensive", "all", "online", "am"), false, true],
  ["속성반 저녁 · 현장", st("intensive", "all", "onsite", "pm"), true, false],
  ["속성반 저녁 · 불라방", st("intensive", "all", "online", "pm"), false, true],
  ["문풀 종합 · 현장 · 저녁", st("solve", "all", "onsite", "pm"), true, false],
  ["문풀 종합 · 불라방 · 저녁", st("solve", "all", "online", "pm"), false, true],
  ["문풀 LC 단과 · 현장", st("solve", "lc", "onsite"), false, false],
  ["문풀 LC 단과 · 불라방", st("solve", "lc", "online"), false, false],
  ["문풀 LC 단과 · 현장 · 저녁", st("solve", "lc", "onsite", "pm"), false, false],
  ["시작반 종합 · 현장", st("start", "all", "onsite"), false, false],
  ["시작반 격일 · 불라방", st("start", "alt_tt", "online"), false, false],
  ["시작반 종합 · 현장 · 저녁", st("start", "all", "onsite", "pm"), false, false],
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
  const s = st("intensive", "all", "online", "am");
  const a = mk("a", [], { created_at: "2026-10-09T01:00:00Z" });
  const b = mk("b", [], { created_at: "2026-10-09T02:00:00Z" });
  const p = mk("p", [], { created_at: "2026-10-01T00:00:00Z", pinned: true });
  assert.deepEqual(popupNotices([a, b, p], [s], new Set(), "2026-10-10").map((n) => n.id), ["p", "b", "a"]);
});

test("SQL 파일(17_notices.sql)의 첫 공지 대상이 위 테스트 대상과 같아요", async () => {
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(new URL("../supabase/17_notices.sql", import.meta.url), "utf8");
  const found = [...sql.matchAll(/'(\[\{"courses".*?\])'::jsonb/g)].map((m) => JSON.parse(m[1]));
  assert.deepEqual(found, [NOTICE1, NOTICE2]);
  assert.match(sql, /'실전속성반 오전 · 불라방 수강생 안내'/);
  assert.match(sql, /'📚 다음 수업부터 스터디 시작! \(온라인 참여\)'/);
});
