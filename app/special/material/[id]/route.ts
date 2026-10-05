import { NextResponse } from "next/server";
import { getStudentIds, isAdmin } from "@/lib/auth";
import { getSpecialMaterial, getSpecialRegistrationsFor, specialMaterialUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

// 불라방으로 신청한 수강생(강의실 로그인)과 관리자만 자료를 받을 수 있어요.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await getSpecialMaterial(id);
  if (!material) return new NextResponse("자료를 찾을 수 없어요.", { status: 404 });

  const allowed = (await isAdmin()) || (await getSpecialRegistrationsFor(await getStudentIds()))
    .some((r) => r.mode === "online" && r.special_lecture_id === material.special_lecture_id);
  if (!allowed) return new NextResponse("불라방 특강 신청 확인 후 자료를 받을 수 있어요.", { status: 403 });

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
