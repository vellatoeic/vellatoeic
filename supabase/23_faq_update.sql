-- FAQ 2개 답 수정 + 6개 추가 (🎤 특강 3개, 새 카테고리 📝 데일리 테스트 3개)
-- 여러 번 실행해도 안전해요: 수정은 질문 문구가 정확히 같은 행만, 추가는 같은 질문이 없을 때만.

begin;

-- 🔴 기존 답 수정 (질문 문구가 정확히 같은 행만)
update public.faq_items set answer = '특강 하루 전 특강 페이지에 자료가, 특강 당일에 유튜브 링크가 올라와요.'
where question = '불라방 특강은 어떻게 들어요?';

update public.faq_items set answer = '입금하면 보통 몇 분 안에 자동으로 확인돼요. 오래 걸리면 신청할 때 적은 입금자명과 실제 입금자명이 같은지 확인하고 Vella쌤에게 알려 주세요.'
where question = '입금했는데 ''입금 확인 중''으로 나와요.';

-- 새 질문 추가 (공개, 같은 카테고리 맨 끝 순서. 새 카테고리는 전체 맨 끝부터)
insert into public.faq_items (category, question, answer, published, sort_order)
select '🎤 특강', '지난 특강 다시 볼 수 있나요?', '신청한 학생은 특강 페이지에서 그달 말일까지 ''📺 특강 다시 보기''로 볼 수 있어요. 현장 신청은 보증금이 확인된 경우만 열려요.', true,
       coalesce((select max(sort_order) from public.faq_items where category = '🎤 특강'), (select max(sort_order) from public.faq_items), 0) + 1
where not exists (select 1 from public.faq_items where question = '지난 특강 다시 볼 수 있나요?');

insert into public.faq_items (category, question, answer, published, sort_order)
select '🎤 특강', '현장 보증금은 언제까지 입금해요?', '신청 후 30분 안에 입금해 주세요. 입금이 확인되지 않으면 신청이 자동 취소돼요. 보증금은 특강 당일 현장에서 100% 돌려드려요.', true,
       coalesce((select max(sort_order) from public.faq_items where category = '🎤 특강'), (select max(sort_order) from public.faq_items), 0) + 1
where not exists (select 1 from public.faq_items where question = '현장 보증금은 언제까지 입금해요?');

insert into public.faq_items (category, question, answer, published, sort_order)
select '🎤 특강', '특강 신청은 언제까지 해요?', '특강마다 마감 시간이 달라요. 첫 화면 ''특강 신청''의 빨간 마감 표시를 확인해 주세요.', true,
       coalesce((select max(sort_order) from public.faq_items where category = '🎤 특강'), (select max(sort_order) from public.faq_items), 0) + 1
where not exists (select 1 from public.faq_items where question = '특강 신청은 언제까지 해요?');

insert into public.faq_items (category, question, answer, published, sort_order)
select '📝 데일리 테스트', '오늘의 테스트는 어디서 내요?', '문풀반·속성반은 강의실의 ''📝 오늘의 테스트''에 맞은 개수를 적어 내요. 틀린 번호는 선택이에요. 그날 23:59까지 고칠 수 있어요.', true,
       coalesce((select max(sort_order) from public.faq_items where category = '📝 데일리 테스트'), (select max(sort_order) from public.faq_items), 0) + 1
where not exists (select 1 from public.faq_items where question = '오늘의 테스트는 어디서 내요?');

insert into public.faq_items (category, question, answer, published, sort_order)
select '📝 데일리 테스트', '결석하는 날 테스트는 어떻게 해요?', '''⏩ 다음 수업 테스트 미리 내기''에서 먼저 낼 수 있어요. 못 낸 테스트는 ''⏰ 밀린 테스트''에서 낼 수 있어요.', true,
       coalesce((select max(sort_order) from public.faq_items where category = '📝 데일리 테스트'), (select max(sort_order) from public.faq_items), 0) + 1
where not exists (select 1 from public.faq_items where question = '결석하는 날 테스트는 어떻게 해요?');

insert into public.faq_items (category, question, answer, published, sort_order)
select '📝 데일리 테스트', '다른 학생 점수도 보이나요?', '아니요. 본인 점수와 그래프만 보여요.', true,
       coalesce((select max(sort_order) from public.faq_items where category = '📝 데일리 테스트'), (select max(sort_order) from public.faq_items), 0) + 1
where not exists (select 1 from public.faq_items where question = '다른 학생 점수도 보이나요?');

commit;

notify pgrst, 'reload schema';
