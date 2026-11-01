-- 교재 직접 수정 표시 칸. 여러 번 실행해도 안전해요. 기존 신청은 모두 '조정 안 함'(false)이에요.

begin;

alter table public.applications add column if not exists books_adjusted boolean not null default false;

commit;

notify pgrst, 'reload schema';
