-- 특강 신청·관리용 데이터베이스 (Supabase SQL Editor에서 한 번 실행)
-- 두 특강 일정, 신청 방식, 보증금/참석/환급 상태, 온라인 자료를 저장해요.
-- 기존 신청·출석·숙제 데이터는 삭제하거나 수정하지 않아요.

begin;

create table if not exists public.special_lectures (
  id uuid primary key default gen_random_uuid(),
  cohort text not null,
  event_date date not null unique,
  title text not null,
  starts_at time not null default '10:00',
  ends_at time,
  youtube_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.special_lecture_registrations (
  id uuid primary key default gen_random_uuid(),
  special_lecture_id uuid not null references public.special_lectures(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  mode text not null check (mode in ('onsite', 'online')),
  deposit_paid boolean not null default false,
  approved boolean not null default false,
  attended boolean not null default false,
  refunded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (special_lecture_id, application_id)
);

create table if not exists public.special_lecture_materials (
  id uuid primary key default gen_random_uuid(),
  special_lecture_id uuid not null references public.special_lectures(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists special_lectures_date_idx on public.special_lectures (event_date);
create index if not exists special_registrations_event_idx on public.special_lecture_registrations (special_lecture_id);
create index if not exists special_registrations_application_idx on public.special_lecture_registrations (application_id);
create index if not exists special_materials_event_idx on public.special_lecture_materials (special_lecture_id);

alter table public.special_lectures enable row level security;
alter table public.special_lecture_registrations enable row level security;
alter table public.special_lecture_materials enable row level security;

grant select, insert, update, delete on public.special_lectures, public.special_lecture_registrations, public.special_lecture_materials to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

insert into public.special_lectures (cohort, event_date, title, starts_at, ends_at)
values
  ('2026-10', '2026-10-17', 'PART 5 액기스 특강', '10:00', '12:00'),
  ('2026-10', '2026-10-23', '적중 모의고사 + 풀이', '10:00', null)
on conflict (event_date) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('special-lecture-materials', 'special-lecture-materials', false, 4194304)
on conflict (id) do nothing;

commit;

notify pgrst, 'reload schema';
