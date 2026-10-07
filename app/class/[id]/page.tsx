import Link from "next/link";
import { redirect } from "next/navigation";
import { COURSES, PARTS, cohortLabel } from "@/lib/config";
import { getLecture } from "@/lib/db";
import { activeStudentApps } from "@/lib/student";
import { canOpenLecture } from "@/lib/access";

export const dynamic = "force-dynamic";
export const metadata = { title: "강의 · vella_toeic", robots: { index: false } };

export default async function Watch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ apps }, lecture] = await Promise.all([activeStudentApps(), getLecture(id)]);

  // 로그인 안 했거나, 이 강의를 볼 권한이 없으면 강의실로 (주소를 직접 입력해도 같아요)
  if (!lecture || !canOpenLecture(apps, lecture)) redirect("/class");

  return (
    <div className="space-y-5 pt-8">
      <Link href="/class" className="text-sm text-sky-deep underline">← 강의실로</Link>
      <div>
        <p className="text-sm text-slate-500">
          {cohortLabel(lecture.cohort)} · {COURSES[lecture.course].label} {PARTS[lecture.part]}
        </p>
        <h1 className="font-jua mt-1 text-3xl text-sky-ink">{lecture.title}</h1>
      </div>
      <div className="overflow-hidden rounded-3xl bg-black shadow-[0_4px_24px_rgba(43,143,199,0.15)]">
        <iframe
          className="aspect-video w-full"
          src={`https://www.youtube-nocookie.com/embed/${lecture.youtube_id}?rel=0&modestbranding=1`}
          title={lecture.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
