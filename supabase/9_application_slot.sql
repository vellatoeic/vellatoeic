-- 수강 신청에 수강 시간(오전반/저녁반) 칸을 추가해요. (여러 번 실행해도 안전해요)
-- 기존 신청은 지우거나 바꾸지 않아요. 이미 들어온 신청은 '시간 미정'(빈칸)으로 남고, 관리 화면에서 정해 줄 수 있어요.

begin;

alter table public.applications
  add column if not exists slot text check (slot in ('am', 'pm'));

create index if not exists applications_cohort_slot_idx on public.applications (cohort, slot);

commit;

notify pgrst, 'reload schema';
