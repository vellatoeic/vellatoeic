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

test("학원 전달용 지역: 시·도 + 시·군·구까지만", async () => {
  const { regionOf, regionLines } = await import("@/lib/address");
  assert.equal(regionOf("[49300] 부산 사하구 낙동대로 1 (하단동), 301호"), "부산 사하구");
  assert.equal(regionOf("부산광역시 해운대구 센텀중앙로 97"), "부산 해운대구");
  assert.equal(regionOf("[51500] 경남 창원시 성산구 중앙대로 1, 2층"), "경남 창원시 성산구");
  assert.equal(regionOf("경상남도 김해시 김해대로 1"), "경남 김해시");
  assert.equal(regionOf("경기 성남시 분당구 판교역로 1"), "경기 성남시 분당구");
  assert.equal(regionOf("세종특별자치시 한누리대로 1"), "세종");
  assert.equal(regionOf(null), "");
  assert.equal(regionLines([{ name: "김태우", address: "부산 사하구 낙동대로 1" }, { name: "김지민", address: "경남 창원시 의창구 1" }]), "1. 김태우: 부산 사하구\n2. 김지민: 경남 창원시 의창구");
});
