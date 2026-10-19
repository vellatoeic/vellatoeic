import { redirect } from "next/navigation";

// 예전 주소: 학생 통합 화면으로 옮겼어요
export default async function OldStudentStamps({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/students/${id}`);
}
