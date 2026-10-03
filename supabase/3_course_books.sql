-- 1단계: 반·과정·교재 개편 (Supabase > SQL Editor 에 붙여넣고 Run)
-- 한 번만 실행하면 돼요. 기존 신청·출석·숙제 기록은 지워지지 않아요.

-- 1) 속성반 추가
alter table applications drop constraint if exists applications_course_check;
alter table applications add constraint applications_course_check
  check (course in ('start','solve','intensive'));

-- 2) 격일반 월수·화목 추가
--    기존 격일반 신청은 월수인지 화목인지 알 수 없어서 'alt'(요일 미지정)로 그대로 둬요.
--    관리 페이지의 [반 변경]에서 학생별로 월수·화목을 골라 주세요.
alter table applications drop constraint if exists applications_track_check;
alter table applications add constraint applications_track_check
  check (track in ('all','rc','lc','alt_mw','alt_tt','alt'));

-- 3) 격일반 이어듣기 표시 (지난달에 이어 듣는 수강생은 LC만 새로 받아요)
alter table applications add column if not exists continuing boolean not null default false;

-- 4) 기존 교재를 새 책 이름으로 변환
--    LC는 시작반·문풀반 공통 교재 1종이 되고, 문풀반 RC와 LC는 기수 회차(1·2)에 따라 번갈아요.
--    회차: (연*12 + 월) % 2 = 1 이면 1회차, 아니면 2회차
with r as (
  select id,
         case when ((split_part(cohort, '-', 1)::int * 12 + split_part(cohort, '-', 2)::int) % 2) = 1
              then 1 else 2 end as round
  from applications
)
update applications a
set books = (
  select array_agg(distinct b)
  from (
    select case x
             when 'start_lc' then case when r.round = 1 then 'lc1' else 'lc2' end
             when 'solve_lc' then case when r.round = 1 then 'lc1' else 'lc2' end
             when 'solve_rc' then case when r.round = 1 then 'solve_rc1' else 'solve_rc2' end
             else x
           end as b
    from unnest(a.books) as x
  ) t
)
from r
where r.id = a.id
  and a.books && array['start_lc', 'solve_lc', 'solve_rc'];

-- 5) 확인용: 교재 이름이 새 이름으로 바뀌었는지, 금액이 권수 x 1만원 + 택배비와 맞는지 보세요.
select cohort, course, track, continuing, books, amount, pickup, name
from applications
order by created_at desc
limit 20;
