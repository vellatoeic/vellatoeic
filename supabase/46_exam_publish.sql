-- 모의고사 회차별 '공개' 스위치(결과화면 가이드 2장): 회차 표(firsttoeic_exams)만 새로 만들어요. 여러 번 실행해도 안전해요.
-- 공개 전에는 학생에게 점수 대신 '채점 결과를 정리하고 있어요'만 보여요. 새 회차는 비공개로 들어오고, 관리 [모의고사]에서 [공개]를 눌러요.
-- 이미 받은 성적(firsttoeic_exam_results)은 지우거나 바꾸지 않아요. 표에 없는 회차도 비공개로 봐요.

begin;

create table if not exists public.firsttoeic_exams (
  exam_id      uuid primary key,
  title        text not null,
  exam_date    date not null,
  session      int,
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.firsttoeic_exams enable row level security;
grant select, insert, update, delete on public.firsttoeic_exams to service_role;

commit;

notify pgrst, 'reload schema';

-- 확인: 새 표(비어 있음), 받은 성적 수는 그대로
select
  (select count(*) from public.firsttoeic_exams) as exams,
  (select count(*) from public.firsttoeic_exam_results) as results;
