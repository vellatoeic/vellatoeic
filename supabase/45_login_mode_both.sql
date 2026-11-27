-- 학생 로그인 방식 '카카오·구글만'(social) → '둘 다'(both): 새 사이트 배포(2026-11-27)부터 임시로 예전처럼 이름 + 비밀번호로 들어오고, 들어온 뒤 카카오·구글을 연결해요.
-- settings 한 줄만 바꿔요. 관리 첫 화면 '학생 로그인 방식'에서 언제든 다시 바꿀 수 있어요.

update public.settings set value = 'both' where key = 'login_mode';

select key, value from public.settings where key = 'login_mode';
