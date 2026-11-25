"use client";

import { useEffect } from "react";

// 첫 화면 움직임: .rv 칸이 화면에 들어오면 차례로 나타나고(.in), 안의 [data-count] 숫자를 세요.
// 기기의 '동작 줄이기' 설정이면 움직임 없이 바로 마지막 모습을 보여줘요.
const fmt = (el: HTMLElement, v: number) => `${el.dataset.prefix ?? ""}${Math.round(v).toLocaleString("ko-KR")}`;

function countUp(el: HTMLElement) {
  if (el.dataset.done) return;
  el.dataset.done = "1";
  const to = Number(el.dataset.count);
  const from = Number(el.dataset.from ?? 0);
  const dur = Number(el.dataset.dur ?? 1200);
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(el, from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export default function Reveal({ root = ".vh" }: { root?: string }) {
  useEffect(() => {
    const box = document.querySelector<HTMLElement>(root);
    if (!box) return;
    let still = false;
    try {
      still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* 옛 브라우저 */
    }
    const els = [...box.querySelectorAll<HTMLElement>(".rv")];
    // 같은 부모 안의 칸은 차례로 (최대 6칸)
    const seen = new Map<Element | null, number>();
    els.forEach((el) => {
      const i = seen.get(el.parentElement) ?? 0;
      seen.set(el.parentElement, i + 1);
      el.style.setProperty("--d", `${Math.min(i, 6) * 90}ms`);
    });
    if (still || !("IntersectionObserver" in window)) {
      box.classList.add("still");
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    box.classList.add("moving");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          el.classList.add("in");
          el.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
          io.unobserve(el);
        }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root]);
  return null;
}
