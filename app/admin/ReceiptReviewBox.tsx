// [신청 관리] 수강증 확인 상자: 선생님 확인이 필요한 수강증(최신순) + 자동 읽기 스위치·이번 달 사용량·보관 사진 용량.
// 무료 한도: Vercel 서버 계산 시간 월 4시간(글자 읽기 상한으로 보호) · Supabase 사진 보관함 1GB.
import { approveReceipts, saveReceiptOcr } from "@/app/actions";
import { KINDS } from "@/lib/config";
import { listReceiptChecks, receiptImageUrl, receiptImageUsage, type Application } from "@/lib/db";
import { classTextWithLevel } from "@/lib/receipt/classes";
import { ocrUsage } from "@/lib/receipt/usage";
import CloseOnSubmitForm from "./CloseOnSubmitForm";
import SelectAll from "./SelectAll";

const STORAGE_LIMIT = 1024 ** 3; // Supabase 무료 보관함 1GB
const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`);

export default async function ReceiptReviewBox({ apps }: { apps: Application[] }) {
  const byId = new Map(apps.map((a) => [a.id, a]));
  const [checks, usage, images] = await Promise.all([listReceiptChecks("review"), ocrUsage(), receiptImageUsage()]);
  // 취소·환불된 신청의 수강증은 빼요 (사진은 자동 정리돼요)
  const rows = checks.flatMap((c) => {
    const a = c.application_id ? byId.get(c.application_id) : undefined;
    return a && a.status !== "cancelled" && a.status !== "refunded" ? [{ c, a }] : [];
  });
  const urls = new Map(await Promise.all(rows.map(async ({ c }) => [c.id, c.image_path ? await receiptImageUrl(c.image_path).catch(() => null) : null] as const)));
  const ocrPct = usage.cap > 0 ? Math.round((usage.count / usage.cap) * 100) : 100;
  const storagePct = (images.bytes / STORAGE_LIMIT) * 100;
  const warn = ocrPct >= 70 || storagePct >= 70;

  return (
    <section id="receipts" className={`rounded-3xl border-2 p-5 ${rows.length ? "border-amber-300 bg-amber-50" : "border-sky-main/60 bg-white"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className={`font-jua text-xl ${rows.length ? "text-amber-700" : "text-sky-ink"}`}>{rows.length ? `수강증 확인 필요 ${rows.length}명` : "수강증 자동 확인"}</p>
        <span className="text-sm text-slate-600">
          자동 읽기 <b className={usage.on ? "text-emerald-700" : "text-red-600"}>{usage.on ? "켜짐" : "꺼짐"}</b>
          {" · "}이번 달 {usage.count}/{usage.cap}장 ({ocrPct}%)
          {" · "}보관 사진 {images.images}장 {kb(images.bytes)}
        </span>
        <details className="ml-auto text-sm">
          <summary className="cursor-pointer rounded-full bg-white px-3 py-1 font-bold text-sky-ink">설정</summary>
          <CloseOnSubmitForm action={saveReceiptOcr} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-white p-3">
            <select name="on" defaultValue={usage.on ? "on" : "off"} className="input !w-28 !py-1.5 text-sm">
              <option value="on">켜기</option>
              <option value="off">끄기</option>
            </select>
            <label className="flex items-center gap-1 text-sm">한 달 상한 <input name="cap" type="number" min={0} max={3000} defaultValue={usage.cap} className="input !w-24 !py-1.5 text-sm" />장</label>
            <button className="btn !px-4 !py-1.5 !text-sm">저장</button>
            <span className="w-full text-xs text-slate-500">끄거나 상한에 닿으면 학생이 반을 직접 고르고, 올린 수강증은 여기서 확인해요. 신청은 계속 받아요.</span>
          </CloseOnSubmitForm>
        </details>
      </div>
      {warn && (
        <p className="mt-2 rounded-xl bg-red-50 p-2.5 text-sm font-bold text-red-600">
          {ocrPct >= 70 && `이번 달 글자 읽기가 상한의 ${ocrPct}%예요. 상한에 닿으면 자동으로 '선생님 확인' 방식으로 바뀌어요. `}
          {storagePct >= 70 && `보관 사진이 무료 보관함(1GB)의 ${Math.round(storagePct)}%예요. 아래 수강증을 확인하면 7일 뒤 사진이 지워져요.`}
        </p>
      )}

      {rows.length > 0 && (
        <CloseOnSubmitForm action={approveReceipts} className="mt-3 block space-y-2">
          <p className="text-sm text-slate-600">수강증과 신청한 반을 비교해 주세요. 반이 다르면 이름을 눌러 반을 고친 뒤 [확인했어요]를 눌러요. 확인한 사진은 7일 뒤 자동으로 지워져요.</p>
          <label className="flex items-center gap-2 text-sm font-bold text-sky-ink"><SelectAll group="receipts" /> {rows.length}명 전체 선택</label>
          <ul className="space-y-2">
            {rows.map(({ c, a }) => (
              <li key={c.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl bg-white p-3 text-sm">
                <input type="checkbox" name="receipt_ids" value={c.id} data-group="receipts" aria-label={`${a.name} 선택`} className="mt-0.5 h-4 w-4 accent-sky-deep" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p>
                    <a href={`/admin/students/${a.id}`} className="font-bold text-sky-ink underline decoration-sky-main underline-offset-2">{a.name}</a>
                    <span className="ml-2 text-slate-600">신청: {a.slot ? classTextWithLevel({ cohort: a.cohort, course: a.course, track: a.track, slot: a.slot }) : "-"} · {KINDS[a.kind].short}</span>
                  </p>
                  <p className="text-slate-600">
                    수강증: {c.classes.length ? c.classes.map(classTextWithLevel).join(" / ") : "반을 못 찾음"}
                    {c.kind ? ` · ${KINDS[c.kind].short}` : ""}
                    {c.receipt_name ? ` · 수강생 ${c.receipt_name}` : ""}
                  </p>
                  {c.reasons.length > 0 && <p className="text-xs font-bold text-red-600">{c.reasons.join(" · ")}</p>}
                </div>
                {urls.get(c.id) ? (
                  <a href={urls.get(c.id)!} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-sky-soft px-3 py-1 text-xs font-bold text-sky-ink">수강증 사진 보기 ↗</a>
                ) : (
                  <span className="shrink-0 text-xs text-slate-400">{c.image_deleted_at ? "사진 지움" : "사진 없음"}</span>
                )}
              </li>
            ))}
          </ul>
          <button className="btn w-full !py-3 !text-base">체크한 수강증 확인했어요</button>
        </CloseOnSubmitForm>
      )}
    </section>
  );
}
