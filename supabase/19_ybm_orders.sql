-- YBM 인강생 교재(개념 zip) 주문. 여러 번 실행해도 안전해요.
-- 기존 데이터는 지우거나 바꾸지 않아요.

begin;

-- 1) 인강 주문 (택배만, 교재비 1만원 + 배송비 4천원)
create table if not exists public.ybm_orders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text not null,
  depositor text not null,
  amount integer not null default 14000,
  status text not null default 'pending' check (status in ('pending', 'paid', 'shipped')),
  proof_path text, -- 인강 수강증 캡처 (발송 완료 30일 뒤 자동 삭제)
  paid_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ybm_orders_status_idx on public.ybm_orders (status, created_at);

alter table public.ybm_orders enable row level security;
grant select, insert, update, delete on public.ybm_orders to service_role;

-- 2) 입금 문자 기록에 인강 주문 연결 칸 (교재비 종류로 기록해요)
alter table public.deposit_events
  add column if not exists ybm_order_id uuid references public.ybm_orders(id) on delete set null;

-- 3) 수강증 캡처 비공개 보관함 (사진만, 파일당 5MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ybm-proofs', 'ybm-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

commit;

notify pgrst, 'reload schema';
