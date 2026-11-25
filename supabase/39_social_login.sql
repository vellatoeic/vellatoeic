-- 구글·카카오 로그인 연결: 새 표(login_links)와 신청서의 학생 번호 칸(applications.account_id)만 추가해요. 여러 번 실행해도 안전해요.
-- 기존 신청·데이터는 지우거나 바꾸지 않아요. 새 칸은 모두 비어 있는 채로 시작해요(학생이 연결할 때 채워져요).

begin;

-- 신청서: 구글·카카오로 묶인 학생 번호 (연결 전 신청은 비어 있어요)
alter table public.applications add column if not exists account_id uuid;
create index if not exists applications_account_id_idx on public.applications (account_id);

-- 로그인 연결: 구글(sub) · 카카오(회원번호) → 학생 번호
create table if not exists public.login_links (
  provider text not null check (provider in ('google', 'kakao')),
  subject text not null,
  account_id uuid not null,
  email text,
  nickname text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  primary key (provider, subject)
);
create index if not exists login_links_account_id_idx on public.login_links (account_id);

-- 다른 표와 같이: 학생 브라우저에서 직접 못 읽고 서버(service_role)만 써요
alter table public.login_links enable row level security;
grant select, insert, update, delete on public.login_links to service_role;

commit;

notify pgrst, 'reload schema';

-- 확인: 새 칸·표 (연결 0건, 신청 수는 그대로)
select
  (select count(*) from public.applications) as applications,
  (select count(*) from public.applications where account_id is not null) as linked_applications,
  (select count(*) from public.login_links) as login_links;
