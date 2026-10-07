-- 교재비 입금 자동 확인 + 1층 데스크 수령 희망 일시 + 택배 FAQ. 여러 번 실행해도 안전해요.
-- 기존 데이터는 지우거나 바꾸지 않아요.

begin;

-- 1) 불라방 1층 데스크 수령 희망 날짜·시간 (예전 신청은 비어 있어요)
alter table public.applications add column if not exists pickup_date date;
alter table public.applications add column if not exists pickup_time text;

-- 2) 입금 문자 기록에 교재비 신청 연결 칸 추가 (특강 보증금은 registration_id, 교재비는 application_id)
alter table public.deposit_events
  add column if not exists application_id uuid references public.applications(id) on delete set null;

-- 3) 자주 묻는 질문: 택배 수령 안내 (같은 질문이 없을 때만 넣어요)
insert into public.faq_items (category, question, answer, published, sort_order)
select '📦 교재 수령 안내', '택배는 언제 수령 가능한가요?',
       '대부분 당일/익일 택배 발송됩니다. 다만 택배 발송 이후부터 수령까지는 발송자가 아닌 택배사 업무라는 점 참고 부탁드려요.',
       true, 135
where not exists (select 1 from public.faq_items where question = '택배는 언제 수령 가능한가요?');

commit;

notify pgrst, 'reload schema';
