import { BOOKS, cohortLabel, klassLabel } from "@/lib/config";
import { listApplications, currentCohort, isPreview } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { phoneLabel } from "@/lib/csv";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";
import DeliveryList from "./DeliveryList";

export const dynamic = "force-dynamic";
export const metadata = { title: "택배 발송 · vella_toeic", robots: { index: false } };

const ORDER = ["paid", "pending", "shipped"];

export default async function DeliveryPage() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const cohort = await currentCohort();
  const delivery = (await listApplications())
    .filter((a) => a.cohort === cohort && a.kind === "online" && a.pickup === "delivery")
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.name.localeCompare(b.name, "ko"));
  const count = (status: string) => delivery.filter((a) => a.status === status).length;

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="delivery" />
      <div>
        <p className="text-slate-500">{cohortLabel(cohort)}</p>
        <h2 className="font-jua text-3xl text-sky-ink">불라방 교재 택배 발송</h2>
        <p className="mt-1 text-sm text-slate-600">
          전체 {delivery.length}명 · 발송 대기 {count("paid")}명 · 미납 {count("pending")}명 · 발송 완료 {count("shipped")}명
        </p>
      </div>
      <section className="card !p-4 sm:!p-6">
        {delivery.length > 0 ? (
          <DeliveryList
            rows={delivery.map((a) => ({ id: a.id, name: a.name, klass: klassLabel(a), phone: phoneLabel(a.phone), address: a.address ?? "", books: a.books.map((b) => BOOKS[b]).join(", "), status: a.status }))}
          />
        ) : <p className="text-center text-slate-500">이번 기수 택배 신청자가 아직 없어요.</p>}
      </section>
    </div>
  );
}
