-- 특강 신청 마감 일시. 여러 번 실행해도 안전해요.
-- 칸만 추가하고 기존 데이터는 바꾸지 않아요. 비어 있으면 '특강 전날 17:00'으로 자동 계산돼요(예: 10/17 특강 → 10/16 17:00).

begin;

alter table public.special_lectures add column if not exists registration_deadline timestamptz;

commit;

notify pgrst, 'reload schema';
