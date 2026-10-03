import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { photoUrl } from "@/lib/db";

// 관리자만 숙제 사진 보기 (1시간짜리 임시 주소로 연결)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse("관리자 로그인이 필요해요.", { status: 401 });
  const p = req.nextUrl.searchParams.get("p") ?? "";
  if (!/^\d{4}-\d{2}\/[0-9a-f-]{36}\/\d{4}-\d{2}-\d{2}\.jpg$/.test(p)) return new NextResponse("잘못된 요청", { status: 400 });
  const url = await photoUrl(p);
  if (!url) return new NextResponse("사진이 없어요 (기수 정리로 지워졌을 수 있어요).", { status: 404 });
  if (url.startsWith("data:")) {
    const buf = Buffer.from(url.split(",")[1], "base64");
    return new NextResponse(buf, { headers: { "content-type": "image/jpeg" } });
  }
  return NextResponse.redirect(url);
}
