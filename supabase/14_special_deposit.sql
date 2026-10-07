-- 특강 현장 신청 보증금 + 입금 문자 자동 확인 기록. 여러 번 실행해도 안전해요.
-- 기존 특강 신청은 지우거나 바꾸지 않아요. (이미 있던 현장 신청은 보증금 상태가 비어 있어 '입금 대기'로 보여요)

begin;

-- 1) 현장 신청 보증금 상태: 입금 대기(pending) · 확정(paid) · 확인 필요(review, 입금 문자 확인용) · 취소(cancelled, 신청 후 30분 안에 입금 없음)
alter table public.special_lecture_registrations
  add column if not exists deposit text check (deposit in ('pending', 'paid', 'review', 'cancelled'));
alter table public.special_lecture_registrations
  add column if not exists deposit_paid_at timestamptz;

-- 2) 입금 문자 기록. 문자 원문은 저장하지 않고 이름·금액·시각·처리 결과만 남겨요.
--    target은 어떤 입금인지 구분해요 (지금은 특강 보증금 special, 나중에 교재비 book).
create table if not exists public.deposit_events (
  id uuid primary key default gen_random_uuid(),
  target text not null default 'special' check (target in ('special', 'book')),
  name text not null default '',
  amount integer not null default 0,
  received_at timestamptz not null default now(),
  result text not null check (result in ('matched', 'review', 'unmatched', 'resolved', 'dismissed')),
  registration_id uuid references public.special_lecture_registrations(id) on delete set null
);
create index if not exists deposit_events_received_idx on public.deposit_events (received_at desc);

alter table public.deposit_events enable row level security;
grant select, insert, update, delete on public.deposit_events to service_role;

commit;

notify pgrst, 'reload schema';
