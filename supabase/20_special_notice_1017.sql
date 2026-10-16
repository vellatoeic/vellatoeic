-- 10/17(토) 특강 마감 안내 공지 팝업 (대상 전체, 10/16~10/17 게시, 팝업·상단 고정)
-- insert만 해요. 같은 제목 공지가 있으면 다시 넣지 않아요(여러 번 실행해도 안전).

insert into public.site_notices (title, to_label, lead, sections, link_label, link_url, targets, starts_on, ends_on, popup, pinned, created_at)
select '🎤 내일 10/17(토) 특강 · 오늘 17시 신청 마감!',
       '',
       '내일 특강 신청이 **오늘 오후 5시에 마감**돼요. 아직 신청 안 했다면 지금 바로 신청해 주세요 :)',
       '[
         {"icon":"⏰","title":"신청 마감","body":"**오늘 10/16(금) 17:00까지**"},
         {"icon":"🏫","title":"현장 참여","body":"보증금 1만 원을 입금하면 신청이 완료돼요. 참석하면 현장에서 100% 돌려드려요. 특강 당일 **10시까지 필기구를 챙겨 703호**로 와 주세요."},
         {"icon":"💻","title":"불라방 참여","body":"특강 시작 전에 특강 페이지에 자료와 유튜브 링크가 올라와요."}
       ]'::jsonb,
       '🎤 특강 신청하러 가기', 'https://vellatoeic.vercel.app/special',
       '[]'::jsonb,
       date '2026-10-16', date '2026-10-17', true, true, now()
where not exists (select 1 from public.site_notices where title = '🎤 내일 10/17(토) 특강 · 오늘 17시 신청 마감!');
