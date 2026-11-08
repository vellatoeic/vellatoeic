-- 11월 스터디 공지(이번 달) + 12월부터 매달 반복 공지. insert만, 여러 번 실행해도 안전.
begin;

-- ① 11월 · 현장
insert into public.site_notices (title, to_label, lead, sections, link_label, link_url, targets, starts_on, ends_on, popup, pinned, created_at)
select '📚 11/9(월)부터 문풀반 스터디 시작! (802호)', '문풀반 · 현장 수강생 안내',
  '**11/9(월) 수업부터 스터디를 진행해요.** 스터디룸이 **802호**로 바뀌었어요!' || chr(10) || '아래 내용 확인하고 미리 준비해 주세요 :)',
  '[
    {"icon":"🕘","title":"언제 · 어디서","body":"**수업 30분 전, 802호**로 입실해 주세요 (704호 아니에요!)"},
    {"icon":"✏️","title":"스터디 방법","body":"PART 5 숙제 **1~30번 답 단서**를 한 사람씩 돌아가며 설명해요\n+ 접·주·동 / 전치사 문장 성분 보기 연습"},
    {"icon":"❓","title":"막힌 문제는","body":"조원 모두 설명이 어렵거나 풀이가 엇갈린 문제는 **조장이 숙제 게시글에 문제 번호**를 적어 주세요"},
    {"icon":"✅","title":"스터디 인증","body":"네이버 카페 **''문풀반 스터디 인증''** 게시판에 인증 글을 남기면 **스터디 완료!**"},
    {"icon":"💻","title":"현장 참여가 어려운 날","body":"숙제 후 1~30번 답 단서를 적고, 헷갈린 문제 번호를 숙제 게시글 댓글로 남겨 주세요","gray":true}
  ]'::jsonb,
  '✅ 인증하러 가기', '@study',
  '[{"courses":["solve"],"tracks":["all","rc"],"kinds":["onsite"]},{"courses":["intensive"],"kinds":["onsite"],"slots":["pm"]}]'::jsonb,
  date '2026-11-09', date '2026-11-26', true, true, now()
where not exists (select 1 from public.site_notices where title = '📚 11/9(월)부터 문풀반 스터디 시작! (802호)');

-- ② 11월 · 온라인 참여
insert into public.site_notices (title, to_label, lead, sections, link_label, link_url, targets, starts_on, ends_on, popup, pinned, created_at)
select '📚 11/9(월)부터 스터디 시작! (온라인 참여)', '실전속성반 오전 · 불라방 수강생 안내',
  '**11/9(월) 수업부터 스터디를 진행해요.**' || chr(10) || '아래 방법으로 미리 준비해 주세요 :)',
  '[
    {"icon":"✏️","title":"스터디 방법","body":"숙제를 마친 뒤 PART 5 **1~30번의 답 단서**를 적어 주세요"},
    {"icon":"❓","title":"헷갈린 문제는","body":"문제 번호를 **숙제 게시글 아래 댓글**로 남겨 주세요"},
    {"icon":"✅","title":"스터디 인증","body":"네이버 카페 **''문풀반 스터디 인증''** 게시판에 인증 글을 남기면 **스터디 완료!**"}
  ]'::jsonb,
  '✅ 인증하러 가기', '@study',
  '[{"courses":["solve"],"tracks":["all","rc"],"kinds":["online"]},{"courses":["intensive"],"slots":["am"]},{"courses":["intensive"],"kinds":["online"],"slots":["pm"]}]'::jsonb,
  date '2026-11-09', date '2026-11-26', true, true, now() + interval '1 second'
where not exists (select 1 from public.site_notices where title = '📚 11/9(월)부터 스터디 시작! (온라인 참여)');

-- ③ 12월부터 매달 반복 · 현장 (학생 개강일부터 25일 동안)
insert into public.site_notices (title, to_label, lead, sections, link_label, link_url, targets, starts_on, ends_on, popup, pinned, created_at, repeat_monthly, repeat_days)
select '📚 이번 달도 문풀반 스터디 함께해요! (802호)', '문풀반 · 현장 수강생 안내',
  '이번 달도 **수업 30분 전 802호**에서 스터디를 진행해요.' || chr(10) || '아래 내용 확인하고 미리 준비해 주세요 :)',
  '[
    {"icon":"🕘","title":"언제 · 어디서","body":"**수업 30분 전, 802호**로 입실해 주세요"},
    {"icon":"✏️","title":"스터디 방법","body":"PART 5 숙제 **1~30번 답 단서**를 한 사람씩 돌아가며 설명해요\n+ 접·주·동 / 전치사 문장 성분 보기 연습"},
    {"icon":"❓","title":"막힌 문제는","body":"조원 모두 설명이 어렵거나 풀이가 엇갈린 문제는 **조장이 숙제 게시글에 문제 번호**를 적어 주세요"},
    {"icon":"✅","title":"스터디 인증","body":"네이버 카페 **''문풀반 스터디 인증''** 게시판에 인증 글을 남기면 **스터디 완료!**"},
    {"icon":"💻","title":"현장 참여가 어려운 날","body":"숙제 후 1~30번 답 단서를 적고, 헷갈린 문제 번호를 숙제 게시글 댓글로 남겨 주세요","gray":true}
  ]'::jsonb,
  '✅ 인증하러 가기', '@study',
  '[{"courses":["solve"],"tracks":["all","rc"],"kinds":["onsite"]},{"courses":["intensive"],"kinds":["onsite"],"slots":["pm"]}]'::jsonb,
  date '2026-12-01', date '2099-12-31', true, false, now() + interval '2 second', true, 25
where not exists (select 1 from public.site_notices where title = '📚 이번 달도 문풀반 스터디 함께해요! (802호)');

-- ④ 12월부터 매달 반복 · 온라인 참여
insert into public.site_notices (title, to_label, lead, sections, link_label, link_url, targets, starts_on, ends_on, popup, pinned, created_at, repeat_monthly, repeat_days)
select '📚 이번 달도 스터디 함께해요! (온라인 참여)', '실전속성반 오전 · 불라방 수강생 안내',
  '이번 달도 스터디를 진행해요.' || chr(10) || '아래 방법으로 미리 준비해 주세요 :)',
  '[
    {"icon":"✏️","title":"스터디 방법","body":"숙제를 마친 뒤 PART 5 **1~30번의 답 단서**를 적어 주세요"},
    {"icon":"❓","title":"헷갈린 문제는","body":"문제 번호를 **숙제 게시글 아래 댓글**로 남겨 주세요"},
    {"icon":"✅","title":"스터디 인증","body":"네이버 카페 **''문풀반 스터디 인증''** 게시판에 인증 글을 남기면 **스터디 완료!**"}
  ]'::jsonb,
  '✅ 인증하러 가기', '@study',
  '[{"courses":["solve"],"tracks":["all","rc"],"kinds":["online"]},{"courses":["intensive"],"slots":["am"]},{"courses":["intensive"],"kinds":["online"],"slots":["pm"]}]'::jsonb,
  date '2026-12-01', date '2099-12-31', true, false, now() + interval '3 second', true, 25
where not exists (select 1 from public.site_notices where title = '📚 이번 달도 스터디 함께해요! (온라인 참여)');

commit;
notify pgrst, 'reload schema';
