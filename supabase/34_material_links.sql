-- LC 음원·특강 자료를 '제목 + 링크(구글 드라이브 공유 링크)'로 등록해요. (Supabase 보관함 전송량 줄이기)
-- 예전 파일 방식 기록은 그대로 두고, 링크 칸만 추가해요. 데이터는 바꾸지 않아요.
-- 여러 번 실행해도 안전해요.

begin;

-- 1) LC 음원: 링크 칸 추가, 파일 경로는 비워둘 수 있게 (링크 방식은 파일이 없어요)
alter table public.lc_audios add column if not exists link_url text;
alter table public.lc_audios alter column storage_path drop not null;

-- 2) 특강 자료: 링크 칸 추가, 파일 경로는 비워둘 수 있게
alter table public.special_lecture_materials add column if not exists link_url text;
alter table public.special_lecture_materials alter column storage_path drop not null;

commit;

notify pgrst, 'reload schema';
