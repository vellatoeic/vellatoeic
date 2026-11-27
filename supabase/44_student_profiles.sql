-- 학생 '내 정보'(처음 로그인 뒤 한 장씩 묻기): 휴대폰 번호(동명이인 구분) · 목표 점수 · 토익 공부 이유를 개인번호별로 저장하는 새 표(student_profiles)만 추가해요. 여러 번 실행해도 안전해요.
-- 기존 신청·데이터는 지우거나 바꾸지 않아요.

begin;

create table if not exists public.student_profiles (
  student_no   text primary key check (student_no ~ '^[1-9][0-9]{5}$'),
  phone        text check (phone ~ '^01[0-9]{8,9}$'),
  target_score int check (target_score between 10 and 990),
  reasons      text[] not null default '{}',
  reason_note  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists student_profiles_phone_idx on public.student_profiles (phone);

-- 다른 표와 같이: 학생 브라우저에서 직접 못 읽고 서버(service_role)만 써요
alter table public.student_profiles enable row level security;
grant select, insert, update, delete on public.student_profiles to service_role;

commit;

notify pgrst, 'reload schema';

-- 확인: 새 표(비어 있음), 신청 수는 그대로
select
  (select count(*) from public.applications) as applications,
  (select count(*) from public.student_profiles) as profiles;
