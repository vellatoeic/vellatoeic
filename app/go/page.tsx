import { redirect } from "next/navigation";
import { myHome, myZone } from "@/lib/zones";
import { myProfileState } from "@/lib/profileServer";
import { getViewing } from "@/lib/auth";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

// 로그인한 뒤 들르는 주소: 관리자 / 신청 후(수강생) / 신청 전 중 알맞은 화면으로 바로 보내요 (lib/zones.ts)
// 수강생이 '내 정보'(카카오·구글 연결 · 휴대폰 · 목표 점수 · 공부 이유)를 아직 안 했으면 먼저 /welcome (강사 '학생 화면 보기' 중에는 건너뛰어요)
// 경로 처리기(route.ts)가 아니라 페이지여야 해요: 서버 동작(로그인)에서 여기로 보내면 주소창이 최종 화면으로 바뀌어,
// 그 화면의 신청서·저장 버튼이 올바른 주소로 보내져요. (route.ts면 주소창이 /go로 남아 저장이 실패했어요)
export default async function GoPage() {
  const { zone } = await myZone();
  if (zone === "student" && !(await safe("go.viewing", () => getViewing(), null))) {
    const state = await safe("go.profile", () => myProfileState(), null);
    if (state && state.steps.length > 0) redirect("/welcome");
  }
  redirect(await myHome());
}
