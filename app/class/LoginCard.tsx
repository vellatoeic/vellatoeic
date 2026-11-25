import StudentLogin from "./StudentLogin";

// 예전 이름 그대로 쓰는 곳(미션·출석·밀린 테스트)을 위한 연결: 로그인 상자는 StudentLogin 하나예요
export default function LoginCard(props: { next?: string; note?: string; socialNote?: string; error?: string; title?: string }) {
  return <StudentLogin {...props} />;
}
