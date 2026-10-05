# vella_toeic 홈페이지 — 운영 정보와 작업 규칙

## 운영자
- Vella: 부산 서면 YBM 토익 강사. 조교 없이 혼자 운영. 평소 50~60명, 성수기(대학 방학) 200명 이상.
- 수강 등록은 학원에서, 교재비만 Vella에게 직접 입금. 사업자등록 없음 → 카드결제 없음, 계좌이체 + 관리자 수동 확인.
- 추가 비용 없이 운영(Vercel·Supabase 무료 요금제 유지).
- Vella는 비개발자. 설명은 쉬운 한국어로 짧게, 할 일은 번호로. 학생 화면 문구는 "~해요"체.

## 수업 운영
- 모든 과정 4주 16회(주 4회, 월~목). 매달 첫째 월요일 개강. 공휴일 주는 그때그때 조정(예: 화~금).
- 시작반 = 개념반(650 목표), 문풀반 = 실전반(750 목표), 속성반 = 한 달에 시작반+문풀반을 함께 듣는 반(주 4일만, 격일·단과 없음).
- LC 겹쳐듣기: LC는 시작반+문풀반 공통 수업 1개, RC는 반별로 따로.
- 평달 시간표: 오전 10:00 시작반 RC → 11:10 LC 공통 → 12:20 문풀반 RC / 저녁 18:00 문풀반 RC → 19:10 LC 공통 → 20:20 시작반 RC.
- 방학 달(1~2월, 7~8월)은 시간표가 다름(최대 3타임). 평달 기준으로 먼저 만들고 방학은 나중에.
- 격일반 = 2달 완성반: 시작반 월수 / 시작반 화목 / 문풀반 월수 / 문풀반 화목 4개 반, LC+RC 함께. 두 달 이어 들어야 과정 완성(예: 10월 월수 → 11월 화목). 요일이 아니라 회차 기준(공휴일로 밀린 주에는 화·목 수업을 월수반이 들음).
- 특강: 매달 첫째·셋째 토요일(PART 5 액기스 특강 10~12시, 적중 모의고사+풀이 10시~). 비수강생도 참여 가능.
- 동시등록: 연속 두 달을 함께 등록하면 할인.
- 영포탈출반·토익스피킹반은 현재 운영 안 함.

## 학생 구분
- 현장: 703호 수업. 연락처 안 받음. 교재는 첫 수업 날 703호에서 일괄 지급하고, 수강 시간에 맞춰 703호로 등원하라고 안내.
- 불라방: 유튜브 '벨라토익' 채널 일부 공개 라이브로 수강. 종강일까지 녹화 영상 시청 가능. 현장 학생도 불라방으로 전환 가능. 연락처 받음. 교재 수령은 1층 데스크 수령 또는 택배(택배비 4,000원).

## 수강 권한 규칙 (꼭 지킬 것)
- 시작반 학생은 문풀반 수업을, 문풀반 학생은 시작반 수업을 들을 수 없음.
- 강의 시청 조건: 로그인(이름 + 4자리 비밀번호) + 납부 확인 + 같은 기수 + 같은 반 + 신청한 과목(RC/LC). 하나라도 어긋나면 차단.
- 자유 가입이 아니라 등록한 반이 확인된 수강생만 쓰는 시스템이 핵심.

## 교재 (기준 파일: lib/config.ts)
- 교재 1권 10,000원. 반·과목별로 일괄 지급(학생이 교재를 빼는 기능 없음).
- 시작반: 주 4일(종합반) 개념집+RC+LC 3만 / RC 단과 개념집+RC 2만 / LC 단과 LC 1만 / 주 2일(격일반) 3권 3만. 시작반 격일반 이어듣기는 LC 교재만 구매.
- 문풀반: 주 4일(종합반) RC+LC 2만 / RC 단과 1만 / LC 단과 1만 / 주 2일(격일반) 2만. 이어듣기도 매달 교재가 바뀌어 전부 새로 구매.
- 속성반: 주 4일만, 4권 4만. 격일반·이어듣기 없음.

## 기수와 납부
- 기수는 월 단위(예: 2026-10). 관리 페이지 "현재 모집 기수"로 설정하고, 새 신청은 그 기수로 저장.
- 신청 → 계좌 안내 → 학생 이체 → Vella가 [납부 확인] → 학생 화면 상태 변경. 납부 확인 단계는 반드시 유지. 입금 확인은 일괄 처리.

- 강의: 유튜브 일부 공개 링크를 관리 페이지 [강의 관리]에 등록.
- 출석: /admin/qr 화면에 반별·LC 공통 QR을 인쇄해 강의실과 라이브 방송에 띄워요. 수업 시간 전후 20분까지 인정하고, 수업 시작 시각 이후는 지각(⏰)으로 표시해요. 관리자는 현황표에서 출석을 직접 보정할 수 있어요.
- 라이브: 관리 페이지에서 시작반·문풀반 오전·저녁 유튜브 링크를 저장하면 납부 완료 학생 강의실에 안내돼요. 속성반은 두 반 링크를 모두 봐요.
- 수업일: 관리 페이지 [수업일 설정]에서 월·반별 날짜와 공휴일을 정해요. 학생 스티커 달력에 반영돼요.
- 스티커판: 강의실에 월~금 수업 달력, 출석·지각·숙제 스티커, 배지와 이미지 저장을 제공해요. 숙제는 네이버 카페에 제출하고, 수업일 당일에 학생이 스티커를 받아요. 카페 링크는 신청 관리에서 설정해요.
- 기존 숙제 사진은 관리자 화면에서 확인·정리할 수 있지만, 새 사진 업로드 기능은 없어요.

## 남은 주의사항
- 시작반 격일반 이어듣기 할인은 신청자가 직접 선택해요. 이전 기수 수강 이력을 자동 대조하지 않으니 관리자가 신청 내용을 확인해 주세요.

## 디자인
- 대표색 연하늘(app/globals.css 색상 토큰). 글꼴은 제목·굵은 글씨 Jua, 본문 고운돋움. 둥근 카드, 구름 모양. 학원 느낌이 아닌 차분하고 친근한 분위기.
- 상단 로고: "토익의 시작" + "vella_toeic" + 구름. 학생 대부분이 휴대폰을 쓰니 모바일 화면 우선.

## 기술 구성
- Next.js(App Router) + Supabase(DB, Storage) + Vercel(main에 push하면 자동 배포). 주소: vellatoeic.vercel.app
- Vercel 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD, (선택) SESSION_SECRET. 키 값은 코드나 채팅에 절대 쓰지 말 것.
- DB는 서버에서 service_role로만 접근. RLS 켜고 정책 없음(학생 브라우저에서 직접 조회 불가).
- 표를 추가하거나 바꾸면 supabase/ 폴더에 SQL 파일로 남기고, Vella가 Supabase SQL Editor에서 직접 실행해야 함 → push 전에 실행할 SQL을 먼저 안내.

## 작업 규칙
- 코드 수정과 push는 VS Code에서만. Cowork의 Claude는 논의와 정리만 담당.
- 수정 전에 git status로 최신 상태 확인. 남이 바꾼 내용을 덮어쓰지 말 것.
- 작업이 끝나면 npm run build를 실행해 통과를 확인하고, 바로 commit해요. 실패하면 commit/push하지 말고 Vella에게 알려요.
- DB 변경이 없으면 commit 후 바로 push해요.
- DB 변경이 있으면 SQL 파일은 작업당 하나만 만들고, 재실행해도 안전하도록 가능한 DDL에 if not exists를 사용해요. 답변 맨 위에 크게 "⚠️ SQL 실행 필요"라고 표시하고, Vella가 "실행했어"라고 확인하기 전에는 push하지 않아요.
- SQL에 DROP, DELETE, TRUNCATE, UPDATE가 있으면 실행 전에 별도로 "🔴 위험: 검토 필요"라고 표시하고, 어떤 기존 데이터/구조에 영향을 주는지 쉬운 말로 설명해요.
- 새 작업을 시작하기 전에 supabase/APPLIED.md와 supabase/*.sql을 대조해 실행 완료 SQL이 기록에서 빠졌는지 확인해요. SQL 실행을 확인받으면 파일 이름과 실행 내용을 supabase/APPLIED.md에 기록해요.
- 운영 규칙이 바뀌면 이 파일도 같이 고칠 것.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
