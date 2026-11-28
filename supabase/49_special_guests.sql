-- 비수강생 특강 신청(잠재 고객): 카카오·구글 계정 + 이름·휴대폰 + '벨라토익 소식 받을게요' 동의를 저장하는 표와, 특강 신청에 연결하는 칸을 추가해요. 여러 번 실행해도 안전해요.
-- 2026-11-28 Vella: 모든 특강을 비수강생도 현장으로 들을 수 있어요(학원 문자 → 사이트 신청). 비수강생도 개인번호를 받아 모의고사 성적을 사이트에서 봐요.
-- 기존 데이터는 지우거나 바꾸지 않아요.

begin;

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique,          -- 카카오·구글 학생 번호 (login_links.account_id)
  student_no text unique,                   -- 개인번호 6자리 (student_numbers 장부에서 받아요, 나중에 수강 등록하면 그대로 이어져요)
  name text not null,
  phone text,
  news_opt_in boolean not null default false, -- '벨라토익 소식 받을게요' (광고 수신 선택 동의)
  news_opt_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.prospects enable row level security;

alter table public.special_lecture_registrations add column if not exists prospect_id uuid references public.prospects(id) on delete set null;
create index if not exists special_lecture_registrations_prospect_idx on public.special_lecture_registrations (prospect_id);

commit;

notify pgrst, 'reload schema';

-- 확인
select
  (select count(*) from public.prospects) as prospects,
  (select count(*) from public.special_lecture_registrations where prospect_id is not null) as guest_registrations;
