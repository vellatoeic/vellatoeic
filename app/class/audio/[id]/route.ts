import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { activeStudentApps } from "@/lib/student";
import { canDownloadAudio } from "@/lib/access";
import { audioDownloadUrl, getAudio } from "@/lib/db";
import { studentAudioWindow } from "@/lib/audio";
import { todayKST } from "@/lib/config";

export const dynamic = "force-dynamic";

// 같은 기수·같은 LC 교재·납부 완료 학생이 다운로드 기간 안에 있을 때만 음원 링크로 보내요.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audio = await getAudio(id);
  if (!audio) return new NextResponse("음원을 찾을 수 없어요.", { status: 404 });

  let allowed = await isAdmin();
  if (!allowed) {
    const { apps } = await activeStudentApps();
    const candidates = apps.filter((a) => a.cohort === audio.cohort);
    const periods = new Map(await Promise.all(candidates.map(async (a) => [a.id, await studentAudioWindow(a)] as const)));
    allowed = canDownloadAudio(candidates, audio, (a) => periods.get(a.id) ?? null, todayKST());
  }
  if (!allowed) return new NextResponse("다운로드 기간이 아니거나 받을 수 없는 음원이에요.", { status: 403 });

  // 지금 방식: 구글 드라이브 공유 링크로 보내요 (Supabase 전송량을 쓰지 않아요)
  if (audio.link_url) return NextResponse.redirect(audio.link_url);
  // 예전 방식(보관함 파일): 이사 후에는 파일이 없을 수 있어요
  const url = audio.storage_path ? await audioDownloadUrl(audio.storage_path, `${audio.title}.zip`).catch(() => null) : null;
  if (!url) return new NextResponse("음원을 준비 중이에요. 잠시 후 다시 받아 주세요.", { status: 404 });
  return NextResponse.redirect(url);
}
