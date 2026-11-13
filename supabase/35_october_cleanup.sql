-- 새 DB(서울) 10월 이전 정리: 정규 강의 목록 + 특강(신청 명단·자료 목록 포함)만 지워요.
-- 공지·학생 신청·출석·숙제·테스트·선물 기록은 지우지 않아요. 유튜브 영상도 그대로예요.
-- 입금 기록은 남기고 특강 신청과의 연결만 풀어요.
-- 여러 번 실행해도 안전해요 (두 번째부터는 지울 것이 없어서 0건).

-- ⓪ 먼저 확인: 지울 개수
select
  (select count(*) from public.lectures where cohort < '2026-11') as "정규 강의 (10월 이전 기수)",
  (select count(*) from public.special_lectures where event_date < date '2026-11-01') as "특강 (10월 이전)",
  (select count(*) from public.special_lecture_registrations where special_lecture_id in (select id from public.special_lectures where event_date < date '2026-11-01')) as "그 특강 신청 명단",
  (select count(*) from public.special_lecture_materials where special_lecture_id in (select id from public.special_lectures where event_date < date '2026-11-01')) as "그 특강 자료 (목록)",
  (select count(*) from public.deposit_events where registration_id in (select r.id from public.special_lecture_registrations r join public.special_lectures e on e.id = r.special_lecture_id where e.event_date < date '2026-11-01')) as "연결만 풀 입금 기록";

begin;

-- 🔴 정규 강의: 10월 이전 기수 강의 목록 삭제
delete from public.lectures where cohort < '2026-11';

-- 🔴 입금 기록은 남기고 10월 이전 특강 신청과의 연결만 풀어요
update public.deposit_events set registration_id = null
where registration_id in (
  select r.id from public.special_lecture_registrations r
  join public.special_lectures e on e.id = r.special_lecture_id
  where e.event_date < date '2026-11-01'
);

-- 🔴 10월 이전 특강의 자료 목록·신청 명단·특강 삭제
delete from public.special_lecture_materials
where special_lecture_id in (select id from public.special_lectures where event_date < date '2026-11-01');
delete from public.special_lecture_registrations
where special_lecture_id in (select id from public.special_lectures where event_date < date '2026-11-01');
delete from public.special_lectures where event_date < date '2026-11-01';

commit;

notify pgrst, 'reload schema';

-- ② 확인: 남은 개수 (전부 0이면 정리 완료)
select
  (select count(*) from public.lectures where cohort < '2026-11') as "남은 10월 이전 강의",
  (select count(*) from public.special_lectures where event_date < date '2026-11-01') as "남은 10월 이전 특강";
