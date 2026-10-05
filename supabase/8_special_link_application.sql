-- 특강 신청을 수강 신청(강의실 계정)과 연결해요. (여러 번 실행해도 안전해요)
-- 특강 비밀번호를 따로 두지 않고 강의실 비밀번호 하나로 확인해요. 연락처도 더 받지 않아요.
-- 기존 데이터는 지우거나 바꾸지 않아요. (연결 전에 만든 신청은 관리자 명단에만 보여요.)

begin;

alter table public.special_lecture_registrations
  add column if not exists application_id uuid references public.applications(id) on delete cascade;

-- 특강 전용 비밀번호를 더 이상 저장하지 않아요.
alter table public.special_lecture_registrations alter column pin_hash drop not null;

create index if not exists special_registrations_application_idx on public.special_lecture_registrations (application_id);

commit;

notify pgrst, 'reload schema';
