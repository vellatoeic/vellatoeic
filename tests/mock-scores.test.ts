// 첫토익 모의고사 성적 연동 (설계서 v1): 형식 검사 · 학생 연결 · 개인번호
import { test } from "node:test";
import assert from "node:assert/strict";
import { carryManualLinks, isStudentNo, matchResult, numberForGroup, parsePayload, randomStudentNo, sameName, staleResultIds } from "@/lib/mockScores";

const result = (over: Record<string, unknown> = {}) => ({
  result_id: "f3a1c9d2-0000-4000-8000-000000000002",
  student_no: "100234",
  name: "홍길동",
  birth: "990123",
  lc: { correct: 80, score: 410 },
  rc: { correct: 86, score: 430 },
  total: 840,
  parts: [1, 2, 3, 4, 5, 6, 7].map((part) => ({ part, correct: 5, total: 10 })),
  wrong: [{ q: 22, part: 2, answer: "C", chosen: "B" }, { q: 147, part: 6, answer: "A", chosen: null }],
  comment: null,
  part_comments: [{ part: 1, comment: "좋아요" }],
  blank_sheet: false,
  report_pdf_url: null,
  ...over,
});
const body = (results: unknown[] = [result()], over: Record<string, unknown> = {}) => ({
  version: 1,
  dry_run: false,
  sent_at: "2026-12-04T15:30:00+09:00",
  exam: { id: "8b0d6c2e-0000-4000-8000-000000000001", title: "2026-12 1회차 Vella Toeic Vol.1", date: "2026-12-04", session: 1, answer_key: "vella_v1" },
  results,
  ...over,
});

test("설계서 예시 그대로는 통과, 파트·틀린 문항은 번호 순으로 정리", () => {
  const r = parsePayload(body());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.results.length, 1);
  assert.equal(r.data.results[0].wrong[1].chosen, null);
  assert.equal(r.data.exam.session, 1);
});

test("한 행이라도 틀리면 전체 거부 + 어느 칸인지 알려줘요", () => {
  const bad = parsePayload(body([result(), result({ result_id: "9c2e0000-0000-4000-8000-000000000003", lc: { correct: 80, score: 600 } })]));
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /results\[1\]\.lc/);
  assert.equal(parsePayload(body(undefined, { version: 2 })).ok, false);
  assert.equal(parsePayload(body([result({ student_no: "12345" })])).ok, false);
  assert.equal(parsePayload(body([result({ birth: "9901" })])).ok, false);
  assert.equal(parsePayload(body([result({ parts: [{ part: 1, correct: 7, total: 6 }] })])).ok, false);
  assert.equal(parsePayload(body([result({ wrong: [{ q: 201, part: 7, answer: "A", chosen: null }] })])).ok, false);
  assert.equal(parsePayload(body([result({ report_pdf_url: "http://x.example/a.pdf" })])).ok, false);
  assert.equal(parsePayload(body([result(), result()])).ok, false); // 같은 result_id 두 번
  assert.equal(parsePayload(body(undefined, { exam: { id: "x", title: "t", date: "2026-12-04" } })).ok, false);
  assert.equal(parsePayload(body(undefined, { exam: { id: "8b0d6c2e-0000-4000-8000-000000000001", title: "t", date: "2026-02-30" } })).ok, false);
  assert.equal(parsePayload(body(Array.from({ length: 301 }, () => result()))).ok, false);
});

test("학생번호·생년월일 없음(null)도 형식은 통과", () => {
  assert.equal(parsePayload(body([result({ student_no: null, birth: null })])).ok, true);
});

test("이름 비교는 공백을 지우고", () => {
  assert.equal(sameName(" 홍 길동 ", "홍길동"), true);
  assert.equal(sameName("홍길동", "홍길순"), false);
});

test("연결 규칙: 번호+이름 같음 → matched, 번호만 같음 → review, 번호 없음·못 찾음 → review(이름만으로 자동 연결 안 함)", () => {
  const names = new Map([["100234", ["홍길동"]]]);
  assert.deepEqual(matchResult({ student_no: "100234", name: "홍 길동" }, names), { status: "matched", linked_no: "100234", note: null });
  assert.deepEqual(matchResult({ student_no: "100234", name: "김철수" }, names), { status: "review", linked_no: null, note: "학생번호와 이름이 달라요" });
  assert.deepEqual(matchResult({ student_no: "999999", name: "홍길동" }, names), { status: "review", linked_no: null, note: "일치하는 학생 없음" });
  assert.deepEqual(matchResult({ student_no: null, name: "홍길동" }, names), { status: "review", linked_no: null, note: "학생번호 없음" });
});

test("관리자가 손으로 연결한 결과는 다시 와도 그대로", () => {
  const names = new Map([["100234", ["홍길동"]]]);
  const m = matchResult({ student_no: "100234", name: "김철수" }, names, { match_status: "manual", linked_no: "555555", match_note: "선생님 연결" });
  assert.deepEqual(m, { status: "manual", linked_no: "555555", note: "선생님 연결" });
  // matched·review였던 결과는 다시 판정해요
  assert.equal(matchResult({ student_no: "100234", name: "홍길동" }, names, { match_status: "review", linked_no: null, match_note: "x" }).status, "matched");
});

test("개인번호: 6자리, 첫 자리 0 아님, 같은 학생은 가장 먼저 받은 번호", () => {
  for (const r of [0, 0.5, 0.999999]) assert.equal(isStudentNo(randomStudentNo(() => r)), true);
  assert.equal(isStudentNo("012345"), false);
  assert.equal(numberForGroup([{ student_no: null, created_at: "2026-12-01" }]), null);
  assert.equal(numberForGroup([{ student_no: "222222", created_at: "2026-12-01" }, { student_no: "111111", created_at: "2026-11-01" }, { student_no: null, created_at: "2027-01-01" }]), "111111");
});

test("1.1 한 번의 전송 = 그 회차 전체 명단: 이번에 없는 result_id만 지우고, 빈 요청은 안 지움", () => {
  assert.deepEqual(staleResultIds(["a", "b", "c"], ["a", "C"]), ["b"]);
  assert.deepEqual(staleResultIds(["a", "b"], []), []);
  assert.deepEqual(staleResultIds([], ["a"]), []);
});

test("1.1 다시 스캔: 지워지는 선생님 연결은 같은 이름 새 결과로 이어받기 (한 명씩일 때만)", () => {
  const removed = [
    { result_id: "old1", name: "홍길동", match_status: "manual" as const, linked_no: "111111" },
    { result_id: "old2", name: "김민지", match_status: "manual" as const, linked_no: "222222" },
    { result_id: "old3", name: "김민지", match_status: "manual" as const, linked_no: "333333" },
    { result_id: "old4", name: "이서윤", match_status: "review" as const, linked_no: null },
  ];
  const incoming = [
    { result_id: "new1", name: "홍 길동", status: "review" as const },
    { result_id: "new2", name: "김민지", status: "review" as const },
    { result_id: "new4", name: "이서윤", status: "review" as const },
  ];
  const carry = carryManualLinks(removed, incoming);
  assert.equal(carry.get("new1"), "111111"); // 이어받음
  assert.equal(carry.has("new2"), false); // 동명이인(지워지는 쪽 두 명) → 선생님이 다시
  assert.equal(carry.has("new4"), false); // 원래 선생님 연결이 아니었음
  // 새 결과가 번호로 자동 연결(matched)됐으면 이어받을 필요 없음
  assert.equal(carryManualLinks(removed, [{ result_id: "n", name: "홍길동", status: "matched" }]).size, 0);
});
