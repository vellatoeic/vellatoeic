/**
 * 한 번에 하나씩만 돌리는 줄 — OCR 워커 하나를 여러 요청이 나눠 쓸 때 쓴다.
 *
 * Vercel 은 한 인스턴스에서 요청 여러 개를 함께 돌린다. tesseract 워커는 한 번에 한 장만 읽어서 나머지는 그 뒤에 줄을 서는데,
 * 줄 선 시간까지 타임아웃에 넣으면 **교실에서 여럿이 한꺼번에 올릴 때 뒤 사람이 시간 초과**가 나고, 시간 초과가 난 요청이
 * 공유 워커를 죽이면 같이 기다리던 요청은 영영 끝나지 않는다 (tesseract.js 는 죽은 워커의 작업을 끝내 주지 않는다). 그래서:
 *  - 작업은 한 번에 하나. 작업 시간 제한은 **자기 차례가 온 뒤부터** 센다 (부르는 쪽이 작업 안에서 잰다).
 *  - 차례를 `maxWaitMs` 넘게 기다리면 포기한다 (`QueueBusyError`) — 함수 제한 시간 안에 답을 돌려줘야 한다.
 *  - 포기한 자리 · 실패한 작업도 차례는 넘긴다 — 줄이 멈추지 않는다.
 */
export class QueueBusyError extends Error {
  constructor() {
    super("ocr_busy");
    this.name = "QueueBusyError";
  }
}

export type SerialQueue = <T>(task: () => Promise<T>, maxWaitMs: number) => Promise<T>;

export function createSerialQueue(): SerialQueue {
  // 줄의 끝 — 늘 성공으로 끝나는 promise 만 이어 붙인다 (앞 작업의 실패가 뒤로 번지지 않게)
  let tail: Promise<void> = Promise.resolve();
  return async function run<T>(task: () => Promise<T>, maxWaitMs: number): Promise<T> {
    const prev = tail;
    let release!: () => void;
    const mine = new Promise<void>((resolve) => (release = resolve));
    tail = prev.then(() => mine);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const myTurn = await Promise.race([
      prev.then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), Math.max(0, maxWaitMs));
      }),
    ]);
    clearTimeout(timer);
    if (!myTurn) {
      void prev.then(release); // 기다리다 포기 — 내 차례가 오면 곧바로 다음 사람에게 넘긴다
      throw new QueueBusyError();
    }
    try {
      return await task();
    } finally {
      release();
    }
  };
}
