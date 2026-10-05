-- Vella TOEIC: 현재 코드에서 사용하는 Supabase 구조를 한 번에 보완하는 안전한 정합성 SQL
-- 기존 신청·강의·출석·숙제·설정 데이터는 삭제하지 않아요.
-- 기존 Supabase 프로젝트의 SQL Editor에서 실행해 주세요. 여러 번 실행해도 안전해요.

begin;

-- 1) 신청 테이블
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  cohort text not null,
  kind text not null check (kind in ('onsite', 'online')),
  course text not null check (course in ('start', 'solve', 'intensive')),
  track text not null default 'all' check (track in ('all', 'rc', 'lc', 'alt_mw', 'alt_tt', 'alt')),
  continuing boolean not null default false,
  books text[] not null,
  pickup text not null check (pickup in ('classroom', 'delivery')),
  name text not null,
  phone text,
  depositor text not null,
  address text,
  amount integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'shipped')),
  pin_hash text,
  created_at timestamptz not null default now()
);

-- 1단계 이전에 만들어진 applications에도 새 이어듣기 열을 보장해요.
alter table public.applications
  add column if not exists continuing boolean not null default false;

-- 이전 SQL의 반·과정 제약을 현재 선택지에 맞춰 갱신해요.
alter table public.applications drop constraint if exists applications_course_check;
alter table public.applications add constraint applications_course_check
  check (course in ('start', 'solve', 'intensive'));
alter table public.applications drop constraint if exists applications_track_check;
alter table public.applications add constraint applications_track_check
  check (track in ('all', 'rc', 'lc', 'alt_mw', 'alt_tt', 'alt'));
create index if not exists applications_name_idx on public.applications (name);

-- 2) 강의 테이블 (속성반은 시작반·문풀반 강의 두 묶음을 함께 봐요.)
create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  cohort text not null,
  course text not null check (course in ('start', 'solve')),
  part text not null check (part in ('rc', 'lc')),
  title text not null,
  youtube_id text not null,
  created_at timestamptz not null default now()
);

-- 3) 설정 테이블. bank_account, current_cohort, round_*, 라이브 링크,
--    cafe_homework_url, schooldays_<기수>_<반>, holidays_<기수>는 key/value 행으로 저장돼요.
create table if not exists public.settings (
  key text primary key,
  value text not null default ''
);

-- 설정 upsert와 ID 기반 조회, 강의 정렬을 위한 키/인덱스를 보장해요.
create unique index if not exists settings_key_uidx on public.settings (key);
create unique index if not exists applications_id_uidx on public.applications (id);
create unique index if not exists lectures_id_uidx on public.lectures (id);
create index if not exists lectures_cohort_created_idx on public.lectures (cohort, created_at);

-- 4) 출석·숙제 스티커. app_id/day 조합은 학생당 하루 한 건이에요.
create table if not exists public.attendance (
  app_id uuid not null references public.applications(id) on delete cascade,
  day date not null,
  late boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (app_id, day)
);

create table if not exists public.homework (
  app_id uuid not null references public.applications(id) on delete cascade,
  day date not null,
  photo_path text,
  created_at timestamptz not null default now(),
  primary key (app_id, day)
);

-- 표가 일부 열만 있는 상태여도 필요한 열을 추가해요.
alter table public.attendance add column if not exists app_id uuid;
alter table public.attendance add column if not exists day date;
alter table public.attendance add column if not exists late boolean not null default false;
alter table public.attendance add column if not exists created_at timestamptz not null default now();

alter table public.homework add column if not exists app_id uuid;
alter table public.homework add column if not exists day date;
alter table public.homework add column if not exists photo_path text;
alter table public.homework add column if not exists created_at timestamptz not null default now();

-- 사진 없이 숙제 완료 별을 저장할 수 있게 해요. 기존 사진 경로는 그대로 보존돼요.
alter table public.homework alter column photo_path drop not null;

-- Supabase upsert(onConflict: app_id,day)에 필요한 유일 인덱스를 보장해요.
create unique index if not exists attendance_app_id_day_uidx on public.attendance (app_id, day);
create unique index if not exists homework_app_id_day_uidx on public.homework (app_id, day);

-- 부분적으로 만들어진 스티커 테이블에도 신청 삭제 시 함께 정리되는 FK를 보장해요.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attendance'::regclass and conname = 'attendance_app_id_fkey'
  ) then
    alter table public.attendance
      add constraint attendance_app_id_fkey
      foreign key (app_id) references public.applications(id) on delete cascade not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.homework'::regclass and conname = 'homework_app_id_fkey'
  ) then
    alter table public.homework
      add constraint homework_app_id_fkey
      foreign key (app_id) references public.applications(id) on delete cascade not valid;
  end if;
end $$;

-- 5) 학생 브라우저에서 직접 접근하지 못하게 RLS를 켜고, 서버 service_role 권한을 보장해요.
alter table public.applications enable row level security;
alter table public.lectures enable row level security;
alter table public.settings enable row level security;
alter table public.attendance enable row level security;
alter table public.homework enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.applications, public.lectures, public.settings, public.attendance, public.homework to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

-- 6) 관리자 기능에서 사용하는 비공개 숙제 사진 보관함과 서버 Storage 접근 권한.
insert into storage.buckets (id, name, public)
values ('homework', 'homework', false)
on conflict (id) do nothing;

commit;

notify pgrst, 'reload schema';
