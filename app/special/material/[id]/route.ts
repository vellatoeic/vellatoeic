import { NextResponse } from "next/server";
import { getStudentIds, isAdmin } from "@/lib/auth";
import { getApplications, getSpecialLecture, getSpecialMaterial, getSpecialRegistration, specialMaterialUrl } from "@/lib/db";
import { canWatch } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await getSpecialMaterial(id);
  if (!material) return new NextResponse("자료를 찾을 수 없어요.", { status: 404 });
  const lecture = await getSpecialLecture(material.special_lecture_id);
  if (!lecture) return new NextResponse("특강을 찾을 수 없어요.", { status: 404 });

  let allowed = await isAdmin();
  if (!allowed) {
    const applications = (await getApplications(await getStudentIds())).filter((app) => canWatch(app) && app.cohort === lecture.cohort);
    for (const application of applications) {
      const registration = await getSpecialRegistration(lecture.id, application.id);
      if (registration?.mode === "online" && registration.approved) {
        allowed = true;
        break;
      }
    }
  }
  if (!allowed) return new NextResponse("온라인 특강 신청 확인 후 자료를 받을 수 있어요.", { status: 403 });

  const url = await specialMaterialUrl(material.storage_path);
  if (!url) return new NextResponse("자료가 아직 준비되지 않았어요.", { status: 404 });
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1];
    return new NextResponse(Buffer.from(base64, "base64"), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(material.file_name)}`,
      },
    });
  }
  return NextResponse.redirect(url);
}
