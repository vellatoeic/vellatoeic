import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { activeStudentApps } from "@/lib/student";
import { getSpecialLecture, getSpecialMaterial, getSpecialRegistrationsFor, specialMaterialUrl } from "@/lib/db";
import { todayKST } from "@/lib/config";
import { canSeeSpecialMaterials } from "@/lib/special";

export const dynamic = "force-dynamic";

// 관리자, 그리고 그 특강 신청자(불라방 · 보증금 확인된 현장은 특강 다음 날부터)만 특강이 있던 달 말까지 받을 수 있어요.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await getSpecialMaterial(id);
  if (!material) return new NextResponse("자료를 찾을 수 없어요.", { status: 404 });

  const event = await getSpecialLecture(material.special_lecture_id);
  const today = todayKST();
  const allowed = (await isAdmin()) || (!!event && (await getSpecialRegistrationsFor((await activeStudentApps()).apps.map((a) => a.id)))
    .some((r) => r.special_lecture_id === material.special_lecture_id && canSeeSpecialMaterials(r, event.event_date, today)));
  if (!allowed) return new NextResponse("특강 신청 확인 후, 특강이 있던 달 말까지 자료를 받을 수 있어요.", { status: 403 });

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
