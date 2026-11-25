// 구글 로그인: 환경변수 찾기 · 로그인 주소(위조 방지·PKCE) · 돌아갈 주소 막기 · 회원/연결 (가짜 DB, 실제 구글·DB 안 씀)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CALLBACK_PATH, googleKeys, googleSetup, safeNext, startGoogleLogin } from "@/lib/google";
import { linkMemberApps, memberAppIds, upsertMember } from "@/lib/db";

test("환경변수: 흔한 이름을 차례로 찾고, 값은 점검 결과에 넣지 않아요", () => {
  assert.deepEqual(googleSetup({}), { on: false, idName: null, secretName: null });
  const a = googleSetup({ GOOGLE_CLIENT_ID: " id-1 ", GOOGLE_CLIENT_SECRET: "sec-1" });
  assert.deepEqual(a, { on: true, idName: "GOOGLE_CLIENT_ID", secretName: "GOOGLE_CLIENT_SECRET" });
  assert.equal(JSON.stringify(a).includes("sec-1"), false);
  assert.deepEqual(googleSetup({ AUTH_GOOGLE_ID: "x", AUTH_GOOGLE_SECRET: "y" }), { on: true, idName: "AUTH_GOOGLE_ID", secretName: "AUTH_GOOGLE_SECRET" });
  assert.equal(googleSetup({ GOOGLE_CLIENT_ID: "x" }).on, false); // 비밀값이 없으면 꺼짐
  assert.deepEqual(googleKeys({ GOOGLE_CLIENT_ID: " id-1 ", GOOGLE_CLIENT_SECRET: " sec-1 " }), { clientId: "id-1", clientSecret: "sec-1" }); // 앞뒤 공백 제거
});

test("로그인 주소: 리디렉션 주소 · 위조 방지 값 · PKCE(S256)가 들어가요", () => {
  const { url, cookie } = startGoogleLogin("client-123", "https://vellatoeic.vercel.app", "/class");
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("client_id"), "client-123");
  assert.equal(u.searchParams.get("redirect_uri"), `https://vellatoeic.vercel.app${CALLBACK_PATH}`);
  assert.equal(u.searchParams.get("scope"), "openid email profile");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  const saved = JSON.parse(cookie);
  assert.equal(u.searchParams.get("state"), saved.state);
  assert.equal(saved.next, "/class");
  assert.equal(u.searchParams.get("code_challenge"), createHash("sha256").update(saved.verifier).digest("base64url"));
  // 매번 다른 값
  assert.notEqual(JSON.parse(startGoogleLogin("c", "https://a.b", "/").cookie).state, saved.state);
});

test("돌아갈 주소: 사이트 안 정해진 화면만, 다른 사이트 주소는 첫 화면으로", () => {
  assert.equal(safeNext("/class"), "/class");
  assert.equal(safeNext("/check?d=2026-12-01"), "/check?d=2026-12-01");
  assert.equal(safeNext("https://evil.example"), "/");
  assert.equal(safeNext("//evil.example"), "/");
  assert.equal(safeNext("/check?x=//evil.example"), "/");
  assert.equal(safeNext("/admin"), "/");
  assert.equal(safeNext(null), "/");
});

test("회원: 같은 구글 계정은 같은 회원, 연결은 중복 없이", async () => {
  const m1 = await upsertMember({ provider: "google", provider_id: "sub-1", email: "a@example.com", name: "가나" });
  const m2 = await upsertMember({ provider: "google", provider_id: "sub-1", email: "a@example.com", name: "가나다" });
  assert.equal(m1.id, m2.id);
  assert.equal(m2.name, "가나다");
  const other = await upsertMember({ provider: "google", provider_id: "sub-2", email: null, name: null });
  assert.notEqual(other.id, m1.id);
  const app1 = "11111111-1111-4111-8111-111111111111";
  const app2 = "22222222-2222-4222-8222-222222222222";
  await linkMemberApps(m1.id, [app1, app1, "not-a-uuid"]);
  await linkMemberApps(m1.id, [app1, app2]);
  assert.deepEqual((await memberAppIds(m1.id)).sort(), [app1, app2]);
  assert.deepEqual(await memberAppIds(other.id), []);
});
