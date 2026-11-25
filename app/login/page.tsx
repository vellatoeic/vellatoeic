import { redirect } from "next/navigation";
import LoginCard from "@/app/class/LoginCard";
import { activeStudentApps } from "@/lib/student";
import { getMemberId } from "@/lib/auth";
import { safeNext } from "@/lib/google";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata = { title: "로그인 · vella_toeic", robots: { index: false } };

// 머리의 [로그인] 버튼이 오는 곳. 이미 로그인했으면 첫 화면(또는 돌아갈 화면)으로 보내요.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const to = safeNext(next);
  const { loggedIn, apps } = await safe("login.apps", () => activeStudentApps(), { loggedIn: false, apps: [] });
  if (loggedIn && apps.length > 0) redirect(to);
  // 구글 로그인은 했는데 아직 신청과 연결 전이면 연결 화면으로
  if (!error && (await getMemberId())) redirect(`/login/link${to !== "/" ? `?next=${encodeURIComponent(to)}` : ""}`);
  return <LoginCard next={to} error={error} />;
}
