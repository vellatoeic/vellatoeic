-- 수강증 자동 확인: 읽은 기록 표(receipt_checks) · 신청서의 수강증 상태 칸(applications.receipt_status) · 비공개 사진 보관함(receipts) 추가
-- 새 표·새 칸·새 보관함만 만들어요. 기존 신청·데이터는 지우거나 바꾸지 않아요(예전 신청의 수강증 상태는 비어 있는 채로 둬요). 여러 번 실행해도 안전해요.

begin;

-- 1) 수강증 읽은 기록 (신청서에 연결되기 전에도 남아요. 연결 안 된 기록은 하루 뒤, 사진은 확인 7일 뒤 자동으로 지워요)
create table if not exists public.receipt_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- 신청서 (제출하면 연결돼요)
  application_id uuid references public.applications(id) on delete set null,
  -- read = 읽기만 함(제출 전) · auto = 자동 확인 · review = 선생님 확인 필요 · approved = 선생님 확인 완료
  status text not null default 'read' check (status in ('read', 'auto', 'review', 'approved')),
  -- 읽을 때 판정: match = 반을 딱 하나 찾음 · review = 애매함 · reject = 다른 화면·지난 과정 · skipped = 글자 읽기를 안 함(꺼짐·한도)
  outcome text not null check (outcome in ('match', 'review', 'reject', 'skipped')),
  -- 읽을 때 신청받던 달 · 찾은 반 [{cohort, course, track, slot}] · 수강증의 현장/불라방
  cohorts text[] not null default '{}',
  classes jsonb not null default '[]'::jsonb,
  kind text check (kind in ('onsite', 'online')),
  -- 수강생 칸 이름 · 수강증 화면의 현재시간(초까지) · 사진 지문(같은 파일 찾기)
  receipt_name text,
  captured_at text,
  image_hash text,
  -- 읽은 값(레벨·종합/단과·요일·시간·수강월·경고)과 선생님 확인 까닭
  reading jsonb not null default '{}'::jsonb,
  reasons text[] not null default '{}',
  -- 이름 확인용 원문 (확인이 끝나면 사진과 함께 지워요)
  ocr_text text,
  ocr_ms integer,
  -- 확인이 필요할 때만 저장하는 줄인 사진 (receipts 보관함 경로)
  image_path text,
  image_bytes integer,
  image_deleted_at timestamptz,
  decided_at timestamptz
);
create index if not exists receipt_checks_application_idx on public.receipt_checks (application_id);
create index if not exists receipt_checks_status_idx on public.receipt_checks (status, created_at);
create index if not exists receipt_checks_hash_idx on public.receipt_checks (image_hash);
create index if not exists receipt_checks_captured_idx on public.receipt_checks (captured_at);

-- 다른 표와 같이: 학생 브라우저에서 직접 못 읽고 서버(service_role)만 써요
alter table public.receipt_checks enable row level security;
grant select, insert, update, delete on public.receipt_checks to service_role;

-- 2) 신청서의 수강증 상태 (비어 있음 = 수강증 없이 받은 예전 신청 · auto · review · approved)
alter table public.applications add column if not exists receipt_status text;

-- 3) 수강증 사진 비공개 보관함 (확인이 필요할 때만 줄인 사진을 저장, 파일당 2MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

commit;

notify pgrst, 'reload schema';

-- 확인: 새 표·칸·보관함 (기존 신청 수는 그대로, 수강증 상태는 모두 비어 있어요)
select
  (select count(*) from public.applications) as applications,
  (select count(*) from public.applications where receipt_status is not null) as with_receipt,
  (select count(*) from public.receipt_checks) as receipt_checks,
  (select count(*) from storage.buckets where id = 'receipts' and public = false) as private_bucket;
