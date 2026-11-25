import { googleSetup } from "@/lib/google";
import StudentLogin from "./StudentLogin";

// 서버에서 구글 로그인이 켜졌는지(Vercel 환경변수) 확인해서 로그인 화면에 넘겨요
export default function LoginCard(props: { next?: string; note?: string; error?: string; title?: string }) {
  return <StudentLogin {...props} google={googleSetup().on} />;
}
