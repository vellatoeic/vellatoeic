"use client";

import { useState } from "react";
import { FINDER } from "@/lib/homeContent";

// 나에게 맞는 반 찾기: 세 문제 (소개 자료 '선택 길잡이' 문장 그대로). 결과는 참고용이에요.
const WORDS = FINDER.verbSentence.replace(/\.$/, "").split(" ");
const CHECK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
);

export default function ClassFinder({ kakaoUrl }: { kakaoUrl: string }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<[number, boolean, boolean]>([0, false, false]);
  const [note, setNote] = useState("");

  const next = (patch: Partial<{ 0: number; 1: boolean; 2: boolean }>, msg = "") => {
    setAnswers((a) => Object.assign([...a], patch) as [number, boolean, boolean]);
    setNote(msg);
    setStep((s) => s + 1);
  };

  const bar = (
    <div className="f-bar" aria-hidden="true">
      {[0, 1, 2].map((i) => <i key={i} className={i < step ? "on" : ""} />)}
    </div>
  );

  let body: React.ReactNode;
  if (step === 0) {
    body = (
      <>
        <p className="f-q"><span className="f-no">Q1</span>지금 토익 점수가 있나요?</p>
        <div className="f-opts">
          {["토익이 처음이에요", "500점 이하예요", "500점 이상이에요"].map((t, i) => (
            <button key={t} type="button" className="opt" onClick={() => next({ 0: i })}>{t}</button>
          ))}
        </div>
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <p className="f-q"><span className="f-no">Q2</span>이 문장의 <b>동사</b>를 눌러 보세요</p>
        <p className="f-sent">
          {WORDS.map((w, i) => (
            <span key={i}>
              <button type="button" className="word" onClick={() => next({ 1: w === FINDER.verb }, w === FINDER.verb ? "정답! 동사는 caused 예요" : "아쉬워요 — 동사는 caused 예요")}>{w}</button>{" "}
            </span>
          ))}
          .
        </p>
        <button type="button" className="h-btn text" onClick={() => next({ 1: false })}>잘 모르겠어요</button>
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        {note && <p className="f-note">{note}</p>}
        <p className="f-q"><span className="f-no">Q3</span>빈칸에 알맞은 것은?</p>
        <p className="f-sent en">{FINDER.p5}</p>
        <div className="f-opts grid2">
          {FINDER.p5Choices.map((c, i) => (
            <button key={c} type="button" className="opt" onClick={() => next({ 2: i === FINDER.p5Answer }, i === FINDER.p5Answer ? "정답! (B) Although" : "정답은 (B) Although 예요")}>
              ({"ABCD"[i]}) {c}
            </button>
          ))}
        </div>
      </>
    );
  } else {
    const [score, verbOk, p5Ok] = answers;
    const solve = score === 2 && verbOk && p5Ok;
    const why = [
      verbOk ? "주어 · 동사는 잘 찾아요" : "주어 · 동사 찾기부터 잡으면 돼요",
      p5Ok ? "접속사 · 전치사 구분도 OK" : "Although 자리는 '절 앞 = 접속사'로 풀어요",
      ...(solve ? [FINDER.solveTip] : !verbOk ? [FINDER.startTip] : []),
    ];
    body = (
      <div className="f-result">
        {note && <p className="f-note">{note}</p>}
        <p className="eyebrow">추천 반</p>
        <h3>{solve ? "토익문풀반" : "토익시작반"}</h3>
        <p className="f-goal">{solve ? "토익성적 정체기 극복 · 단기간 750+ 목표달성" : "영어울렁증 극복! · 첫 토익 650+ 목표"}</p>
        <ul className="ticks">
          {why.map((w) => <li key={w}>{CHECK}<span>{w}</span></li>)}
        </ul>
        <p className="f-also">오로지 토익에만 몰입할 수 있다면 <b>실전속성반</b>(개념+문풀 한방에)도 함께 보세요.</p>
        <div className="h-row">
          <a className="h-btn gold" href={kakaoUrl} target="_blank" rel="noopener noreferrer">카톡으로 반 상담</a>
          <button type="button" className="h-btn line" onClick={() => { setStep(0); setNote(""); }}>다시 하기</button>
        </div>
        <p className="fine">이 결과는 벨라토익 소개 자료의 &lsquo;선택 길잡이&rsquo;를 바탕으로 한 참고용이에요.</p>
      </div>
    );
  }

  return (
    <div className="h-card finder" aria-live="polite">
      {bar}
      <div key={step}>{body}</div>
    </div>
  );
}
