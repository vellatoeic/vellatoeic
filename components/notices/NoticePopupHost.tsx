import { noticeSummary } from "@/lib/noticeView";
import NoticePopup from "./NoticePopup";

// 홈·강의실에 넣어요: 본인 대상이고 아직 확인 안 한 팝업 공지가 있으면 띄워요.
export default async function NoticePopupHost() {
  const s = await noticeSummary();
  return s.popups.length ? <NoticePopup notices={s.popups} loggedIn={s.loggedIn} /> : null;
}
