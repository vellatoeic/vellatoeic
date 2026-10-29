-- 교재비 신청·인강 주문 30분 입금 규칙 + 자동 취소. 여러 번 실행해도 안전해요.
-- 기존 신청·주문 데이터는 지우거나 바꾸지 않아요. (상태 규칙만 'cancelled'를 더 받도록 바꿔요)
-- 30분 규칙은 사이트가 처음 이 기능을 쓰는 순간을 기준으로 켜져요(settings deposit_timeout_from). 그 전 신청은 자동 취소되지 않아요.

begin;

-- 1) 수강 신청: 취소 시각 · 취소 이유(timeout = 30분 미입금 자동, admin = 관리자) · 30분 타이머 시작(되살리면 그 시각)
alter table public.applications add column if not exists cancelled_at timestamptz;
alter table public.applications add column if not exists cancel_reason text;
alter table public.applications add column if not exists pending_from timestamptz;
alter table public.applications drop constraint if exists applications_cancel_reason_check;
alter table public.applications add constraint applications_cancel_reason_check
  check (cancel_reason is null or cancel_reason in ('timeout', 'admin'));

-- 🔴 상태 규칙 교체: 'cancelled' 추가 (기존 값은 그대로 유효)
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('pending', 'paid', 'shipped', 'refunded', 'cancelled'));

-- 2) YBM 인강 주문: 같은 칸 + 상태 규칙에 'cancelled' 추가
alter table public.ybm_orders add column if not exists cancelled_at timestamptz;
alter table public.ybm_orders add column if not exists cancel_reason text;
alter table public.ybm_orders add column if not exists pending_from timestamptz;
alter table public.ybm_orders drop constraint if exists ybm_orders_cancel_reason_check;
alter table public.ybm_orders add constraint ybm_orders_cancel_reason_check
  check (cancel_reason is null or cancel_reason in ('timeout', 'admin'));

-- 🔴 상태 규칙 교체: 'cancelled' 추가 (기존 값은 그대로 유효)
alter table public.ybm_orders drop constraint if exists ybm_orders_status_check;
alter table public.ybm_orders add constraint ybm_orders_status_check
  check (status in ('pending', 'paid', 'shipped', 'cancelled'));

create index if not exists applications_status_created_idx on public.applications (status, created_at);

-- 3) 🔴 FAQ 답 수정 (질문 문구가 정확히 같은 행만)
update public.faq_items
set answer = '신청 후 30분 안에 입금하면 보통 몇 분 안에 자동 확인돼요. 다른 이름으로 입금했다면 신청서 입금자명 칸에 꼭 적어 주세요. 30분이 지나 취소됐다면 다시 신청해 주세요.'
where question = '입금했는데 ''입금 확인 중''으로 나와요.';

commit;

notify pgrst, 'reload schema';
