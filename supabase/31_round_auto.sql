-- 교재 회차 완전 자동(홀수달 1회차, 짝수달 2회차): 예전 회차 덮어쓰기 값 지우기. 여러 번 실행해도 안전해요.

begin;

-- 🔴 settings에서 이름이 'round_'로 시작하는 행만 지워요 (다른 설정은 그대로)
delete from public.settings where key like 'round\_%' escape '\';

commit;

notify pgrst, 'reload schema';
