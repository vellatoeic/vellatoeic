-- 학생 명단용 기록: 카카오·구글 프로필 사진(login_links.photo_url)과 학생별 마지막 로그인·접속(student_profiles)에 빈 칸만 추가해요. 여러 번 실행해도 안전해요.
-- 기존 데이터는 지우거나 바꾸지 않아요. 다음 로그인·접속부터 채워져요.

begin;

alter table public.login_links add column if not exists photo_url text;

alter table public.student_profiles add column if not exists last_login_at timestamptz;
alter table public.student_profiles add column if not exists last_login_via text;
alter table public.student_profiles add column if not exists last_seen_at timestamptz;

commit;

notify pgrst, 'reload schema';

-- 확인: 새 칸 (모두 비어 있음)
select
  (select count(*) from public.login_links) as login_links,
  (select count(*) from public.login_links where photo_url is not null) as with_photo,
  (select count(*) from public.student_profiles) as profiles,
  (select count(*) from public.student_profiles where last_seen_at is not null) as with_seen;
