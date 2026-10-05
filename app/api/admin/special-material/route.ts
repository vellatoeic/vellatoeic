import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSpecialLecture, uploadSpecialMaterial } from "@/lib/db";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/haansofthwp",
  "application/x-hwp",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "관리자 로그인이 필요해요." }, { status: 401 });
  const data = await request.formData();
  const eventId = String(data.get("event_id") ?? "");
  const file = data.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "올릴 자료를 선택해 주세요." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "파일은 4MB 이하로 올려 주세요." }, { status: 413 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "PDF·문서·이미지 파일만 올릴 수 있어요." }, { status: 415 });
  const lecture = await getSpecialLecture(eventId);
  if (!lecture) return NextResponse.json({ error: "특강을 찾을 수 없어요." }, { status: 404 });

  await uploadSpecialMaterial(eventId, file.name, Buffer.from(await file.arrayBuffer()), file.type);
  return NextResponse.json({ ok: "자료를 올렸어요." });
}
