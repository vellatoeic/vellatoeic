// 택배 주소 나누기 (우편번호 · 기본주소 · 상세주소)
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitAddress } from "@/lib/address";

test("새 신청: 상세주소 칸이 있으면 그대로 나눠요", () => {
  const a = splitAddress("[47285] 부산 부산진구 중앙대로 672 (삼정타워), 101동 1001호", "101동 1001호");
  assert.deepEqual([a.zip, a.base, a.detail], ["47285", "부산 부산진구 중앙대로 672 (삼정타워)", "101동 1001호"]);
});

test("새 신청 · 직접 입력 주소도 상세주소 칸으로 나눠요", () => {
  const a = splitAddress("부산 해운대구 해운대로 123 2층, 201호", "2층, 201호");
  assert.deepEqual([a.zip, a.base, a.detail], ["", "부산 해운대구 해운대로 123", "2층, 201호"]);
});

test("예전 신청(상세주소 칸 없음): 주소 검색 형식에서 나눠요, 건물 이름 괄호 안 쉼표는 건너뛰어요", () => {
  const a = splitAddress("[48058] 부산 해운대구 센텀중앙로 97 (센텀스카이비즈, A동), 1203호, 문 앞", null);
  assert.deepEqual([a.zip, a.base, a.detail], ["48058", "부산 해운대구 센텀중앙로 97 (센텀스카이비즈, A동)", "1203호, 문 앞"]);
  const b = splitAddress("[47285] 부산 부산진구 중앙대로 672, 단독주택");
  assert.deepEqual([b.zip, b.base, b.detail], ["47285", "부산 부산진구 중앙대로 672", "단독주택"]);
});

test("예전 직접 입력 주소는 나눌 수 없어서 기본주소에 전부", () => {
  const a = splitAddress("부산 사하구 낙동대로 1 301호");
  assert.deepEqual([a.zip, a.base, a.detail], ["", "부산 사하구 낙동대로 1 301호", ""]);
  assert.deepEqual(splitAddress(null), { zip: "", base: "", detail: "", full: "" });
});
