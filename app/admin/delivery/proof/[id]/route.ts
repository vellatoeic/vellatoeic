import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getYbmOrder, ybmProofUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

// 관리자만: YBM 인강 수강증 사진을 10분짜리 임시 주소로 열어요.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("관리자 로그인이 필요해요.", { status: 401 });
  const { id } = await params;
  const order = await getYbmOrder(id);
  if (!order?.proof_path) return new NextResponse("수강증 사진이 없어요. (발송 30일 뒤 자동으로 지워져요)", { status: 404 });
  const url = await ybmProofUrl(order.proof_path);
  if (!url) return new NextResponse("사진을 찾지 못했어요.", { status: 404 });
  if (url.startsWith("data:")) {
    // 미리보기(메모리 저장)일 때는 사진을 바로 보여줘요.
    const [head, b64] = url.split(",");
    return new NextResponse(Buffer.from(b64, "base64"), { headers: { "content-type": head.slice(5).split(";")[0], "cache-control": "no-store" } });
  }
  return NextResponse.redirect(url);
}
