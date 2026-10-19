-- 1) 수강 환불자의 특강 보증금 환불 기록 칸
-- 2) 테스트 두 개 보는 날 (같은 날 같은 종류 2개 저장)
-- 여러 번 실행해도 안전해요. 기존 데이터는 지우거나 바꾸지 않아요.

begin;

-- 1) 특강 보증금 환불 완료 시각
alter table public.special_lecture_registrations add column if not exists deposit_refunded_at timestamptz;

-- 2-1) 두 개 보는 날 목록 (날짜 · 종류)
create table if not exists public.test_doubles (
  day date not null,
  kind text not null check (kind in ('word', 'rc')),
  primary key (day, kind)
);
alter table public.test_doubles enable row level security;
grant select, insert, update, delete on public.test_doubles to service_role;

-- 2-2) 테스트 결과: '신청·날짜·종류' 하나 → '신청·날짜·종류·번호' 하나로 (같은 날 RC 2개 저장 가능)
--      새 규칙을 먼저 만들고, 예전 규칙(번호 없는 것)만 지워요. 결과 데이터는 그대로예요.
create unique index if not exists test_results_app_day_kind_no_key on public.test_results (app_id, day, kind, test_no);
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.test_results'::regclass and contype = 'u' and array_length(conkey, 1) = 3
  loop
    execute format('alter table public.test_results drop constraint %I', c);
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
