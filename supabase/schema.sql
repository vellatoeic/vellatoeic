-- Supabase > SQL Editor 에 붙여넣고 Run 한 번이면 끝.

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  cohort text not null,          -- 기수 (예: 2026-10)
  kind text not null check (kind in ('onsite','online')),
  course text not null check (course in ('start','solve')),
  track text not null default 'all' check (track in ('all','rc','lc','alt')),  -- alt = 격일반
  books text[] not null,
  pickup text not null check (pickup in ('classroom','delivery')),
  name text not null,
  phone text,                    -- 불라방만 입력
  depositor text not null,
  address text,
  amount integer not null,
  status text not null default 'pending' check (status in ('pending','paid','shipped')),
  pin_hash text,                 -- 강의실 비밀번호 (암호화 저장)
  created_at timestamptz not null default now()
);
create index if not exists applications_name_idx on applications (name);

create table if not exists lectures (
  id uuid primary key default gen_random_uuid(),
  cohort text not null,
  course text not null check (course in ('start','solve')),
  part text not null check (part in ('rc','lc')),
  title text not null,
  youtube_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value text not null default ''
);

-- 홈페이지 서버만 접근 (학생 브라우저에서 직접 조회 불가)
alter table applications enable row level security;
alter table lectures enable row level security;
alter table settings enable row level security;

-- 홈페이지 서버(secret key = service_role)에 표 읽기·쓰기 권한 주기
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
