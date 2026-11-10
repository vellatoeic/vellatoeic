-- 속도 개선(인덱스) + 10월 이전 데이터 한 번 정리
-- 학생 신청·출석·숙제·테스트·선물 기록은 지우지 않아요. 유튜브 영상도 그대로예요.
-- 여러 번 실행해도 안전해요 (두 번째부터는 지울 것이 없어서 0건).

-- ─────────────────────────────────────────────
-- ⓪ 먼저 확인: 지울 개수 (이 select 한 덩어리만 드래그해서 Run 하면 숫자만 보여요)
-- ─────────────────────────────────────────────
select
  (select count(*) from public.lectures where cohort < '2026-11') as "정규 강의 (10월 이전 기수)",
  (select count(*) from public.site_notices where repeat_monthly = false and ends_on < date '2026-11-01') as "끝난 일반 공지 (10/31까지 끝남)",
  (select count(*) from public.site_notice_reads where notice_id in (select id from public.site_notices where repeat_monthly = false and ends_on < date '2026-11-01')) as "그 공지 확인 기록",
  (select count(*) from public.special_lectures where event_date < date '2026-11-01') as "특강 (10월 이전)",
  (select count(*) from public.special_lecture_registrations where special_lecture_id in (select id from public.special_lectures where event_date < date '2026-11-01')) as "그 특강 신청 명단",
  (select count(*) from public.special_lecture_materials where special_lecture_id in (select id from public.special_lectures where event_date < date '2026-11-01')) as "그 특강 자료 (목록)",
  (select count(*) from public.deposit_events where registration_id in (select r.id from public.special_lecture_registrations r join public.special_lectures e on e.id = r.special_lecture_id where e.event_date < date '2026-11-01')) as "연결만 풀 입금 기록";

-- ─────────────────────────────────────────────
-- ① 자주 찾는 칸 인덱스 (이미 있으면 그대로 두고 넘어가요)
--    출석·숙제(app_id, day 기본 키)·테스트 기록(app_id, day, kind, test_no 고유 인덱스)은 이미 학생별 조회가 빨라서 새로 만들지 않아요.
-- ─────────────────────────────────────────────
create index if not exists applications_cohort_slot_idx on public.applications (cohort, slot);
create index if not exists applications_name_idx on public.applications (name);
create index if not exists lectures_cohort_created_idx on public.lectures (cohort, created_at);
create index if not exists special_registrations_application_idx on public.special_lecture_registrations (application_id);

-- ─────────────────────────────────────────────
-- ② 10월 이전 데이터 정리 🔴
-- ─────────────────────────────────────────────
begin;

-- 🔴 정규 강의: 10월 이전 기수 강의 목록 삭제 (유튜브 영상은 그대로)
delete from public.lectures where cohort < '2026-11';

-- 🔴 공지: 10/31까지 끝난 일반 공지와 그 확인 기록 삭제 (매달 반복 공지는 그대로)
delete from public.site_notice_reads
where notice_id in (select id from public.site_notices where repeat_monthly = false and ends_on < date '2026-11-01');
delete from public.site_notices where repeat_monthly = false and ends_on < date '2026-11-01';

-- 🔴 특강: 입금 기록은 남기고 특강 신청과의 연결만 풀어요
update public.deposit_events set registration_id = null
where registration_id in (
  select r.id from public.special_lecture_registrations r
  join public.special_lectures e on e.id = r.special_lecture_id
  where e.event_date < date '2026-11-01'
);

-- 🔴 특강: 10월 이전 특강의 자료 목록·신청 명단·특강 삭제
--    (자료 파일은 SQL로 못 지워요 → 실행 후 [특강 관리]의 '🧹 지운 특강의 자료 파일 보관함 정리' 버튼)
delete from public.special_lecture_materials
where special_lecture_id in (select id from public.special_lectures where event_date < date '2026-11-01');
delete from public.special_lecture_registrations
where special_lecture_id in (select id from public.special_lectures where event_date < date '2026-11-01');
delete from public.special_lectures where event_date < date '2026-11-01';

commit;

notify pgrst, 'reload schema';

-- ③ 확인: 남은 개수 (전부 0이면 정리 완료)
select
  (select count(*) from public.lectures where cohort < '2026-11') as "남은 10월 이전 강의",
  (select count(*) from public.site_notices where repeat_monthly = false and ends_on < date '2026-11-01') as "남은 끝난 일반 공지",
  (select count(*) from public.special_lectures where event_date < date '2026-11-01') as "남은 10월 이전 특강";
