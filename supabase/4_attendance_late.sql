-- 2단계: 출석 지각 표시 (Supabase > SQL Editor 에서 한 번 실행)
-- 기존 출석 기록은 지각 아님(false)으로 유지돼요.

alter table attendance
  add column if not exists late boolean not null default false;
