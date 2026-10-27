-- 운영 자동화 + 중간 등록 정리. 여러 번 실행해도 안전해요.
-- 기존 데이터는 지우거나 바꾸지 않아요. (입금 기록 '결과' 규칙만 새 값 하나를 더 받도록 바꿔요)

begin;

-- 1) 수강 신청: 납부 확인 시각(LC 음원 기간 시작) · 관리자가 음원 기간을 다시 열어 준 마지막 날
alter table public.applications add column if not exists paid_at timestamptz;
alter table public.applications add column if not exists audio_extended_until date;

-- 2) 매달 반복 공지: 개강일부터 n일 동안
alter table public.site_notices add column if not exists repeat_monthly boolean not null default false;
alter table public.site_notices add column if not exists repeat_days integer;

-- 3) 공지 '확인했어요' 기록에 기수 (반복 공지는 기수마다 다시 떠요)
alter table public.site_notice_reads add column if not exists cohort text;

-- 4) 입금 기록 결과에 'waiting'(신청서보다 먼저 온 교재비 입금) 추가
--    예전 결과 규칙을 지우고 같은 이름으로 새 값까지 받는 규칙을 다시 만들어요. 기록 데이터는 그대로예요.
alter table public.deposit_events drop constraint if exists deposit_events_result_check;
alter table public.deposit_events add constraint deposit_events_result_check
  check (result in ('matched', 'review', 'unmatched', 'resolved', 'dismissed', 'waiting'));
create index if not exists deposit_events_waiting_idx on public.deposit_events (result, received_at);

commit;

notify pgrst, 'reload schema';
