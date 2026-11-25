import StudentLoginForm from "./StudentLoginForm";
import { loginSetup } from "@/lib/socialServer";

// 강의실·출석·미션·밀린 테스트 로그인 상자: 관리 [기본 설정]의 로그인 방식에 맞춰 버튼·칸을 보여줘요
// socialNote: 구글·카카오만 방식일 때 note 대신 쓰는 문구 (note에 '비밀번호'가 들어 있으면 이걸로 바꿔요)
export default async function StudentLogin({ next, note, socialNote }: { next?: string; note?: string; socialNote?: string }) {
  const { providers, pin } = await loginSetup();
  const text = pin || !note?.includes("비밀번호") ? note : socialNote;
  return <StudentLoginForm next={next} note={text} providers={providers} pin={pin} />;
}
