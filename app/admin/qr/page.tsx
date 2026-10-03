import QRCode from "qrcode";
import { headers } from "next/headers";
import { KLASSES, KLASS_TIME, type Klass } from "@/lib/config";
import { isAdmin } from "@/lib/auth";
import { isPreview } from "@/lib/db";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";
import PrintButton from "../roster/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "출석 QR · vella_toeic", robots: { index: false } };

export default async function QrPage() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;

  // 인쇄물에 들어갈 주소는 지금 접속한 주소를 그대로 써요.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const cards = await Promise.all(
    (Object.keys(KLASSES) as Klass[]).map(async (k) => ({
      k,
      svg: await QRCode.toString(`${proto}://${host}/check?k=${k}`, {
        type: "svg",
        margin: 1,
        color: { dark: "#12405c", light: "#ffffff" },
      }),
    })),
  );

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="stamps" />

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h2 className="font-jua text-3xl text-sky-ink">출석 QR 인쇄</h2>
          <p className="mt-1 text-sm text-slate-500">
            반별로 한 장씩 출력해 강의실에 붙여 두면 끝이에요. QR은 바뀌지 않으니 한 번만 붙이면 계속 쓸 수 있어요.
          </p>
        </div>
        <PrintButton />
      </div>

      {cards.map(({ k, svg }) => (
        <section key={k} className="card break-inside-avoid text-center">
          <p className="font-jua text-3xl text-sky-ink">{KLASSES[k]} 출석 체크 ☁️</p>
          <p className="mt-1 text-slate-600">휴대폰 카메라로 QR을 찍으면 출석 스티커가 붙어요</p>
          <div className="mx-auto mt-4 aspect-square w-full max-w-xs" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="mt-4 space-y-1">
            {KLASS_TIME[k].map((s) => (
              <p key={s.label}>
                <b className="font-jua text-xl text-sky-deep">{s.label} {s.from}~{s.to}</b>
                <span className="ml-2 text-sm text-slate-500">{s.detail}</span>
              </p>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-500">이 시간에만 출석할 수 있어요</p>
        </section>
      ))}
    </div>
  );
}
