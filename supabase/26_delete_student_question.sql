-- 지난 질문함의 학생 질문 1개 삭제. 여러 번 실행해도 안전해요.
-- 질문이 정확히 1개일 때만 지워요. 1개가 아니면 아무것도 지우지 않고 안내만 보여줘요.
-- (질문 표 자체와 FAQ 항목은 그대로예요)

do $$
declare n integer;
begin
  select count(*) into n from public.student_questions;
  if n = 1 then
    delete from public.student_questions;
    raise notice '학생 질문 1개를 삭제했어요.';
  elsif n = 0 then
    raise notice '지울 질문이 없어요 (이미 지워졌어요).';
  else
    raise notice '질문이 %개라 지우지 않았어요. Claude에게 알려 주세요.', n;
  end if;
end $$;
