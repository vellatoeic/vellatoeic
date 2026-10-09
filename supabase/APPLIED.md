# Supabase SQL 실행 기록

Vella가 Supabase SQL Editor에서 실행했다고 확인한 SQL 파일만 기록해요.
새 작업을 시작하기 전에 이 목록과 `supabase/*.sql`을 대조해 실행 여부가 빠진 파일이 없는지 확인해요.

| 파일 | 실행 확인 | 내용 |
| --- | --- | --- |
| `3_course_books.sql` | 완료 | 과정·격일반·이어듣기 필드 및 교재 데이터 개편 |
| `2_stamps.sql` | 완료 | `4_attendance_late.sql`, `5_homework_stickers.sql`과 함께 실행. 출석·숙제 표 생성 |
| `4_attendance_late.sql` | 완료 | `2_stamps.sql`, `5_homework_stickers.sql`과 함께 실행. 출석 지각 열 추가 |
| `5_homework_stickers.sql` | 완료 | `2_stamps.sql`, `4_attendance_late.sql`과 함께 실행. 숙제 사진 경로를 비워둘 수 있게 변경 |
| `6_repair_runtime_schema.sql` | 완료 | 실행본에서는 Storage 권한 두 줄을 제외하고 마지막에 `notify pgrst, 'reload schema';`를 추가해 실행 |
| `7_special_lectures.sql` | 완료 | 특강 일정·신청 명단·자료 표와 비공개 자료 보관함 생성, 10월 특강 2회 기본값 입력 |
| `8_special_link_application.sql` | 완료 | 특강 신청에 수강 신청 연결 열(application_id) 추가, 특강 전용 비밀번호 열을 비워둘 수 있게 변경 |
| `9_application_slot.sql` | 완료 | 수강 신청에 수강 시간 열(slot: am/pm) 추가 |
| `10_student_missions.sql` | 완료 | 첫 수업 미션 기록 표(student_missions) 생성 |
| `11_lc_audio.sql` | 완료 | LC 교재(lc1/lc2)별 음원 zip 목록 표(lc_audios)와 비공개 보관함(lc-audio) 생성 |
| `12_lecture_slot.sql` | 완료 | 강의에 오전반/저녁반 구분 열(slot: am/pm) 추가 |
| `13_refund_faq.sql` | 완료 | 납부 상태에 환불(refunded) 추가(상태 제약 교체), FAQ 표(faq_items)·질문함 표(student_questions) 생성, FAQ 첫 데이터 25개 입력 |
| `14_special_deposit.sql` | 완료 | 특강 현장 신청 보증금 상태(deposit, deposit_paid_at) 추가, 입금 문자 기록 표(deposit_events) 생성 |
| `15_book_auto_pickup.sql` | 완료 | 데스크 수령 희망 날짜·시간(pickup_date, pickup_time), 입금 기록 application_id 추가, FAQ 카테고리 '📦 수령 안내'·답 2곳 수정, 택배 FAQ 추가 |
| `16_daily_tests.sql` | 완료 | 문풀반 데일리 테스트 결과 표(test_results)·날짜별 번호 수정 표(test_overrides) 생성 |
| `17_notices.sql` | 완료 | 공지 표(site_notices)·공지 확인 기록 표(site_notice_reads) 생성, 첫 공지 2개(현장 스터디·온라인 참여) 입력. 기존 public.notices 표는 건드리지 않음 |

## 기록 갱신 규칙

- 실행을 사용자가 직접 확인한 파일만 여기에 완료로 기록해요.
- 실행본이 저장소 파일과 다르면, 저장소 파일을 실제 실행한 내용과 일치시킨 뒤 기록해요.
- SQL 파일을 새로 추가할 때 기존 실행 여부를 추정하지 말고 Vella에게 확인해요.