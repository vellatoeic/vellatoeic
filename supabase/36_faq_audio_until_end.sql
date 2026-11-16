-- FAQ 'LC 음원은 어디서 받나요?' 답을 '종강일까지'로 바꿔요. 여러 번 실행해도 안전해요.
-- 질문 문구가 정확히 같은 행만 바꾸고, 다른 FAQ는 그대로예요.

-- 먼저 확인: 바뀔 행 (1개여야 해요)
select id, question, answer from public.faq_items where question = 'LC 음원은 어디서 받나요?';

begin;

-- 🔴 답 문구 수정 (예전: 개강 후 2주 동안만 열려요)
update public.faq_items
set answer = '강의실 🎧 LC 음원에서 종강일까지 받을 수 있어요. 미리 다운받아 두세요!'
where question = 'LC 음원은 어디서 받나요?';

commit;

notify pgrst, 'reload schema';

-- 확인: 바뀐 답
select question, answer from public.faq_items where question = 'LC 음원은 어디서 받나요?';
