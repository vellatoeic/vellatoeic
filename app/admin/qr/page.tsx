import { isAdmin } from "@/lib/auth";
import { isPreview } from "@/lib/db";
import LoginForm from "../LoginForm";
import QrScreen from "./QrScreen";

export const dynamic = "force-dynamic";
export const metadata = { title: "출석 QR · vella_toeic", robots: { index: false } };

export default async function QrPage() {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  return <QrScreen />;
}
