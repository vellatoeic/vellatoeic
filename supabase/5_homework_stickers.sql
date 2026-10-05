-- 3단계: 사진 없이 숙제 제출 스티커 저장
-- 기존 사진 기록은 그대로 남고, 새 별 스티커는 사진 없이 저장할 수 있어요.

alter table homework
  alter column photo_path drop not null;
