// 12월 특강 개편 테스트 (2026-11-28 Vella, 실제 DB 미사용): 보증금 없음 · 현장 정원 90명 · 비수강생(잠재 고객) 신청 · 성적 연결 · 학생 명단
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEPOSIT_FREE_FROM, SPECIAL_CAPACITY, canSeeSpecialMaterials, needsDeposit, onsiteTaken, specialConfirmed } from "@/lib/special";
import { isSpecialNext, safeNext } from "@/lib/socialLogin";
import { zonePath } from "@/lib/zones";
import { createProspect, getProspectByAccount, isPreview, reserveStudentNo } from "@/lib/db";
import { namesByStudentNo } from "@/lib/studentNumbers";
import { buildRoster } from "@/lib/rosterServer";
import { GRADE_LABEL } from "@/lib/grades";

test("임시 저장소에서만 실행돼요", () => assert.equal(isPreview, true));

test("보증금: 11월 특강까지만, 12월 특강부터 없음", () => {
  assert.equal(DEPOSIT_FREE_FROM, "2026-12-01");
  assert.equal(needsDeposit("2026-11-27"), true);
  assert.equal(needsDeposit("2026-12-05"), false);
});

test("신청 확정: 12월 현장 신청은 보증금 없이 바로 확정, 11월은 예전 규칙 그대로", () => {
  assert.equal(specialConfirmed({ mode: "onsite", deposit: null }, "2026-12-05"), true);
  assert.equal(specialConfirmed({ mode: "onsite", deposit: "cancelled" }, "2026-12-05"), false);
  assert.equal(specialConfirmed({ mode: "onsite", deposit: "pending" }, "2026-11-27"), false);
  assert.equal(specialConfirmed({ mode: "onsite", deposit: "paid" }, "2026-11-27"), true);
  assert.equal(specialConfirmed({ mode: "online", deposit: null }, "2026-11-27"), true);
});

test("자료·다시 보기: 12월 현장(보증금 없음)은 특강 당일부터, 열람 마감 뒤엔 닫힘", () => {
  const reg = { mode: "onsite" as const, deposit: null };
  assert.equal(canSeeSpecialMaterials(reg, "2026-12-05", "2026-12-04", "2027-01-03"), false);
  assert.equal(canSeeSpecialMaterials(reg, "2026-12-05", "2026-12-05", "2027-01-03"), true);
  assert.equal(canSeeSpecialMaterials(reg, "2026-12-05", "2027-01-04", "2027-01-03"), false);
  // 11월 현장: 보증금 확인된 신청만
  assert.equal(canSeeSpecialMaterials({ mode: "onsite", deposit: "pending" }, "2026-11-27", "2026-11-27", "2026-11-30"), false);
  assert.equal(canSeeSpecialMaterials({ mode: "onsite", deposit: "paid" }, "2026-11-27", "2026-11-27", "2026-11-30"), true);
});

test("현장 정원 90명: 취소는 자리에서 빼고, 불라방은 세지 않아요", () => {
  assert.equal(SPECIAL_CAPACITY, 90);
  const regs = [
    ...Array.from({ length: 89 }, () => ({ mode: "onsite" as const, deposit: null })),
    { mode: "onsite" as const, deposit: "cancelled" },
    { mode: "online" as const, deposit: null },
  ];
  assert.equal(onsiteTaken(regs), 89);
  assert.equal(onsiteTaken([...regs, { mode: "onsite", deposit: null }]) >= SPECIAL_CAPACITY, true);
});

test("특강 페이지에서 카카오·구글 로그인하면 특강 페이지로 돌아와요 (비수강생 신청서)", () => {
  assert.equal(isSpecialNext("/special"), true);
  assert.equal(isSpecialNext("/special?guest=1"), true);
  assert.equal(isSpecialNext("/special?guest=1&x=2"), false);
  assert.equal(safeNext("/special?guest=1"), "/special?guest=1");
  assert.equal(safeNext("/special?evil=1"), "/go");
  // 비수강생 구역: 다가오는 특강 신청이 있으면 특강 페이지, 아니면 내 모의고사 성적
  assert.equal(zonePath("guest", true), "/special");
  assert.equal(zonePath("guest", false), "/class/scores");
  assert.equal(GRADE_LABEL.prospect, "잠재 고객");
});

test("비수강생: 개인번호로 모의고사 결과가 이름과 맞으면 연결돼요, 학생 명단에는 '잠재 고객'", async () => {
  const account = crypto.randomUUID();
  const no = await reserveStudentNo();
  await createProspect({ account_id: account, student_no: no, name: "한소망", phone: "01055556666", news_opt_in: true });
  const found = await getProspectByAccount(account);
  assert.equal(found?.student_no, no);
  assert.equal(found?.news_opt_in, true);
  assert.ok(found?.news_opt_in_at, "동의 시각을 남겨요");
  const names = await namesByStudentNo([no]);
  assert.deepEqual(names.get(no), ["한소망"]);
  const { rows } = await buildRoster();
  const row = rows.find((r) => r.no === no);
  assert.ok(row, "명단에 있어요");
  assert.deepEqual(row!.grades, ["prospect"]);
  assert.equal(row!.guest?.optIn, true);
  assert.equal(row!.appId, "", "수강 신청이 없어서 학생 통합 화면 링크는 없어요");
});
