-- 스티커판 완성 선물: 선물 목록 · 뽑기 기록 · 동시에 눌러도 수량이 넘지 않는 뽑기 함수
-- 여러 번 실행해도 안전해요. 기존 데이터는 지우거나 바꾸지 않아요.

begin;

-- 1) 기수별 선물 목록 (quantity가 비어 있으면 무제한 기본 선물)
create table if not exists public.gift_items (
  id uuid primary key default gen_random_uuid(),
  cohort text not null,
  name text not null,
  quantity integer check (quantity is null or quantity >= 0),
  created_at timestamptz not null default now()
);
create index if not exists gift_items_cohort_idx on public.gift_items (cohort);

-- 2) 뽑기 기록: 학생 1명(student_key)당 기수마다 1번
create table if not exists public.gift_draws (
  id uuid primary key default gen_random_uuid(),
  cohort text not null,
  student_key text not null,
  app_id uuid references public.applications(id) on delete set null,
  name text not null,
  klass text not null default '',
  kind text not null default '',
  gift_id uuid references public.gift_items(id) on delete set null,
  gift_name text not null,
  code text not null,
  drawn_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (cohort, student_key)
);
create index if not exists gift_draws_cohort_idx on public.gift_draws (cohort, drawn_at desc);

alter table public.gift_items enable row level security;
alter table public.gift_draws enable row level security;
grant select, insert, update, delete on public.gift_items, public.gift_draws to service_role;

-- 3) 뽑기 함수: 기수마다 한 줄로 세워서(잠금) 처리 → 두 명이 동시에 눌러도 수량을 넘지 않아요.
--    이미 뽑았으면 그 기록을 그대로 돌려줘요. 남은 수량만큼 확률을 주고, 수량 있는 선물이 다 떨어지면 무제한 기본 선물.
create or replace function public.draw_gift(
  p_cohort text, p_student_key text, p_app_id uuid, p_name text, p_klass text, p_kind text, p_code text
) returns public.gift_draws
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.gift_draws;
  v_id uuid;
  v_name text;
  result public.gift_draws;
begin
  perform pg_advisory_xact_lock(hashtext('gift:' || p_cohort));

  select * into existing from public.gift_draws where cohort = p_cohort and student_key = p_student_key;
  if found then return existing; end if;

  -- 수량이 남은 선물 중 하나: 남은 개수가 많을수록 뽑힐 확률이 커요
  select g.id, g.name into v_id, v_name
  from public.gift_items g
  left join (select gift_id, count(*) as used from public.gift_draws where cohort = p_cohort group by gift_id) d on d.gift_id = g.id
  where g.cohort = p_cohort and g.quantity is not null and g.quantity - coalesce(d.used, 0) > 0
  order by -ln(1 - random()) / (g.quantity - coalesce(d.used, 0)) asc
  limit 1;

  -- 다 떨어졌으면 무제한 기본 선물 중 하나
  if v_id is null then
    select g.id, g.name into v_id, v_name from public.gift_items g where g.cohort = p_cohort and g.quantity is null order by random() limit 1;
  end if;

  insert into public.gift_draws (cohort, student_key, app_id, name, klass, kind, gift_id, gift_name, code)
  values (p_cohort, p_student_key, p_app_id, p_name, p_klass, p_kind, v_id, coalesce(v_name, '벨라토익 선물'), p_code)
  returning * into result;
  return result;
end;
$$;

revoke all on function public.draw_gift(text, text, uuid, text, text, text, text) from public;
grant execute on function public.draw_gift(text, text, uuid, text, text, text, text) to service_role;

commit;

notify pgrst, 'reload schema';
