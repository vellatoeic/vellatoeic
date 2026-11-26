// 자주 묻는 질문 검색
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchFaq } from "@/lib/faqSearch";

const items = [
  { id: "1", category: "교재", question: "교재는 어디서 받나요?", answer: "현장은 첫 수업 날 801호에서 받아요." },
  { id: "2", category: "납부", question: "교재비 입금은 언제까지 하나요?", answer: "신청 후 30분 안에 입금해 주세요." },
  { id: "3", category: "강의실", question: "라이브는 어떻게 들어가요?", answer: "강의실 맨 위 라이브 입장 버튼을 눌러요. 교재는 미리 준비해요." },
  { id: "4", category: "📦 택배", question: "택배는 며칠 걸려요?", answer: "평일 기준 2~3일이에요." },
];

test("빈 검색은 결과 없음(원래 목록을 보여줘요)", () => {
  assert.deepEqual(searchFaq(items, "   "), []);
});

test("질문에서 찾은 것이 답에서만 찾은 것보다 먼저", () => {
  assert.deepEqual(searchFaq(items, "교재").map((f) => f.id), ["1", "2", "3"]);
});

test("띄어쓰기 무시: '교재비입금'도 '교재비 입금'을 찾아요, 여러 낱말은 모두 포함", () => {
  assert.deepEqual(searchFaq(items, "교재비입금").map((f) => f.id), ["2"]);
  assert.deepEqual(searchFaq(items, "입금 30분").map((f) => f.id), ["2"]);
  assert.deepEqual(searchFaq(items, "입금 택배").map((f) => f.id), []);
});

test("카테고리 이름·이모티콘이 있어도 찾아요", () => {
  assert.deepEqual(searchFaq(items, "택배").map((f) => f.id), ["4"]);
  assert.deepEqual(searchFaq(items, "LIVE").length, 0);
});
