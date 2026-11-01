import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { activeStudentApps } from "@/lib/student";
import { getSpecialLecture, getSpecialMaterial, getSpecialRegistrationsFor, specialMaterialUrl } from "@/lib/db";
import { todayKST } from "@/lib/config";
import { canSeeSpecialMaterials } from "@/lib/special";
import { cohortUntil } from "@/lib/viewWindowServer";

export const dynamic = "force-dynamic";

// 관리자, 그리고 그 특강 신청자(불라방 · 보증금 확인된 현장은 특강 다음 날부터)만 특강이 있던 달 말까지 받을 수 있어요.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await getSpecialMaterial(id);
  if (!material) return new NextResponse("자료를 찾을 수 없어요.", { status: 404 });

  const event = await getSpecialLecture(material.special_lecture_id);
  const today = todayKST();
  const admin = await isAdmin();
  if (!admin) {
    if (!event) return new NextResponse("자료를 찾을 수 없어요.", { status: 404 });
    const regs = (await getSpecialRegistrationsFor((await activeStudentApps()).apps.map((a) => a.id))).filter((r) => r.special_lecture_id === material.special_lecture_id);
    if (regs.length === 0) return new NextResponse("특강 신청 확인 후 자료를 받을 수 있어요.", { status: 403 });
    const until = await cohortUntil(event.event_date.slice(0, 7));
    // 열람 기간(다음 달 개강 전날)이 지났으면 특강 페이지로 보내 안내해요
    if (today > until) return NextResponse.redirect(new URL("/special?expired=1", _request.url));
    if (!regs.some((r) => canSeeSpecialMaterials(r, event.event_date, today, until))) return new NextResponse("특강 신청 확인 후 자료를 받을 수 있어요.", { status: 403 });
  }

  const url = await specialMaterialUrl(material.storage_path, material.file_name);
  if (!url) return new NextResponse("자료가 아직 준비되지 않았어요.", { status: 404 });
  if (url.startsWith("data:")) {
    const [head, base64] = url.split(",");
    return new NextResponse(Buffer.from(base64, "base64"), {
      headers: {
        "content-type": head.slice(5).replace(";base64", ""),
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(material.file_name)}`,
      },
    });
  }
  return NextResponse.redirect(url);
}
