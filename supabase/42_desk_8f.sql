-- 불라방 현장 수령 장소 1층 데스크 → 8층 데스크: 자주 묻는 질문(faq_items) 문구만 바꿔요 (2026-11-26, 신청·납부 데이터는 그대로)
-- 코드 쪽 문구는 lib/config.ts DESK 한곳이에요. 이 SQL은 DB에 저장된 FAQ 글만 고쳐요. 여러 번 실행해도 안전해요(이미 바뀐 글은 그대로).
-- 운영 DB를 같이 쓰기 때문에 실행하는 순간 지금 사이트 FAQ에도 바로 보여요 → 8층으로 바뀌는 날(배포일)에 실행해요.

update public.faq_items
set answer = replace(answer, '1층 데스크', '8층 데스크')
where answer like '%1층 데스크%';

update public.faq_items
set question = replace(question, '1층 데스크', '8층 데스크')
where question like '%1층 데스크%';

select question, answer from public.faq_items where answer like '%8층 데스크%' or question like '%8층 데스크%';
