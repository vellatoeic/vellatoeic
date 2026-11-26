// 구글·카카오 로그인 규칙 테스트 (DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveMode, googleClaims, inAppBrowser, isAdminLogin, isAdminOAuth, isSignupNext, loginModeOf, parseAdminLogins, planLink, providerReady, readyProviders, safeNext, showPinLogin, showSocialLogin, withAdminLogin } from "@/lib/socialLogin";
import { findPrevAlt, planBooks, NOT_FOUND_NOTICE, NOT_FOUND_NOTICE_SOCIAL } from "@/lib/altContinue";
import { loginApps } from "@/lib/access";
import type { Application } from "@/lib/db";

const app = (over: Partial<Application>): Application => ({
  id: "a", cohort: "2026-12", kind: "online", course: "start", track: "all", continuing: false, slot: "am", pickup: "classroom",
  pickup_date: null, pickup_time: null, books: ["concept", "start_rc", "lc1"], name: "연결학생", phone: "01000000000", depositor: "연결학생",
  address: null, amount: 30000, pin_hash: "h", status: "paid", created_at: "2026-11-20T00:00:00Z", account_id: null, ...over,
} as Application);

const idToken = (claims: Record<string, unknown>) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

test("로그인 방식: 저장값이 없거나 이상하면 이름+비밀번호만, 켜진 로그인이 없으면 구글·카카오만이어도 비밀번호로", () => {
  assert.equal(loginModeOf(""), "pin");
  assert.equal(loginModeOf("이상한값"), "pin");
  assert.equal(loginModeOf("both"), "both");
  assert.equal(effectiveMode("social", []), "pin");
  assert.equal(effectiveMode("social", ["google"]), "social");
  assert.equal(showPinLogin("social"), false);
  assert.equal(showPinLogin("both"), true);
  assert.equal(showSocialLogin("pin"), false);
});

test("키가 들어 있는 로그인만 켜져요 (카카오는 REST API 키만 있으면)", () => {
  assert.equal(providerReady("google", { GOOGLE_CLIENT_ID: "id" }), false);
  assert.deepEqual(readyProviders({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }), ["google"]);
  assert.deepEqual(readyProviders({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s", KAKAO_REST_API_KEY: "k" }), ["google", "kakao"]);
});

test("로그인 뒤 돌아갈 주소: 사이트 안의 정해진 화면만, 나머지는 강의실", () => {
  assert.equal(safeNext("/check?d=1"), "/check?d=1");
  assert.equal(safeNext("/guide/online"), "/guide/online");
  assert.equal(safeNext("https://evil.example"), "/class");
  assert.equal(safeNext("//evil.example"), "/class");
  assert.equal(safeNext("/admin"), "/class");
  assert.equal(safeNext(null), "/class");
  assert.equal(isSignupNext("/guide/onsite"), true);
  assert.equal(isSignupNext("/class"), false);
});

test("앱 안 브라우저: 카톡은 따로, 인스타·네이버·안드로이드 웹뷰는 기타, 일반 브라우저는 없음", () => {
  assert.equal(inAppBrowser("Mozilla/5.0 (iPhone) AppleWebKit KAKAOTALK 10.4.5"), "kakaotalk");
  assert.equal(inAppBrowser("Mozilla/5.0 (iPhone) Instagram 300.0"), "other");
  assert.equal(inAppBrowser("Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) NAVER(inapp; search; 2000)"), "other");
  assert.equal(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Mobile Safari/604.1"), null);
  assert.equal(inAppBrowser("Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36"), null);
});

test("구글 id_token: 받는 사람·발급처·만료를 확인하고, 확인 안 된 이메일은 버려요", () => {
  const ok = { aud: "cid", iss: "https://accounts.google.com", sub: "123", exp: 2000, email: "a@gmail.com", email_verified: true, name: "벨라" };
  assert.deepEqual(googleClaims(idToken(ok), "cid", 1000), { sub: "123", email: "a@gmail.com", name: "벨라" });
  assert.equal(googleClaims(idToken({ ...ok, aud: "other" }), "cid", 1000), null);
  assert.equal(googleClaims(idToken({ ...ok, iss: "https://evil" }), "cid", 1000), null);
  assert.equal(googleClaims(idToken(ok), "cid", 3000), null); // 만료
  assert.equal(googleClaims(idToken({ ...ok, email_verified: false }), "cid", 1000)?.email, null);
  assert.equal(googleClaims("깨진토큰", "cid", 1000), null);
});

test("처음 연결: 아무도 연결 안 했으면 새 번호, 다른 로그인으로 연결된 신청이 있으면 그 번호를 같이 써요", () => {
  const fresh = planLink([app({ id: "n", created_at: "2026-11-01T00:00:00Z" }), app({ id: "d" })], null, () => "NEW");
  assert.deepEqual(fresh, { accountId: "NEW", merge: [], attach: ["n", "d"] });
  // 카카오로 먼저 연결한 학생이 구글도 연결: 같은 학생 번호
  const second = planLink([app({ id: "n", account_id: "K" }), app({ id: "d" })], null, () => "NEW");
  assert.deepEqual(second, { accountId: "K", merge: [], attach: ["d"] });
});

test("번호가 둘로 나뉜 신청은 가장 먼저 신청한 쪽으로 합치고, 이미 연결된 계정(신청 없음)에 붙일 때는 그 번호를 지켜요", () => {
  const split = planLink([app({ id: "dec", created_at: "2026-11-25T00:00:00Z", account_id: "B" }), app({ id: "nov", created_at: "2026-10-20T00:00:00Z", account_id: "A" })], null, () => "NEW");
  assert.deepEqual(split, { accountId: "A", merge: ["B"], attach: [] });
  const keep = planLink([app({ id: "nov", account_id: "A" })], "G", () => "NEW");
  assert.deepEqual(keep, { accountId: "G", merge: ["A"], attach: [] });
});

test("구글·카카오 로그인: 같은 학생 번호의 신청 중 환불·취소는 빼요 (로그인 규칙은 이름+비밀번호와 같아요)", () => {
  const r = loginApps([app({ id: "p", status: "paid" }), app({ id: "r", status: "refunded" })], () => true);
  assert.deepEqual(r.apps?.map((a) => a.id), ["p"]);
  const c = loginApps([app({ id: "c", status: "cancelled" })], () => true);
  assert.equal(c.cancelledId, "c");
  assert.equal(loginApps([], () => true).error, "수강 정보가 없어요. Vella쌤에게 문의해 주세요.");
});

test("격일반 두 달째: 구글·카카오만 방식은 같은 학생 번호의 지난달 신청으로 찾고, 못 찾으면 연결 안내", () => {
  const prev = app({ id: "nov", cohort: "2026-11", course: "start", track: "alt_mw", account_id: "A" });
  assert.equal(findPrevAlt([prev], () => true, "2026-12", "start")?.id, "nov");
  const books = planBooks({ course: "start", track: "alt_tt", pickup: "classroom", round: 2, prev: null, wantContinuing: true, social: true });
  assert.equal(books.notice, NOT_FOUND_NOTICE_SOCIAL);
  const pinBooks = planBooks({ course: "start", track: "alt_tt", pickup: "classroom", round: 2, prev: null, wantContinuing: true });
  assert.equal(pinBooks.notice, NOT_FOUND_NOTICE);
});

test("관리자 카카오·구글 계정: 계정 고유번호로 등록하고, 이상한 값은 버리고, 같은 계정은 한 번만", () => {
  assert.deepEqual(parseAdminLogins(""), []);
  assert.deepEqual(parseAdminLogins("깨진 값"), []);
  assert.deepEqual(parseAdminLogins(JSON.stringify([{ p: "naver", sub: "1" }, { p: "kakao", sub: "" }, { p: "google", sub: "g1", label: "a", at: "t" }])).map((x) => x.sub), ["g1"]);
  const one = withAdminLogin([], { p: "kakao", sub: "k1", label: "벨라", at: "t1" });
  const again = withAdminLogin(one, { p: "kakao", sub: "k1", label: "벨라쌤", at: "t2" });
  assert.equal(again.length, 1);
  assert.equal(again[0].label, "벨라쌤");
  const both = withAdminLogin(again, { p: "google", sub: "g1", label: null, at: "t3" });
  assert.equal(isAdminLogin(both, "google", "g1"), true);
  assert.equal(isAdminLogin(both, "google", "k1"), false); // 카카오 번호를 구글로 쓰면 안 돼요
  assert.equal(isAdminOAuth("login"), true);
  assert.equal(isAdminOAuth("add"), true);
  assert.equal(isAdminOAuth("admin"), false);
});
