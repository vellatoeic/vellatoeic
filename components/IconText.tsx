import { Fragment } from "react";
import Icon from "./Icon";
import { EMOJI_RE, iconForEmoji } from "@/lib/emojiIcon";

// 글 속 기본 이모티콘을 사이트 아이콘으로 바꿔 보여줘요 (공지·FAQ·특강 안내처럼 관리 화면에서 쓴 글).
// 매칭이 없는 이모티콘은 빼요. 크기는 기본으로 글자 크기(1.15em)에 맞춰요.
export default function IconText({ text, size = "1.15em" }: { text: string; size?: number | string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    const name = iconForEmoji(m[0]);
    if (name === "keep") parts.push(m[0]);
    else if (name) parts.push(<Icon key={i} name={name} size={size} />);
    last = i + m[0].length;
  }
  if (last === 0) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}
