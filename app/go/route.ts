import { redirect } from "next/navigation";
import { myHome } from "@/lib/zones";

export const dynamic = "force-dynamic";

// 로그인한 뒤 들르는 주소: 관리자 / 신청 후(수강생) / 신청 전 중 알맞은 화면으로 바로 보내요 (lib/zones.ts)
export async function GET() {
  redirect(await myHome());
}
