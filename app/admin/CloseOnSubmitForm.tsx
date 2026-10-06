"use client";

// 저장·수정·삭제 버튼을 누르면 이 칸을 감싼 접는 상자(details)와 칸 안에 펼친 상자를 모두 바로 접어요.
export default function CloseOnSubmitForm({ action, id, className, children }: { action: (fd: FormData) => void | Promise<void>; id?: string; className?: string; children: React.ReactNode }) {
  return (
    <form
      id={id}
      action={action}
      className={className}
      onSubmit={(e) => {
        const form = e.currentTarget;
        form.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"));
        for (let d = form.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.removeAttribute("open");
      }}
    >
      {children}
    </form>
  );
}
