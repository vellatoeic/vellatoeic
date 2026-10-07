-- 환불 상태 + 자주 묻는 질문(FAQ) + 질문함. 여러 번 실행해도 안전해요.

begin;

-- 1) 납부 상태에 '환불(refunded)'을 추가해요.
--    기존 상태 제약(pending/paid/shipped)을 지우고 refunded를 포함해 다시 만들어요. 신청 데이터는 그대로예요.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.applications'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.applications drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.applications add constraint applications_status_check
  check (status in ('pending', 'paid', 'shipped', 'refunded'));

-- 2) 자주 묻는 질문
create table if not exists public.faq_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  answer text not null default '',
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists faq_items_order_idx on public.faq_items (sort_order);

-- 3) 질문함 (로그인한 학생이 실명으로 남겨요)
create table if not exists public.student_questions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references public.applications(id) on delete set null,
  name text not null,
  kind text not null check (kind in ('question', 'suggestion')),
  content text not null,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists student_questions_created_idx on public.student_questions (created_at desc);

alter table public.faq_items enable row level security;
alter table public.student_questions enable row level security;
grant select, insert, update, delete on public.faq_items, public.student_questions to service_role;

-- 4) FAQ 첫 데이터. FAQ 표가 비어 있을 때만 넣어요(다시 실행해도 중복되지 않아요).
insert into public.faq_items (category, question, answer, published, sort_order)
select v.category, v.question, v.answer, v.published, v.sort_order
from (values
  ('📚 수강 신청·교재비', '교재비는 꼭 내야 하나요?', '네. 수업은 강사님 자체 교재로 진행돼요. 교재비 납부가 확인되면 강의실이 열려요.', true, 10),
  ('📚 수강 신청·교재비', '제가 어떤 교재를 사야 하는지 모르겠어요.', '수강하는 반만 고르면 필요한 교재와 금액이 자동으로 계산돼요.', true, 20),
  ('📚 수강 신청·교재비', '교재비는 얼마인가요?', '교재 1권당 1만 원이에요. 시작반 종합 3만 원(개념집+시작반 RC+LC), 시작반 RC 단과 2만 원(개념집+RC), 시작반 LC 단과 1만 원, 문풀반 종합 2만 원(RC+LC), 문풀반 RC 또는 LC 단과 1만 원. 택배 수령은 4,000원이 추가돼요.', true, 30),
  ('📚 수강 신청·교재비', '지난달에 이어서 들어요. 교재를 다시 사야 하나요?', '시작반 격일반을 이어 듣는 경우에는 LC 교재만 새로 사면 돼요. 문풀반은 매달 교재가 바뀌어서 모두 새로 구매해요.', true, 40),
  ('📚 수강 신청·교재비', '입금했는데 ''입금 확인 중''으로 나와요.', '입금 확인은 하루에 몇 번 모아서 처리해요. 신청할 때 적은 입금자명과 실제 입금자명이 같은지 확인해 주세요.', true, 50),
  ('📚 수강 신청·교재비', '다른 이름으로 입금했어요.', 'Vella쌤에게 실제 입금자명을 알려 주세요.', true, 60),
  ('📚 수강 신청·교재비', '반을 잘못 골랐어요.', 'Vella쌤에게 알려 주시면 바로 바꿔 드려요. 금액도 자동으로 다시 계산돼요.', true, 70),
  ('📦 불라방 교재 수령 안내', '현장 수강생은 교재를 어디서 받나요?', '첫 수업 날 703호에서 한꺼번에 나눠 드려요. 수업 시간에 맞춰 와 주세요.', true, 110),
  ('📦 불라방 교재 수령 안내', '불라방 수강생은 교재를 어떻게 받나요?', '1층 데스크에서 받거나, 택배(+4,000원) 중에서 고를 수 있어요.', true, 120),
  ('📦 불라방 교재 수령 안내', '택배는 언제 와요?', '납부가 확인되면 순차적으로 배송됩니다.', true, 130),
  ('☁️ 강의실·로그인', '강의실 비밀번호를 잊어버렸어요.', 'Vella쌤에게 문의하면 새 비밀번호로 바꿔 드려요.', true, 210),
  ('☁️ 강의실·로그인', '강의실에 강의가 안 보여요.', '납부 확인 전이거나 아직 개강 전일 수 있어요. 본인이 신청한 반의 강의만 보여요.', true, 220),
  ('☁️ 강의실·로그인', '오전반인데 저녁반 강의도 볼 수 있나요?', '가능해요. 동일한 수업 교차 수강 가능합니다.', true, 230),
  ('☁️ 강의실·로그인', '홈페이지를 매번 찾기 번거로워요.', '홈 화면에 추가해 두면 앱처럼 쓸 수 있어요. 아이폰: 사파리 공유 버튼 → 홈 화면에 추가 / 갤럭시: 오른쪽 위 ⋮ → 홈 화면에 추가', true, 240),
  ('📺 불라방·라이브', '라이브 수업은 어디서 들어요?', '강의실 맨 위의 🔴 라이브 입장 버튼을 누르면 돼요. 수업 10분 전부터 열려요.', true, 310),
  ('📺 불라방·라이브', '라이브를 놓쳤어요.', '강의실의 ''지난 강의''에서 다시 볼 수 있어요. 종강일까지 볼 수 있어요.', true, 320),
  ('✅ 출석·숙제·스티커', '출석은 어떻게 해요?', '수업 화면의 QR을 휴대폰 카메라로 찍으면 돼요.', true, 410),
  ('✅ 출석·숙제·스티커', '출석이 잘못 찍혔어요.', 'Vella쌤에게 알려 주시면 고쳐 드려요.', true, 420),
  ('✅ 출석·숙제·스티커', '숙제는 어디에 내요?', '강의실 스티커판 달력에서 수업 날짜를 누르고 ''숙제 확인''을 눌러 네이버 카페에 올린 뒤, ''카페에 올렸어요 ✓ 별 받기''를 누르면 별 스티커가 붙어요.', true, 430),
  ('✅ 출석·숙제·스티커', '스티커판은 어디서 봐요?', '강의실에서 이번 달 출석과 숙제 스티커를 볼 수 있어요. 다 모은 스티커판은 이미지로 저장할 수 있어요.', true, 440),
  ('🎧 LC 음원', 'LC 음원은 어디서 받나요?', '강의실의 ''LC 음원''에서 받을 수 있어요. 수업 내 공지된 바와 같이 개강 후 2주 동안만 열리니 미리 다운 받아 주세요!', true, 510),
  ('🎧 LC 음원', '2주가 지나서 못 받았어요.', 'Vella쌤께 문의 부탁드려요.', true, 520),
  ('🎤 특강', '특강은 어떻게 신청해요?', '첫 화면의 ''특강 신청''에서 현장 또는 불라방을 골라 신청하면 돼요.', true, 610),
  ('🎤 특강', '현장 특강은 언제까지 가면 돼요?', '특강 당일 10시까지 필기구를 챙겨 703호로 와 주세요.', true, 620),
  ('🎤 특강', '불라방 특강은 어떻게 들어요?', '특강 시작 전에 특강 페이지에 자료와 유튜브 링크가 올라와요.', true, 630)
) as v(category, question, answer, published, sort_order)
where not exists (select 1 from public.faq_items);

commit;

notify pgrst, 'reload schema';
