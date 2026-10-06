-- 강의에 오전반/저녁반 구분을 추가해요. (여러 번 실행해도 안전해요)
-- 기존 강의는 지우거나 바꾸지 않아요. 이미 올린 강의는 구분이 비어 있고, [강의 관리] → 수정에서 정할 수 있어요.

begin;

alter table public.lectures
  add column if not exists slot text check (slot in ('am', 'pm'));

commit;

notify pgrst, 'reload schema';
