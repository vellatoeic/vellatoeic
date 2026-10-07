-- 특강 현장 신청 보증금(1만원) 상태를 저장해요. 여러 번 실행해도 안전해요.
-- 기존 신청은 지우거나 바꾸지 않아요. 이미 있던 현장 신청은 '입금 대기'로 보여요.

begin;

alter table public.special_lecture_registrations
  add column if not exists deposit text check (deposit in ('pending', 'paid', 'refunded', 'forfeited'));

commit;

notify pgrst, 'reload schema';
