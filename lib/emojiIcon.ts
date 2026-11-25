// 기본 이모티콘 → 사이트 아이콘 이름 (components/Icon.tsx). 2026-11 Vella: "기본 이모티콘은 절대 쓰지 않기".
// 관리 화면에서 쓴 글(공지·FAQ·특강 안내 등)에 이모티콘이 있어도 화면에는 아이콘으로 보이게 해요 (components/IconText.tsx).
// 매칭이 없는 이모티콘은 보여주지 않아요.

export const EMOJI_RE = /(?:[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2B55}\u{23E9}-\u{23FA}\u{231A}\u{231B}\u{25B6}\u{25C0}\u{27A1}\u{2139}])\u{FE0F}?(?:\u{200D}(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}])\u{FE0F}?)*/gu;

// 글자 기호로 쓰는 것 (이모티콘이 아니에요)
const KEEP = new Set(["✦", "✕", "✓", "✔", "➜"]);

const MAP: Record<string, string> = {
  "☀": "sun", "🌞": "sun", "🌤": "sun", "⛅": "sun", "🌙": "moon", "🌛": "moon",
  "🕒": "clock", "🕘": "clock", "🕐": "clock", "⏰": "clock", "⏱": "stopwatch", "⌛": "hourglass", "⏳": "hourglass",
  "🔴": "livedot", "🎥": "live", "📹": "live", "📺": "replay", "▶": "play", "◀": "chevronLeft", "⏩": "arrowRight", "⏭": "arrowRight", "⏪": "chevronLeft", "⏸": "clock", "⏯": "play",
  "📝": "clipboard", "📋": "clipboard", "✏": "edit", "✍": "homework", "📄": "doc", "🧾": "doc", "📃": "doc",
  "🎧": "headphones", "🎤": "mic", "🎙": "mic", "📢": "megaphone", "📣": "megaphone", "🔔": "bell",
  "✅": "check", "☑": "check", "👍": "check", "⭐": "star", "🌟": "star", "☁": "cloud",
  "⚠": "alert", "🚨": "siren", "❗": "alert", "❓": "help", "❔": "help", "🆕": "new",
  "📚": "book", "📘": "book", "📖": "reading", "🌱": "reading", "📒": "book",
  "🎁": "gift", "🎉": "sparkle", "🎊": "sparkle", "✨": "sparkle", "🌈": "sparkle", "💫": "sparkle",
  "📦": "parcel", "🚚": "parcel", "📮": "parcel", "📌": "pin", "🧷": "pin", "📍": "pin",
  "💻": "laptop", "🖥": "laptop", "📱": "phone", "📞": "phone", "🏫": "school", "🏢": "school",
  "📅": "calendar", "🗓": "calendar", "📆": "calendar", "💰": "coins", "💸": "coins", "💳": "card", "🪙": "coins",
  "🔁": "repeat", "🔄": "refresh", "💬": "chat", "🗨": "chat", "🔍": "search", "🔎": "search", "🔗": "link",
  "🟡": "dot", "🟢": "check", "🧹": "trash", "🗑": "trash", "🔥": "target", "🎯": "target", "⚡": "stopwatch",
  "👋": "wave", "📸": "camera", "📷": "camera", "📈": "chart", "📉": "chart", "📊": "chart",
  "🏆": "trophy", "🏅": "trophy", "🥇": "trophy", "⚙": "settings", "🔒": "lock", "🔐": "lock",
  "📥": "mail", "📩": "mail", "📨": "mail", "✉": "mail", "➕": "plus", "👥": "people", "🤝": "people", "🙋": "people",
  "💛": "heart", "❤": "heart", "💙": "heart", "🩵": "heart", "💡": "sparkle", "🎓": "school", "🏠": "school",
};

// 이모티콘 하나 → 아이콘 이름 (없으면 null = 보여주지 않음). KEEP 기호는 "keep".
export function iconForEmoji(emoji: string): string | "keep" | null {
  const base = emoji.replace(/\u{FE0F}/gu, "").split("‍")[0];
  if (KEEP.has(base)) return "keep";
  return MAP[base] ?? null;
}

// 글에서 이모티콘을 빼요 (CSV·복사·이미지처럼 아이콘을 못 넣는 곳). 앞뒤 공백도 정리해요.
export function stripEmoji(text: string) {
  return text.replace(EMOJI_RE, (m) => (iconForEmoji(m) === "keep" ? m : "")).replace(/\s{2,}/g, " ").trim();
}
