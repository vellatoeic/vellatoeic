// 열람 권한 자동 테스트. 가짜 학생만 쓰고, 실제 DB에는 아무것도 남기지 않아요.
// 실행: npm test  (Supabase 접속 정보를 비워서 실제 DB에 닿지 않아요)
import { test } from "node:test";
import assert from "node:assert/strict";
import { audioBooksFor, canDownloadAudio, canOpenLecture, canWatch, covers, isActive, liveLinkFor, loginApps } from "@/lib/access";
import { liveState } from "@/lib/live";
import { hashPin, checkPin } from "@/lib/auth";
import { isPreview, type Application, type LcAudio, type Lecture } from "@/lib/db";

const C = "2026-10";
const OLD = "2026-09";
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function student(name: string, p: Partial<Application>): Application {
  return {
    id: id(), cohort: C, kind: "online", course: "start", track: "all", continuing: false, slot: "am",
    books: [], pickup: "classroom", name, phone: null, depositor: name, address: null, amount: 0,
    status: "paid", pin_hash: hashPin("1234"), created_at: "2026-10-01T00:00:00Z", ...p,
  };
}
function lecture(name: string, p: Partial<Lecture>): Lecture & { name: string } {
  return { id: id(), cohort: C, course: "start", part: "rc", slot: "am", title: name, youtube_id: "x", created_at: `2026-10-0${n % 9 + 1}T00:00:00Z`, ...p, name };
}

// ── 가짜 학생 ──
const S = {
  시작종합_오전: student("시작종합", { course: "start", track: "all", slot: "am", books: ["concept", "start_rc", "lc1"] }),
  시작RC단과_저녁: student("시작RC", { course: "start", track: "rc", slot: "pm", books: ["concept", "start_rc"] }),
  시작LC단과_오전: student("시작LC", { course: "start", track: "lc", slot: "am", books: ["lc1"] }),
  문풀종합_저녁_발송완료: student("문풀종합", { course: "solve", track: "all", slot: "pm", books: ["solve_rc1", "lc1"], status: "shipped" }),
  문풀RC단과_오전: student("문풀RC", { course: "solve", track: "rc", slot: "am", books: ["solve_rc1"] }),
  속성반_오전: student("속성", { course: "intensive", track: "all", slot: "am", books: ["concept", "start_rc", "solve_rc1", "lc1"] }),
  시작격일월수_저녁: student("시작격일", { course: "start", track: "alt_mw", slot: "pm", books: ["concept", "start_rc", "lc1"] }),
  입금대기: student("입금대기", { status: "pending", books: ["concept", "start_rc", "lc1"] }),
  환불: student("환불", { status: "refunded", books: ["concept", "start_rc", "lc1"] }),
  지난기수_시작종합: student("지난기수", { cohort: OLD, books: ["concept", "start_rc", "lc2"] }),
};

// ── 강의(라이브 링크·녹화 강의) ──
const L = {
  시작RC_오전: lecture("시작RC_오전", { course: "start", part: "rc", slot: "am" }),
  시작RC_저녁: lecture("시작RC_저녁", { course: "start", part: "rc", slot: "pm" }),
  시작LC_오전: lecture("시작LC_오전", { course: "start", part: "lc", slot: "am" }),
  문풀RC_저녁: lecture("문풀RC_저녁", { course: "solve", part: "rc", slot: "pm" }),
  문풀LC_오전: lecture("문풀LC_오전", { course: "solve", part: "lc", slot: "am" }),
  지난기수_시작RC: lecture("지난기수_시작RC", { cohort: OLD, course: "start", part: "rc", slot: "am" }),
};
const lectures = Object.values(L);

// 학생별로 "볼 수 있어야 하는 강의"를 직접 적어 둬요. 나머지는 모두 못 봐야 해요.
// 오전/저녁은 교차 수강이 가능해서 시간대로는 막지 않아요.
const canSee: Record<keyof typeof S, (keyof typeof L)[]> = {
  시작종합_오전: ["시작RC_오전", "시작RC_저녁", "시작LC_오전"],
  시작RC단과_저녁: ["시작RC_오전", "시작RC_저녁"],
  시작LC단과_오전: ["시작LC_오전"],
  문풀종합_저녁_발송완료: ["문풀RC_저녁", "문풀LC_오전"],
  문풀RC단과_오전: ["문풀RC_저녁"],
  속성반_오전: ["시작RC_오전", "시작RC_저녁", "시작LC_오전", "문풀RC_저녁", "문풀LC_오전"],
  시작격일월수_저녁: ["시작RC_오전", "시작RC_저녁", "시작LC_오전"],
  입금대기: [],
  환불: [],
  지난기수_시작종합: ["지난기수_시작RC"],
};

test("테스트는 실제 DB가 아닌 임시 저장소에서 실행돼요", () => {
  assert.equal(isPreview, true);
});

for (const [sName, s] of Object.entries(S) as [keyof typeof S, Application][]) {
  test(`녹화 강의·강의 주소 직접 입력: ${sName}`, () => {
    for (const [lName, l] of Object.entries(L) as [keyof typeof L, Lecture][]) {
      const expected = canSee[sName].includes(lName);
      assert.equal(covers(s, l), expected, `${sName} → ${lName} 목록`);
      assert.equal(canOpenLecture([s], l), expected, `${sName} → /class/${lName} 직접 입력`);
    }
  });

  test(`라이브 링크: ${sName}`, () => {
    for (const slot of ["am", "pm"] as const) {
      const link = liveLinkFor(s, lectures, slot);
      const allowed = canSee[sName].map((k) => L[k]).filter((l) => !l.slot || l.slot === slot);
      if (allowed.length === 0) assert.equal(link, null, `${sName} ${slot} 라이브 없음`);
      else {
        assert.ok(link, `${sName} ${slot} 라이브 있음`);
        assert.ok(allowed.some((l) => l.id === link.id), `${sName} ${slot} 라이브는 볼 수 있는 강의 중 하나`);
        assert.equal(link.slot, slot, `${sName} ${slot} 탭에는 그 시간대 링크`);
      }
    }
  });
}

// ── LC 음원 ──
const audio = (cohort: string, book: LcAudio["book"]): LcAudio => ({ id: id(), cohort, book, title: `${cohort} ${book}`, storage_path: "x", size_bytes: 1, sort_order: 1, created_at: "" });
const A = { 이번기수_LC1: audio(C, "lc1"), 이번기수_LC2: audio(C, "lc2"), 지난기수_LC2: audio(OLD, "lc2") };
const audioSee: Record<keyof typeof S, (keyof typeof A)[]> = {
  시작종합_오전: ["이번기수_LC1"],
  시작RC단과_저녁: [],
  시작LC단과_오전: ["이번기수_LC1"],
  문풀종합_저녁_발송완료: ["이번기수_LC1"],
  문풀RC단과_오전: [],
  속성반_오전: ["이번기수_LC1"],
  시작격일월수_저녁: ["이번기수_LC1"],
  입금대기: [],
  환불: [],
  지난기수_시작종합: ["지난기수_LC2"],
};
const inside = () => ({ start: "2026-10-05", end: "2026-10-18" });

for (const [sName, s] of Object.entries(S) as [keyof typeof S, Application][]) {
  test(`LC 음원(기간 안)·음원 주소 직접 입력: ${sName}`, () => {
    for (const [aName, a] of Object.entries(A) as [keyof typeof A, LcAudio][]) {
      assert.equal(canDownloadAudio([s], a, inside, "2026-10-10"), audioSee[sName].includes(aName), `${sName} → ${aName}`);
    }
  });
}

test("LC 음원: 다운로드 기간(첫 수업일~14일) 밖이면 아무도 못 받아요", () => {
  for (const s of Object.values(S)) {
    for (const a of Object.values(A)) {
      assert.equal(canDownloadAudio([s], a, inside, "2026-10-04"), false);
      assert.equal(canDownloadAudio([s], a, inside, "2026-10-19"), false);
      assert.equal(canDownloadAudio([s], a, () => null, "2026-10-10"), false);
    }
  }
});

test("RC 단과는 LC 교재가 없어 음원 목록 자체가 비어요", () => {
  assert.deepEqual(audioBooksFor(S.시작RC단과_저녁), []);
  assert.deepEqual(audioBooksFor(S.문풀RC단과_오전), []);
});

// ── 입금 대기·환불·삭제·로그아웃 ──
test("입금 대기·환불 학생은 아무것도 못 봐요", () => {
  for (const s of [S.입금대기, S.환불]) {
    assert.equal(canWatch(s), false);
    assert.equal(lectures.some((l) => covers(s, l)), false);
    assert.equal(liveLinkFor(s, lectures, "am"), null);
    assert.deepEqual(audioBooksFor(s), []);
  }
});

test("로그인 안 함·삭제된 학생(신청 없음)은 강의·음원 주소를 직접 입력해도 막혀요", () => {
  for (const l of lectures) assert.equal(canOpenLecture([], l), false);
  assert.equal(canOpenLecture([S.시작종합_오전], null), false);
  for (const a of Object.values(A)) assert.equal(canDownloadAudio([], a, inside, "2026-10-10"), false);
});

test("로그인: 환불 학생은 비밀번호가 맞아도 '수강 정보가 없어요'", () => {
  const r = loginApps([S.환불], (a) => checkPin("1234", a.pin_hash));
  assert.equal(r.apps, undefined);
  assert.equal(r.error, "수강 정보가 없어요. Vella쌤에게 문의해 주세요.");
  assert.equal(isActive(S.환불), false);
});

test("로그인: 삭제된 학생(같은 이름 신청 없음)은 '수강 정보가 없어요'", () => {
  assert.equal(loginApps([], () => true).error, "수강 정보가 없어요. Vella쌤에게 문의해 주세요.");
});

test("로그인: 비밀번호가 틀리면 '이름 또는 비밀번호가 맞지 않아요'", () => {
  assert.equal(loginApps([S.시작종합_오전], (a) => checkPin("9999", a.pin_hash)).error, "이름 또는 비밀번호가 맞지 않아요.");
});

test("로그인: 정상 학생·입금 대기 학생은 들어갈 수 있어요(입금 대기는 안내만 보여요)", () => {
  assert.equal(loginApps([S.시작종합_오전], (a) => checkPin("1234", a.pin_hash)).apps?.length, 1);
  assert.equal(loginApps([S.입금대기], (a) => checkPin("1234", a.pin_hash)).apps?.length, 1);
});

test("로그인: 같은 이름의 환불 신청과 새 신청이 있으면 새 신청만 열려요", () => {
  const renewed = student("환불", { status: "paid" });
  const r = loginApps([S.환불, renewed], (a) => checkPin("1234", a.pin_hash));
  assert.deepEqual(r.apps?.map((a) => a.id), [renewed.id]);
});

// ── 라이브 입장 시간 (수업 10분 전 ~ 종료) ──
test("라이브 입장 버튼: 수업 10분 전부터 종료까지만 열려요", () => {
  const days = ["2026-10-07"];
  const at = (hm: string) => Date.parse(`2026-10-07T${hm}:00+09:00`);
  const am = { course: "start", track: "all", slot: "am" } as const;
  assert.equal(liveState(am, days, at("09:49")).open, false);
  assert.equal(liveState(am, days, at("09:50")).open, true);
  assert.equal(liveState(am, days, at("12:10")).open, true);
  assert.equal(liveState(am, days, at("12:11")).open, false);
  assert.equal(liveState({ ...am, slot: "pm" }, days, at("19:00")).open, true);
  assert.equal(liveState(am, ["2026-10-08"], at("10:00")).open, false);
});
