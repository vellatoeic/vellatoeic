import { confirmBookReceived } from "@/app/actions";

// 불라방 1층 데스크 수령 학생이 교재를 받은 뒤 직접 누르는 버튼
export default function BookReceived({ id, when }: { id: string; when?: string }) {
  return (
    <form action={confirmBookReceived} className="rounded-3xl border-2 border-sky-main bg-white p-5 text-center">
      <input type="hidden" name="id" value={id} />
      <p className="font-jua text-xl text-sky-ink">📚 1층 데스크에서 교재를 받았나요?</p>
      {when && <p className="mt-1 text-sm text-slate-500">수령 희망: {when}</p>}
      <button className="btn mt-3 w-full">교재 받았어요 ✓</button>
      <p className="mt-2 text-xs text-slate-400">받은 뒤에 눌러 주세요. Vella쌤이 준비 상황을 확인하는 데 써요.</p>
    </form>
  );
}
