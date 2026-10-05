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

## 기록 갱신 규칙

- 실행을 사용자가 직접 확인한 파일만 여기에 완료로 기록해요.
- 실행본이 저장소 파일과 다르면, 저장소 파일을 실제 실행한 내용과 일치시킨 뒤 기록해요.
- SQL 파일을 새로 추가할 때 기존 실행 여부를 추정하지 말고 Vella에게 확인해요.