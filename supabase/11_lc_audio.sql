-- LC 음원 다운로드 (강의실). 여러 번 실행해도 안전해요.
-- 음원 목록 표와 비공개 음원 보관함을 만들어요. 기존 데이터는 지우거나 바꾸지 않아요.

begin;

create table if not exists public.lc_audios (
  id uuid primary key default gen_random_uuid(),
  cohort text not null,
  course text not null check (course in ('start', 'solve')),
  title text not null,
  storage_path text not null unique,
  size_bytes bigint not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lc_audios_cohort_course_idx on public.lc_audios (cohort, course, sort_order);

alter table public.lc_audios enable row level security;
grant select, insert, update, delete on public.lc_audios to service_role;

-- 비공개 음원 보관함 (mp3만, 파일 하나 50MB까지). 학생은 1분짜리 서명 주소로만 받아요.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lc-audio', 'lc-audio', false, 52428800, array['audio/mpeg'])
on conflict (id) do nothing;

commit;

notify pgrst, 'reload schema';
