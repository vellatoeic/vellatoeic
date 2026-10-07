-- 문풀반 데일리 테스트 (단어 TEST · RC TEST) 결과와 관리자 번호 수정. 여러 번 실행해도 안전해요.
-- 기존 데이터는 지우거나 바꾸지 않아요.

begin;

-- 1) 학생 테스트 결과: 신청 1건 · 수업일 · 종류(word/rc)마다 한 줄
create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.applications(id) on delete cascade,
  cohort text not null,
  day date not null,
  kind text not null check (kind in ('word', 'rc')),
  test_no integer not null,
  questions integer not null,
  score integer not null,
  wrong integer[] not null default '{}',
  late boolean not null default false,
  submitted_at timestamptz not null default now(),
  unique (app_id, day, kind)
);
create index if not exists test_results_cohort_day_idx on public.test_results (cohort, day);

-- 2) 관리자가 특정 날짜의 테스트 번호·문항 수를 직접 고친 값 (test_no가 비어 있으면 그날 그 테스트 없음)
create table if not exists public.test_overrides (
  day date not null,
  kind text not null check (kind in ('word', 'rc')),
  test_no integer,
  questions integer,
  primary key (day, kind)
);

alter table public.test_results enable row level security;
alter table public.test_overrides enable row level security;
grant select, insert, update, delete on public.test_results, public.test_overrides to service_role;

commit;

notify pgrst, 'reload schema';
