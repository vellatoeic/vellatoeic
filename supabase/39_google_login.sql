-- 구글 로그인 회원(members)과 수강 신청 연결(member_links) 표 추가 (2026-11-25, 기존 표·데이터는 그대로)
-- 회원: 구글 계정 하나당 한 줄 (provider='google', provider_id = 구글 계정 고유번호 sub)
-- 연결: 회원 ↔ 수강 신청. 처음 한 번 신청서의 이름 + 강의실 비밀번호로 연결하거나, 로그인한 채 신청서를 내면 자동 연결돼요.
-- 신청이 지워져도(30분 미입금 자동 삭제 등) 막히지 않게 신청 표와는 외래키를 걸지 않아요 (없는 신청 연결은 화면에서 무시).
-- 서버(service_role)에서만 읽고 써요: RLS 켜고 정책 없음 (학생 브라우저에서 직접 조회 불가)

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_id text not null,
  email text,
  name text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint members_provider_unique unique (provider, provider_id)
);

create table if not exists public.member_links (
  member_id uuid not null,
  application_id uuid not null,
  created_at timestamptz not null default now(),
  constraint member_links_pkey primary key (member_id, application_id)
);

create index if not exists member_links_application_idx on public.member_links (application_id);

alter table public.members enable row level security;
alter table public.member_links enable row level security;

select 'members' as 표, count(*) as 행 from public.members
union all
select 'member_links', count(*) from public.member_links;
