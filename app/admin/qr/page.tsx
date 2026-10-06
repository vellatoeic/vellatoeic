import QRCode from "qrcode";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/config";
import { isAdmin } from "@/lib/auth";
import { isPreview } from "@/lib/db";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";
import PrintButton from "../roster/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "출석 QR · vella_toeic", robots: { index: false } };

export default async function QrPage() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;

  // QR에는 항상 정식 주소를 넣어요. (배포 미리보기 주소는 로그인이 걸려 있어서 학생 폰에서 오류가 나요)
  // 컴퓨터에서 미리보기로 실행할 때만 지금 접속한 주소를 써요.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const base = isPreview ? `${host.startsWith("localhost") ? "http" : "https"}://${host}` : SITE_URL;
  const url = `${base}/check`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#12405c", light: "#ffffff" } });

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="stamps" />

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h2 className="font-jua text-3xl text-sky-ink">출석 QR 인쇄</h2>
          <p className="mt-1 text-sm text-slate-500">
            QR은 하나예요. 강의실에 붙이고 라이브 방송에도 띄워 주세요.<br />반·시간 구분 없이 찍으면 오늘 출석으로 남아요. (예전 반별 QR도 그대로 쓸 수 있어요)
          </p>
        </div>
        <PrintButton />
      </div>

      <section className="card text-center">
        <p className="font-jua text-3xl text-sky-ink">출석 체크 ☁️</p>
        <p className="mt-1 text-slate-600">휴대폰 카메라로 QR을 찍으면 출석 스티커가 붙어요</p>
        <div className="mx-auto mt-4 aspect-square w-full max-w-sm" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-2 text-[11px] text-slate-400">{url}</p>
      </section>
    </div>
  );
}
