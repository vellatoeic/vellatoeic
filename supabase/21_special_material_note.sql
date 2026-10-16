-- 특강 자료 안내 문구 칸 추가 + 10/17(토) 특강 문구 입력. 여러 번 실행해도 안전해요.

begin;

alter table public.special_lectures add column if not exists material_note text;

-- 10/17 특강에 문구가 아직 비어 있을 때만 넣어요 (다른 특강·이미 쓴 문구는 건드리지 않음)
update public.special_lectures
set material_note = '벨라토익 특강 자료입니다' || chr(10) ||
                    '자료 다운 받은 후 내일 업로드 될 특강 링크로 참여해주세요' || chr(10) ||
                    chr(10) ||
                    '일주일 수고 많았어요, 모두 편안한 밤 보내요🌙' || chr(10) ||
                    '(벨라토익의 소중한 자료입니다 무단 배포 금지!)'
where event_date = date '2026-10-17' and material_note is null;

commit;

notify pgrst, 'reload schema';
