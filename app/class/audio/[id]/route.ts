import { NextResponse } from "next/server";
import { getStudentIds, isAdmin } from "@/lib/auth";
import { audioDownloadUrl, getApplications, getAudio } from "@/lib/db";
import { audioCoursesFor, studentAudioWindow, takesLcAudio } from "@/lib/audio";
import { todayKST } from "@/lib/config";

export const dynamic = "force-dynamic";

// 같은 기수·같은 반·LC 수강·납부 완료 학생이 다운로드 기간 안에 있을 때만 1분짜리 주소로 보내요.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audio = await getAudio(id);
  if (!audio) return new NextResponse("음원을 찾을 수 없어요.", { status: 404 });

  let allowed = await isAdmin();
  if (!allowed) {
    const today = todayKST();
    const apps = (await getApplications(await getStudentIds()))
      .filter((a) => takesLcAudio(a) && a.cohort === audio.cohort && audioCoursesFor(a).includes(audio.course));
    for (const app of apps) {
      const period = await studentAudioWindow(app);
      if (period && today >= period.start && today <= period.end) {
        allowed = true;
        break;
      }
    }
  }
  if (!allowed) return new NextResponse("다운로드 기간이 아니거나 받을 수 없는 음원이에요.", { status: 403 });

  const url = await audioDownloadUrl(audio.storage_path, `${audio.title}.mp3`);
  if (!url) return new NextResponse("미리보기에서는 음원을 받을 수 없어요.", { status: 404 });
  return NextResponse.redirect(url);
}
