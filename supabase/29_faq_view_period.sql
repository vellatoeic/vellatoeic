-- FAQ 열람 기간 문구를 '종강일까지'로 맞춰요. 여러 번 실행해도 안전해요.
-- 질문 문구가 정확히 같은 행만 바꾸고, 다른 FAQ는 그대로예요.

begin;

-- 🔴 '지난 특강 다시 볼 수 있나요?' 답: 그달 말일까지 → 종강일까지
update public.faq_items
set answer = '신청한 학생은 특강 페이지에서 종강일까지 ''📺 특강 다시 보기''로 볼 수 있어요. 현장 신청은 보증금이 확인된 경우만 열려요.'
where question = '지난 특강 다시 볼 수 있나요?';

-- 🔴 '라이브를 놓쳤어요.' 답: '종강일까지'가 없을 때만 바꿔요
update public.faq_items
set answer = '강의실의 ''지난 강의''에서 다시 볼 수 있어요. 종강일까지 볼 수 있어요.'
where question = '라이브를 놓쳤어요.' and answer not like '%종강일까지%';

commit;

notify pgrst, 'reload schema';
