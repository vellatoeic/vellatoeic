// 자주 묻는 질문 검색 (학생 화면 /faq · 첫 화면). 띄어쓰기·대소문자·이모티콘은 무시하고, 낱말을 모두 포함한 질문만.
// 질문에서 찾은 것이 답에서만 찾은 것보다 먼저 나와요. 자동 테스트: tests/faq-search.test.ts
import { EMOJI_RE } from "./emojiIcon";

type Faq = { id: string; category: string; question: string; answer: string };

export const normFaq = (s: string) => s.replace(EMOJI_RE, "").replace(/\s+/g, "").toLowerCase();

export function searchFaq<T extends Faq>(items: T[], query: string): T[] {
  const words = query.split(/\s+/).map(normFaq).filter(Boolean);
  if (words.length === 0) return [];
  const scored = items.flatMap((f, i) => {
    const q = normFaq(f.question);
    const all = q + normFaq(f.answer) + normFaq(f.category);
    // 낱말을 붙여 쓴 검색('교재비입금')도 띄어 쓴 질문('교재비 입금')을 찾아요
    if (!words.every((w) => all.includes(w)) && !all.includes(words.join(""))) return [];
    const inQuestion = words.filter((w) => q.includes(w)).length;
    return [{ f, i, score: inQuestion }];
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.f);
}
