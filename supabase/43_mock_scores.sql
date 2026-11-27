-- 모의고사 성적(첫토익 연동) + 학생 개인번호 6자리: 새 표 2개(student_numbers · firsttoeic_exam_results)와 신청서의 개인번호 칸(applications.student_no)만 추가해요. 여러 번 실행해도 안전해요.
-- 기존 신청·데이터는 지우거나 바꾸지 않아요. 개인번호는 사이트가 교재 신청할 때와 관리 화면을 열 때 비어 있는 학생에게 채워요.

begin;

-- 1) 개인번호 장부: 한 번 준 번호는 여기 남아서 다시 쓰이지 않아요(겹치지 않음 · 다른 학생에게 다시 주지 않음)
create table if not exists public.student_numbers (
  no text primary key check (no ~ '^[1-9][0-9]{5}$'),
  created_at timestamptz not null default now()
);
alter table public.student_numbers enable row level security;
grant select, insert, update, delete on public.student_numbers to service_role;

-- 2) 신청서의 개인번호 (같은 학생 = 같은 번호, 다음 달 신청도 같은 번호)
alter table public.applications add column if not exists student_no text;
create index if not exists applications_student_no_idx on public.applications (student_no);

-- 3) 첫토익 모의고사 성적 (첫토익 결과 id로 덮어쓰기). 학생 연결은 개인번호(linked_no)로 해요.
create table if not exists public.firsttoeic_exam_results (
  result_id      uuid primary key,
  exam_id        uuid not null,
  exam_title     text not null,
  exam_date      date not null,
  session        int,
  answer_key     text,
  student_no     text check (student_no ~ '^[0-9]{6}$'),
  name           text not null,
  birth          text check (birth ~ '^[0-9]{6}$'),
  lc_correct     int not null,
  lc_score       int not null,
  rc_correct     int not null,
  rc_score       int not null,
  total          int not null,
  parts          jsonb not null,
  wrong          jsonb not null,
  comment        text,
  part_comments  jsonb not null default '[]'::jsonb,
  blank_sheet    boolean not null default false,
  report_pdf_url text,
  linked_no      text,
  match_status   text not null check (match_status in ('matched', 'review', 'manual')),
  match_note     text,
  received_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists firsttoeic_results_linked_idx on public.firsttoeic_exam_results (linked_no);
create index if not exists firsttoeic_results_date_idx on public.firsttoeic_exam_results (exam_date desc);
create index if not exists firsttoeic_results_status_idx on public.firsttoeic_exam_results (match_status);

-- 다른 표와 같이: 학생 브라우저에서 직접 못 읽고 서버(service_role)만 써요
alter table public.firsttoeic_exam_results enable row level security;
grant select, insert, update, delete on public.firsttoeic_exam_results to service_role;

commit;

notify pgrst, 'reload schema';

-- 확인: 새 표·칸 (모두 비어 있음), 신청 수는 그대로
select
  (select count(*) from public.applications) as applications,
  (select count(*) from public.applications where student_no is not null) as with_student_no,
  (select count(*) from public.student_numbers) as student_numbers,
  (select count(*) from public.firsttoeic_exam_results) as exam_results;
