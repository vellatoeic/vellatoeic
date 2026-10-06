"use client";

// 저장 버튼을 누르면 감싸고 있는 접는 상자(details)를 바로 접어요.
export default function CloseOnSubmitForm({ action, className, children }: { action: (fd: FormData) => void | Promise<void>; className?: string; children: React.ReactNode }) {
  return (
    <form action={action} className={className} onSubmit={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}>
      {children}
    </form>
  );
}
