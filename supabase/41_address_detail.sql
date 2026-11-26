-- 택배 상세주소 따로 저장: 신청서(applications)·YBM 인강 주문(ybm_orders)에 상세주소 칸(address_detail)만 추가해요. 여러 번 실행해도 안전해요.
-- 기존 주소(address)는 그대로 두고 바꾸지 않아요. 예전 신청의 상세주소 칸은 비어 있고, 관리 화면이 '[우편번호] 기본주소, 상세주소' 형식에서 나눠 보여줘요(lib/address.ts).

begin;

alter table public.applications add column if not exists address_detail text;
alter table public.ybm_orders add column if not exists address_detail text;

commit;

notify pgrst, 'reload schema';

-- 확인: 새 칸 (모두 비어 있음), 신청·주문 수는 그대로
select
  (select count(*) from public.applications) as applications,
  (select count(*) from public.applications where address_detail is not null) as apps_with_detail,
  (select count(*) from public.ybm_orders) as ybm_orders,
  (select count(*) from public.ybm_orders where address_detail is not null) as ybm_with_detail;
