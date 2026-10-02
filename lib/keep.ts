import { startTransition, type FormEvent } from "react";

// 제출해도 입력한 내용이 지워지지 않게 (오류가 나면 학생이 처음부터 다시 쓰지 않도록)
export function keep(action: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}
