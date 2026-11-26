import { getSetting } from "@/lib/db";
import { pageMeta } from "@/lib/seo";

// 개인정보처리방침: 구글·카카오 로그인 앱 등록(구글 '브랜딩'의 개인정보처리방침 링크)에도 이 주소를 써요.
// 받는 정보·보관 기간이 바뀌면 이 페이지도 같이 고쳐요.
export const dynamic = "force-dynamic";
export const metadata = pageMeta("개인정보처리방침 | 부산 서면 토익 벨라토익", "부산 서면 토익 벨라토익이 받는 개인정보와 쓰는 곳, 보관 기간, 삭제 요청 방법을 안내해요.", "/privacy");

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1. 받는 정보와 쓰는 곳",
    items: [
      "교재 신청: 이름, 수강 월·반·과정·수강 시간, 수강 형태(현장/불라방), 입금자명, 강의실 비밀번호(암호화해서 저장). 불라방은 연락처와 교재 받는 방법(택배 주소 또는 데스크 수령 희망 날짜·시간)도 받아요. → 교재비 납부 확인, 교재 지급·발송, 강의실 이용 확인에 써요.",
      "카카오·구글 로그인: 계정 고유번호, 이메일(구글)·별명. 카카오·구글 비밀번호는 받지 않아요. → 로그인하고 내 수강 신청을 찾는 데 써요.",
      "수업 기록: 출석, 숙제, 데일리 테스트 점수, 특강 신청·보증금 확인, 첫 수업 미션 소개(이전·목표 점수, 시험 예정 시기, 선택: 학교/직장·인스타그램·한마디). → 출석·숙제·학습 관리와 스티커판에 써요.",
      "수강증 사진: 수강한 반 확인과 YBM 인강 교재 주문 확인에만 써요.",
      "YBM 인강 교재 주문: 이름, 연락처, 주소, 입금자명. → 교재 발송에 써요.",
      "입금 확인: 은행 입금 알림에서 입금자명과 금액만 확인해요. 문자 원문은 저장하지 않아요.",
    ],
  },
  {
    title: "2. 보관 기간",
    items: [
      "수강 기록은 수강 이력 확인(예: 격일반 두 달 과정 이어 듣기)을 위해 보관하고, 지워 달라고 요청하면 바로 지워요.",
      "30분 안에 입금이 확인되지 않아 자동 취소된 신청은 7일 뒤 자동으로 지워요.",
      "YBM 인강 주문의 이름·연락처·주소는 발송 3개월 뒤, 인강 수강증 사진은 발송 30일 뒤 자동으로 지워요.",
      "수강증 사진은 확인에 필요한 동안만 보관하고 자동으로 지워요.",
    ],
  },
  {
    title: "3. 다른 곳에 주는 정보",
    items: [
      "수강생의 개인정보를 다른 사람이나 회사에 주지 않아요. (법에 따라 요청받는 경우는 제외)",
      "사이트 운영에 아래 서비스를 써요: Supabase(데이터 저장, 서울 지역 서버), Vercel(웹사이트 운영), Google·카카오(로그인).",
    ],
  },
  {
    title: "4. 수강생이 요청할 수 있는 것",
    items: [
      "내 정보를 보거나 고치거나 지워 달라고 언제든지 요청할 수 있어요.",
      "카카오·구글 로그인 연결을 끊고 싶을 때도 알려 주세요.",
    ],
  },
  {
    title: "5. 안전하게 지키는 방법",
    items: [
      "강의실 비밀번호는 암호화해서 저장해요.",
      "수강 정보는 사이트 서버에서만 읽고 쓰고, 다른 사람의 브라우저에서 직접 볼 수 없어요.",
      "관리 화면은 관리자 비밀번호로 보호해요.",
    ],
  },
];

export default async function PrivacyPage() {
  const channel = await getSetting("kakao_channel_url").catch(() => "");
  return (
    <div className="space-y-6 pt-8">
      <div className="text-center">
        <h1 className="font-jua text-4xl text-sky-ink">개인정보처리방침</h1>
        <p className="mt-3 text-slate-600">벨라토익(vella_toeic)은 수업 운영에 꼭 필요한 정보만 받고, 소중히 다뤄요.</p>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.title} className="card space-y-3">
          <h2 className="font-jua text-xl text-sky-ink">{s.title}</h2>
          <ul className="space-y-2">
            {s.items.map((item) => (
              <li key={item} className="flex gap-2 text-[15px] leading-relaxed text-slate-700">
                <span className="mt-0.5 font-bold text-sky-deep">·</span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="card space-y-2">
        <h2 className="font-jua text-xl text-sky-ink">6. 문의</h2>
        <p className="text-[15px] text-slate-700">개인정보 담당: Vella쌤 (벨라토익 운영)</p>
        <p className="text-[15px] text-slate-700">
          열람·정정·삭제 요청과 문의는 벨라토익 카카오톡 채널로 보내 주세요.
          {channel && <> <a href={channel} target="_blank" rel="noreferrer" className="font-bold text-sky-deep underline">카카오톡 채널 열기 ↗</a></>}
        </p>
      </section>
      <p className="text-center text-sm text-slate-400">시행일: 2026년 12월 1일</p>
    </div>
  );
}
