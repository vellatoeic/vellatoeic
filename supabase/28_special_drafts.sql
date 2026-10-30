-- 특강 자동 생성: 공개 여부 칸 + 11월 특강 요일(금) 저장 + 11월 초안(없을 때만). 여러 번 실행해도 안전해요.
-- 기존 특강은 모두 공개(true) 그대로예요. 지우거나 바꾸는 내용은 없어요.

begin;

-- 1) 특강 공개 여부 (false = 자동으로 만든 초안, 학생에게 안 보여요). 기존 특강은 기본값 true로 모두 공개.
alter table public.special_lectures add column if not exists published boolean not null default true;

-- 2) 2026년 11월 특강 요일: 금요일(5)
insert into public.settings (key, value) values ('special_weekday:2026-11', '5')
on conflict (key) do update set value = excluded.value;

-- 3) 11월 특강 초안: 11/6(금) 1차, 11/20(금) 2차. 같은 날짜 특강이나 11월에 같은 제목 특강이 이미 있으면 만들지 않아요.
insert into public.special_lectures (event_date, title, starts_at, ends_at, published)
select date '2026-11-06', 'PART 5 액기스 특강', '10:00', '12:00', false
where not exists (select 1 from public.special_lectures where event_date = date '2026-11-06')
  and not exists (select 1 from public.special_lectures where title = 'PART 5 액기스 특강' and event_date between date '2026-11-01' and date '2026-11-30');

insert into public.special_lectures (event_date, title, starts_at, ends_at, published)
select date '2026-11-20', '적중 모의고사 + 풀이', '10:00', null, false
where not exists (select 1 from public.special_lectures where event_date = date '2026-11-20')
  and not exists (select 1 from public.special_lectures where title = '적중 모의고사 + 풀이' and event_date between date '2026-11-01' and date '2026-11-30');

commit;

notify pgrst, 'reload schema';
