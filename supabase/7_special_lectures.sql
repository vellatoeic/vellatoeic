-- 특강 신청·관리용 데이터베이스 (Supabase SQL Editor에서 실행, 여러 번 실행해도 안전해요)
-- 특강 일정, 특강 신청 명단(이름·비밀번호·불라방 연락처), 불라방 자료 파일을 저장해요.
-- 기존 신청·출석·숙제 데이터는 삭제하거나 수정하지 않아요.

begin;

-- 1) 특강 일정 (관리자 화면에서 추가·수정·삭제)
create table if not exists public.special_lectures (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  title text not null,
  starts_at time not null default '10:00',
  ends_at time,
  youtube_id text,
  created_at timestamptz not null default now()
);

-- 2) 특강 신청 명단. 수강생이 아니어도 이름 + 비밀번호 4자리로 신청해요. 연락처는 불라방만 받아요.
create table if not exists public.special_lecture_registrations (
  id uuid primary key default gen_random_uuid(),
  special_lecture_id uuid not null references public.special_lectures(id) on delete cascade,
  mode text not null check (mode in ('onsite', 'online')),
  name text not null,
  phone text,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

-- 3) 불라방 자료 파일 목록 (파일은 비공개 Storage 보관함에 저장)
create table if not exists public.special_lecture_materials (
  id uuid primary key default gen_random_uuid(),
  special_lecture_id uuid not null references public.special_lectures(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists special_lectures_date_idx on public.special_lectures (event_date);
create index if not exists special_registrations_event_idx on public.special_lecture_registrations (special_lecture_id);
create index if not exists special_registrations_name_idx on public.special_lecture_registrations (name);
create index if not exists special_materials_event_idx on public.special_lecture_materials (special_lecture_id);

-- 4) 학생 브라우저에서 직접 접근하지 못하게 RLS를 켜고, 서버 service_role 권한을 보장해요.
alter table public.special_lectures enable row level security;
alter table public.special_lecture_registrations enable row level security;
alter table public.special_lecture_materials enable row level security;

grant select, insert, update, delete on public.special_lectures, public.special_lecture_registrations, public.special_lecture_materials to service_role;

-- 5) 10월 특강 2회 기본값. 특강 표가 비어 있을 때만 넣어요(관리자 화면에서 지운 뒤 다시 실행해도 되살아나지 않아요).
insert into public.special_lectures (event_date, title, starts_at, ends_at)
select v.event_date, v.title, v.starts_at, v.ends_at
from (values
  ('2026-10-17'::date, 'PART 5 액기스 특강', '10:00'::time, '12:00'::time),
  ('2026-10-23'::date, '적중 모의고사 + 풀이', '10:00'::time, null::time)
) as v(event_date, title, starts_at, ends_at)
where not exists (select 1 from public.special_lectures);

-- 6) 불라방 자료 비공개 보관함 (파일당 4MB)
insert into storage.buckets (id, name, public, file_size_limit)
values ('special-lecture-materials', 'special-lecture-materials', false, 4194304)
on conflict (id) do nothing;

commit;

notify pgrst, 'reload schema';
