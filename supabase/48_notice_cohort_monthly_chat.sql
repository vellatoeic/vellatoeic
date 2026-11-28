-- 공지 '대상 수강 월'(site_notices.cohort, 비우면 모든 달) + 단톡방을 달마다 따로(지금 단톡방 = 11월 방 → chat_url:2026-11)
-- 2026-11-28 Vella: "매달 단톡방은 새로 개설돼요 · 신규생들에게 전 달 공지는 보일 필요가 없어요"
-- 지우는 것 없음. 예전 chat_url·chat_code는 그대로 둬요(지금 운영 코드가 읽어요).

alter table public.site_notices add column if not exists cohort text;

-- 지금 저장된 단톡방(참여코드 1102, 2026-10-30에 바꿈)은 11월 수강생 방이에요
insert into public.settings (key, value)
select 'chat_url:2026-11', value from public.settings where key = 'chat_url' and value <> ''
on conflict (key) do nothing;
insert into public.settings (key, value)
select 'chat_code:2026-11', value from public.settings where key = 'chat_code' and value <> ''
on conflict (key) do nothing;

select key, length(value) as len from public.settings where key like 'chat_url:%' or key like 'chat_code:%' order by key;
select count(*) as notices, count(cohort) as with_cohort from public.site_notices;
