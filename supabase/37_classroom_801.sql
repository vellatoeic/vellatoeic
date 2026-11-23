-- 현장 강의실 703호 → 801호: FAQ·공지 글에 들어간 '703호'를 '801호'로 바꿔요.
-- '703호'가 들어간 행만 바뀌고, 다른 글자는 그대로예요. 스터디룸 802호 문구는 건드리지 않아요.
-- 여러 번 실행해도 안전해요 (두 번째부터는 바뀔 행이 0개).

-- ─────────────────────────────────────────────
-- ⓪ 먼저 확인: 바뀔 행 개수 (이 select 한 덩어리만 드래그해서 Run 하면 숫자만 보여요)
-- ─────────────────────────────────────────────
select
  (select count(*) from public.faq_items where question like '%703호%' or answer like '%703호%') as "FAQ (질문·답)",
  (select count(*) from public.site_notices where title like '%703호%' or lead like '%703호%' or sections::text like '%703호%') as "공지 (제목·첫 문장·섹션)",
  -- 참고(이 SQL은 바꾸지 않아요): 0이 아니면 관리 화면에서 직접 고쳐 주세요
  (select count(*) from public.site_notices where to_label like '%703호%' or coalesce(link_label, '') like '%703호%') as "참고: 공지 대상 문구·버튼",
  (select count(*) from public.special_lectures where title like '%703호%' or coalesce(material_note, '') like '%703호%') as "참고: 특강 제목·자료 안내";

begin;

-- 🔴 FAQ: 질문·답의 '703호' → '801호'
update public.faq_items
set question = replace(question, '703호', '801호'),
    answer = replace(answer, '703호', '801호')
where question like '%703호%' or answer like '%703호%';

-- 🔴 공지: 제목·첫 문장·섹션(아이콘·소제목·내용)의 '703호' → '801호'
update public.site_notices
set title = replace(title, '703호', '801호'),
    lead = replace(lead, '703호', '801호'),
    sections = replace(sections::text, '703호', '801호')::jsonb
where title like '%703호%' or lead like '%703호%' or sections::text like '%703호%';

commit;

notify pgrst, 'reload schema';

-- ② 확인: 남은 '703호' (모두 0이면 끝)
select
  (select count(*) from public.faq_items where question like '%703호%' or answer like '%703호%') as "남은 FAQ",
  (select count(*) from public.site_notices where title like '%703호%' or lead like '%703호%' or sections::text like '%703호%') as "남은 공지";
