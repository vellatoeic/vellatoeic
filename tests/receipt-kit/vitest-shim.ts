// 수강증 키트 시험(vitest 문법)을 node:test로 돌리는 작은 변환기. 키트 시험이 쓰는 확인 함수만 있어요.
import { describe as nodeDescribe, it as nodeIt } from "node:test";
import assert from "node:assert/strict";

export const describe = nodeDescribe;
export const it = nodeIt;

// 기대값에 적힌 칸만 비교해요 (vitest toMatchObject와 같은 뜻)
function matchObject(actual: unknown, expected: unknown, at: string) {
  if (expected === null || typeof expected !== "object") return assert.deepStrictEqual(actual, expected, `${at} 값이 달라요`);
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${at} 배열이 아니에요`);
    assert.equal((actual as unknown[]).length, expected.length, `${at} 길이가 달라요`);
    expected.forEach((e, i) => matchObject((actual as unknown[])[i], e, `${at}[${i}]`));
    return;
  }
  assert.ok(actual !== null && typeof actual === "object", `${at} 객체가 아니에요`);
  for (const [k, v] of Object.entries(expected)) matchObject((actual as Record<string, unknown>)[k], v, `${at}.${k}`);
}

export function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => assert.ok(Object.is(actual, expected), `기대 ${String(expected)} · 실제 ${String(actual)}`),
    toEqual: (expected: unknown) => assert.deepStrictEqual(actual, expected),
    toBeNull: () => assert.equal(actual, null),
    toBeUndefined: () => assert.equal(actual, undefined),
    toBeFalsy: () => assert.ok(!actual, `거짓이어야 해요: ${String(actual)}`),
    toMatchObject: (expected: unknown) => matchObject(actual, expected, "값"),
  };
}
