-- 첫 수업 미션 기록 (소개 입력 · 카페 가입 · 블로그 이웃 · 인스타 팔로우). 여러 번 실행해도 안전해요.
-- 수강 신청 1건당 1줄이에요. 기존 데이터는 지우거나 바꾸지 않아요.

begin;

create table if not exists public.student_missions (
  app_id uuid primary key references public.applications(id) on delete cascade,
  prev_score text,
  target_score text,
  exam_month text,
  affiliation text,
  instagram text,
  message text,
  intro_at timestamptz,
  cafe_at timestamptz,
  blog_at timestamptz,
  insta_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.student_missions enable row level security;
grant select, insert, update, delete on public.student_missions to service_role;

commit;

notify pgrst, 'reload schema';
