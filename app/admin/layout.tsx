// 관리 화면은 컴퓨터에서 넓게 써요 (최대 72rem). 휴대폰에서는 그대로예요.
// 바깥 기본 폭(max-w-3xl)을 벗어나 화면 가운데에 넓게 펼쳐요.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-[calc(50%-min(36rem,50vw-1rem))]">{children}</div>;
}
