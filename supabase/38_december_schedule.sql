-- 12월(2026-12) 수업 일정: 7개 반 수업일·공휴일(12/25 성탄절)·특강 요일(토)·수업일 확인 저장 + 특강 초안 12/5·12/19(없을 때만)
-- 설정은 덮어쓰기(upsert), 특강은 초안(published=false) 추가만 해요. 지우는 내용은 없고 여러 번 실행해도 안전해요.
-- 12/1이 화요일이라 1주차는 화~금(12/1~12/4), 2~4주차는 월~목이에요. 격일반은 요일이 아니라 회차 기준이라
-- 1주차에 월수반은 12/1(화)·12/3(목), 화목반은 12/2(수)·12/4(금)에 들어요.

begin;

-- 0) 실행 전: 이미 저장된 12월 설정과 12월 특강 (참고용 조회)
select key, value from public.settings
where key like 'schooldays\_2026-12\_%' or key in ('holidays_2026-12', 'special_weekday:2026-12', 'schedule_confirmed:2026-12')
order by key;

select event_date, title, starts_at, ends_at, published from public.special_lectures
where event_date between date '2026-12-01' and date '2026-12-31'
order by event_date;

-- 1) 수업일 설정 7개 반 ([수업일 설정] 저장과 같은 형식: 날짜 JSON 배열)
insert into public.settings (key, value) values
  ('schooldays_2026-12_start-all',     '["2026-12-01","2026-12-02","2026-12-03","2026-12-04","2026-12-07","2026-12-08","2026-12-09","2026-12-10","2026-12-14","2026-12-15","2026-12-16","2026-12-17","2026-12-21","2026-12-22","2026-12-23","2026-12-24"]'),
  ('schooldays_2026-12_solve-all',     '["2026-12-01","2026-12-02","2026-12-03","2026-12-04","2026-12-07","2026-12-08","2026-12-09","2026-12-10","2026-12-14","2026-12-15","2026-12-16","2026-12-17","2026-12-21","2026-12-22","2026-12-23","2026-12-24"]'),
  ('schooldays_2026-12_intensive-all', '["2026-12-01","2026-12-02","2026-12-03","2026-12-04","2026-12-07","2026-12-08","2026-12-09","2026-12-10","2026-12-14","2026-12-15","2026-12-16","2026-12-17","2026-12-21","2026-12-22","2026-12-23","2026-12-24"]'),
  ('schooldays_2026-12_start-mw',      '["2026-12-01","2026-12-03","2026-12-07","2026-12-09","2026-12-14","2026-12-16","2026-12-21","2026-12-23"]'),
  ('schooldays_2026-12_solve-mw',      '["2026-12-01","2026-12-03","2026-12-07","2026-12-09","2026-12-14","2026-12-16","2026-12-21","2026-12-23"]'),
  ('schooldays_2026-12_start-tt',      '["2026-12-02","2026-12-04","2026-12-08","2026-12-10","2026-12-15","2026-12-17","2026-12-22","2026-12-24"]'),
  ('schooldays_2026-12_solve-tt',      '["2026-12-02","2026-12-04","2026-12-08","2026-12-10","2026-12-15","2026-12-17","2026-12-22","2026-12-24"]')
on conflict (key) do update set value = excluded.value;

-- 2) 공휴일
insert into public.settings (key, value) values ('holidays_2026-12', '{"2026-12-25":"성탄절"}')
on conflict (key) do update set value = excluded.value;

-- 3) 특강 요일: 토요일(6)
insert into public.settings (key, value) values ('special_weekday:2026-12', '6')
on conflict (key) do update set value = excluded.value;

-- 4) 수업일 확인 ('이번 달 할 일' ③ ✅)
insert into public.settings (key, value) values ('schedule_confirmed:2026-12', '1')
on conflict (key) do update set value = excluded.value;

-- 5) 특강 초안 (syncSpecialDrafts와 같은 규칙: 개강 1주차·3주차 토요일)
--    1차 12/5(토) PART 5 액기스 특강 10:00~12:00 / 2차 12/19(토) 적중 모의고사 + 풀이 10:00~
--    같은 날짜 특강이 있거나 12월에 같은 제목 특강(공개·초안)이 이미 있으면 만들지 않아요. 마감은 비워 둠(전날 17:00).
insert into public.special_lectures (event_date, title, starts_at, ends_at, registration_deadline, published)
select date '2026-12-05', 'PART 5 액기스 특강', '10:00', '12:00', null, false
where not exists (select 1 from public.special_lectures where event_date = date '2026-12-05')
  and not exists (select 1 from public.special_lectures where title = 'PART 5 액기스 특강' and event_date between date '2026-12-01' and date '2026-12-31');

insert into public.special_lectures (event_date, title, starts_at, ends_at, registration_deadline, published)
select date '2026-12-19', '적중 모의고사 + 풀이', '10:00', null, null, false
where not exists (select 1 from public.special_lectures where event_date = date '2026-12-19')
  and not exists (select 1 from public.special_lectures where title = '적중 모의고사 + 풀이' and event_date between date '2026-12-01' and date '2026-12-31');

-- 6) 실행 후 확인: 12월 설정·특강, 11월 수업일(11월 종강일 점검용)
select key, value from public.settings
where key like 'schooldays\_2026-12\_%' or key in ('holidays_2026-12', 'special_weekday:2026-12', 'schedule_confirmed:2026-12')
order by key;

select event_date, title, starts_at, ends_at, registration_deadline, published from public.special_lectures
where event_date between date '2026-12-01' and date '2026-12-31'
order by event_date;

select key, value from public.settings
where key like 'schooldays\_2026-11\_%' or key = 'holidays_2026-11'
order by key;

-- 7) 참고: '월요일' 개강 문구가 들어간 FAQ·공지 (조회만, 바꾸지 않아요)
select 'faq' as kind, question as title from public.faq_items where question like '%월요일%' or answer like '%월요일%'
union all
select 'notice', title from public.site_notices where title like '%월요일%' or lead like '%월요일%' or sections::text like '%월요일%';

commit;
