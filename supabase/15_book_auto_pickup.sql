-- 교재비 입금 자동 확인 + 1층 데스크 수령 희망 일시 + 택배 FAQ. 여러 번 실행해도 안전해요.
-- 신청·출석·납부 데이터는 지우거나 바꾸지 않아요. (FAQ 문구 3곳만 예전 문구일 때 고쳐요)

begin;

-- 1) 불라방 1층 데스크 수령 희망 날짜·시간 (예전 신청은 비어 있어요)
alter table public.applications add column if not exists pickup_date date;
alter table public.applications add column if not exists pickup_time text;

-- 2) 입금 문자 기록에 교재비 신청 연결 칸 추가 (특강 보증금은 registration_id, 교재비는 application_id)
alter table public.deposit_events
  add column if not exists application_id uuid references public.applications(id) on delete set null;

-- 3) 자주 묻는 질문 문구 고치기 (이미 들어가 있는 FAQ). 예전 문구일 때만 바꿔서 여러 번 실행해도 안전해요.
--    카테고리 이름: '📦 불라방 교재 수령 안내'(또는 '📦 교재 수령 안내') → '📦 수령 안내'
update public.faq_items set category = '📦 수령 안내'
where category in ('📦 불라방 교재 수령 안내', '📦 교재 수령 안내');
--    "입금했는데 '입금 확인 중'으로 나와요." 답의 첫 문장
update public.faq_items
set answer = '입금 확인은 일괄 처리됩니다. 신청할 때 적은 입금자명과 실제 입금자명이 같은지 확인해 주세요.'
where question = '입금했는데 ''입금 확인 중''으로 나와요.' and answer like '입금 확인은 하루에 몇 번%';
--    "반을 잘못 골랐어요." 답
update public.faq_items
set answer = 'Vella쌤에게 문의 부탁드려요.'
where question = '반을 잘못 골랐어요.' and answer like 'Vella쌤에게 알려 주시면 바로 바꿔 드려요%';

-- 4) 자주 묻는 질문: 택배 수령 안내 추가 (같은 질문이 없을 때만 넣어요)
insert into public.faq_items (category, question, answer, published, sort_order)
select '📦 수령 안내', '택배는 언제 수령 가능한가요?',
       '대부분 당일/익일 택배 발송됩니다. 다만 택배 발송 이후부터 수령까지는 발송자가 아닌 택배사 업무라는 점 참고 부탁드려요.',
       true, 135
where not exists (select 1 from public.faq_items where question = '택배는 언제 수령 가능한가요?');

commit;

notify pgrst, 'reload schema';
