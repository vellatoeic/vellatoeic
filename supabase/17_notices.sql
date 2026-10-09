-- 공지 팝업 + 확인 기록 + 첫 공지 2개. 여러 번 실행해도 안전해요.
-- 기존 데이터는 지우거나 바꾸지 않아요.

begin;

-- 1) 공지
--    targets: 대상 조건 목록 (비어 있으면 전체). 예) [{"courses":["solve"],"tracks":["all","rc"],"kinds":["onsite"]}]
--    sections: [{"icon":"🕘","title":"언제 · 어디서","body":"**수업 30분 전, 704호**로 입실해 주세요","gray":false}]
--    link_url이 '@study'면 관리자 설정의 '스터디 인증 게시판 링크'로 열려요.
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  to_label text not null default '',
  lead text not null default '',
  sections jsonb not null default '[]'::jsonb,
  link_label text,
  link_url text,
  targets jsonb not null default '[]'::jsonb,
  starts_on date not null default current_date,
  ends_on date not null,
  popup boolean not null default true,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2) 공지 확인 기록 (수강 신청 1건마다)
create table if not exists public.notice_reads (
  notice_id uuid not null references public.notices(id) on delete cascade,
  app_id uuid not null references public.applications(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, app_id)
);

alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;
grant select, insert, update, delete on public.notices, public.notice_reads to service_role;

-- 3) 첫 공지 2개 (게시 기간: 오늘 ~ 이번 달 말일, 같은 제목이 없을 때만)
insert into public.notices (title, to_label, lead, sections, link_label, link_url, targets, starts_on, ends_on, popup, pinned, created_at)
select '📚 다음 수업부터 문풀반 스터디 시작!',
       '문풀반 · 현장 수강생 안내',
       '수업 시간에 안내한 대로 **다음 수업부터 스터디를 진행해요.**' || chr(10) || '아래 내용 확인하고 미리 준비해 주세요 :)',
       '[
         {"icon":"🕘","title":"언제 · 어디서","body":"**수업 30분 전, 704호**로 입실해 주세요"},
         {"icon":"✏️","title":"스터디 방법","body":"PART 5 숙제 **1~30번 답 단서**를 한 사람씩 돌아가며 설명해요\n+ 접·주·동 / 전치사 문장 성분 보기 연습"},
         {"icon":"❓","title":"막힌 문제는","body":"조원 모두 설명이 어렵거나 풀이가 엇갈린 문제는 **조장이 숙제 게시글에 문제 번호**를 적어 주세요"},
         {"icon":"✅","title":"스터디 인증","body":"네이버 카페 **''문풀반 스터디 인증''** 게시판에 인증 글을 남기면 **스터디 완료!**"},
         {"icon":"💻","title":"현장 참여가 어려운 날","body":"숙제 후 1~30번 답 단서를 적고, 헷갈린 문제 번호를 숙제 게시글 댓글로 남겨 주세요","gray":true}
       ]'::jsonb,
       '✅ 인증하러 가기', '@study',
       '[{"courses":["solve"],"tracks":["all","rc"],"kinds":["onsite"]}]'::jsonb,
       current_date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, true, false, now()
where not exists (select 1 from public.notices where title = '📚 다음 수업부터 문풀반 스터디 시작!');

insert into public.notices (title, to_label, lead, sections, link_label, link_url, targets, starts_on, ends_on, popup, pinned, created_at)
select '📚 다음 수업부터 스터디 시작! (온라인 참여)',
       '실전속성반 · 불라방 수강생 안내',
       '수업 시간에 안내한 대로 **다음 수업부터 스터디를 진행해요.**' || chr(10) || '아래 방법으로 미리 준비해 주세요 :)',
       '[
         {"icon":"✏️","title":"스터디 방법","body":"숙제를 마친 뒤 PART 5 **1~30번의 답 단서**를 적어 주세요"},
         {"icon":"❓","title":"헷갈린 문제는","body":"문제 번호를 **숙제 게시글 아래 댓글**로 남겨 주세요"},
         {"icon":"✅","title":"스터디 인증","body":"네이버 카페 **''문풀반 스터디 인증''** 게시판에 인증 글을 남기면 **스터디 완료!**"}
       ]'::jsonb,
       '✅ 인증하러 가기', '@study',
       '[{"courses":["intensive"]},{"courses":["solve"],"tracks":["all","rc"],"kinds":["online"]}]'::jsonb,
       current_date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, true, false, now() + interval '1 second'
where not exists (select 1 from public.notices where title = '📚 다음 수업부터 스터디 시작! (온라인 참여)');

commit;

notify pgrst, 'reload schema';
