"use client";

import Icon from "@/components/Icon";
import Link from "next/link";
import { useMemo, useState } from "react";
import { GRADE_LABEL, seenLabel, type Grade } from "@/lib/grades";
import type { RosterRow } from "@/lib/rosterServer";

// 관리 [학생 명단]: 칩(등급·수강 월·레벨·로그인)으로 고르고, 이름·번호·휴대폰으로 바로 찾기. 기본은 최근 신청순.
type GradeFilter = "all" | Grade;
type Level = "all" | "start" | "solve" | "intensive";
type LoginFilter = "all" | "kakao" | "google" | "none";
type Sort = "recent" | "seen";

const LEVELS: [Level, string][] = [["all", "전체"], ["start", "시작반 650+"], ["solve", "문풀반 750+"], ["intensive", "속성반 750+"]];
const LOGINS: [LoginFilter, string][] = [["all", "전체"], ["kakao", "카카오"], ["google", "구글"], ["none", "연결 안 함"]];
const VIA: Record<string, string> = { pin: "이름+비밀번호", kakao: "카카오", google: "구글" };
const monthOf = (c: string) => `${Number(c.slice(5, 7))}월`;
const time = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const phoneText = (p: string | null) => (p ? p.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3") : "-");
const active = (s: string) => s !== "refunded" && s !== "cancelled";

export default function RosterTable({ rows, cohorts, today, initialGrade }: { rows: RosterRow[]; cohorts: string[]; today: string; initialGrade: GradeFilter }) {
  const [grade, setGrade] = useState<GradeFilter>(initialGrade);
  const [month, setMonth] = useState<string>("all");
  const [level, setLevel] = useState<Level>("all");
  const [login, setLogin] = useState<LoginFilter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [q, setQ] = useState("");
  const [news, setNews] = useState(false); // '벨라토익 소식 받을게요' 동의한 학생만
  const [copied, setCopied] = useState("");

  const recentCohorts = cohorts.slice(0, 5);
  const by = {
    grade: (r: RosterRow, g: GradeFilter) => g === "all" || r.grades.includes(g),
    month: (r: RosterRow, m: string) => m === "all" || r.months.some((x) => x.cohort === m && active(x.status)),
    level: (r: RosterRow, l: Level) => l === "all" || r.course === l,
    login: (r: RosterRow, l: LoginFilter) => l === "all" || (l === "none" ? r.providers.length === 0 : r.providers.includes(l)),
    q: (r: RosterRow) => !q.trim() || r.search.includes(q.replace(/[\s-]/g, "")),
    news: (r: RosterRow) => !news || !!r.guest?.optIn,
  };
  // 칩 숫자: 다른 칩 조건은 그대로 두고 그 칩만 바꿨을 때의 인원
  const count = (patch: Partial<{ grade: GradeFilter; month: string; level: Level; login: LoginFilter }>) => {
    const f = { grade, month, level, login, ...patch };
    return rows.filter((r) => by.grade(r, f.grade) && by.month(r, f.month) && by.level(r, f.level) && by.login(r, f.login) && by.q(r) && by.news(r)).length;
  };
  const shown = useMemo(() => {
    const list = rows.filter((r) => by.grade(r, grade) && by.month(r, month) && by.level(r, level) && by.login(r, login) && by.q(r) && by.news(r));
    return sort === "seen" ? [...list].sort((x, y) => (y.lastSeenAt ?? "").localeCompare(x.lastSeenAt ?? "")) : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, grade, month, level, login, sort, q, news]);
  // 소식 받기 동의한 학생 번호 복사 (보이는 명단 중 동의한 사람만, 한 줄에 '이름 번호')
  const optedIn = shown.filter((r) => r.guest?.optIn && r.phone);
  const copyPhones = async () => {
    const text = optedIn.map((r) => `${r.name}\t${phoneText(r.phone)}`).join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(`${optedIn.length}명 복사했어요`); } catch { setCopied("복사하지 못했어요"); }
  };

  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm font-bold ${on ? "bg-sky-deep text-white" : "bg-white text-sky-ink ring-1 ring-sky-main"}`;
  const n = (v: number) => <span className="ml-1 opacity-70">{v}</span>;

  return (
    <div className="space-y-3">
      <div className="card space-y-2.5 !p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-xs font-bold text-slate-500">등급</span>
          {(["all", "student", "pre", "general", "prospect"] as GradeFilter[]).map((g) => (
            <button key={g} type="button" onClick={() => setGrade(g)} className={chip(grade === g)}>{g === "all" ? "전체" : GRADE_LABEL[g]}{n(count({ grade: g }))}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-xs font-bold text-slate-500">수강 월</span>
          <button type="button" onClick={() => setMonth("all")} className={chip(month === "all")}>전체{n(count({ month: "all" }))}</button>
          {recentCohorts.map((c) => <button key={c} type="button" onClick={() => setMonth(c)} className={chip(month === c)}>{monthOf(c)}{n(count({ month: c }))}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-xs font-bold text-slate-500">레벨</span>
          {LEVELS.map(([l, label]) => <button key={l} type="button" onClick={() => setLevel(l)} className={chip(level === l)}>{label}{n(count({ level: l }))}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-xs font-bold text-slate-500">로그인</span>
          {LOGINS.map(([l, label]) => <button key={l} type="button" onClick={() => setLogin(l)} className={chip(login === l)}>{label}{n(count({ login: l }))}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-xs font-bold text-slate-500">소식</span>
          <button type="button" onClick={() => setNews(!news)} className={chip(news)}>벨라토익 소식 받기 동의만{n(rows.filter((r) => r.guest?.optIn).length)}</button>
          {news && optedIn.length > 0 && <button type="button" onClick={copyPhones} className="rounded-full bg-sky-soft px-3 py-1.5 text-sm font-bold text-sky-ink">동의한 {optedIn.length}명 번호 복사</button>}
          {copied && <span className="text-xs font-bold text-emerald-600">{copied}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 · 개인번호 · 휴대폰으로 찾기" className="input !w-64 !py-2" />
          <div className="ml-auto flex gap-1 rounded-full bg-sky-soft p-1 text-sm">
            {([["recent", "최근 신청순"], ["seen", "최근 접속순"]] as [Sort, string][]).map(([s, label]) => (
              <button key={s} type="button" onClick={() => setSort(s)} className={`rounded-full px-3 py-1 font-bold ${sort === s ? "bg-white text-sky-ink shadow" : "text-slate-500"}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <p className="px-1 text-sm text-slate-500"><b className="text-sky-ink">{shown.length}명</b> · 이름을 누르면 학생 정보가 열려요</p>

      <ul className="card divide-y divide-sky-soft !p-0">
        {shown.length === 0 && <li className="p-6 text-center text-slate-500">조건에 맞는 학생이 없어요.</li>}
        {shown.map((r) => (
          <li key={r.key} className="grid gap-2 p-3 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,14rem)] lg:items-center lg:gap-4 lg:px-4">
            {/* 사진 · 이름 · 개인번호 · 등급 */}
            <div className="flex items-center gap-3">
              {r.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.photo} alt="" referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-sky-main" loading="lazy" />
              ) : (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-soft font-jua text-lg text-sky-deep">{r.name.slice(0, 1)}</span>
              )}
              <div className="min-w-0">
                {r.appId ? <Link href={`/admin/students/${r.appId}`} className="font-bold text-sky-ink underline decoration-sky-main underline-offset-2">{r.name}</Link> : <b className="text-sky-ink">{r.name}</b>}
                {r.no && <span className="ml-1.5 text-xs font-bold tracking-wider text-slate-400">#{r.no}</span>}
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {r.grades.includes("student") && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">수강생 · {r.current.map(monthOf).join("·")}</span>}
                  {r.pre.map((p) => (
                    <span key={p.cohort} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${p.pending ? "bg-amber-100 text-amber-700" : "bg-sky-main/60 text-sky-ink"}`}>{monthOf(p.cohort)} 예비{p.pending ? " · 입금 대기" : ""}</span>
                  ))}
                  {r.grades.includes("general") && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">일반</span>}
                  {r.grades.includes("prospect") && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">잠재 고객</span>}
                  {r.guest?.optIn && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">소식 동의</span>}
                </div>
              </div>
            </div>
            {/* 수강 이력 (최근 달이 위, 최근 3개) */}
            <div className="space-y-0.5 text-sm">
              {r.months.slice(0, 3).map((m) => (
                <p key={m.appId} className={active(m.status) ? "text-slate-700" : "text-slate-400 line-through"}>
                  {m.label}
                  {m.status === "pending" && <span className="ml-1 text-xs font-bold text-amber-600">입금 대기</span>}
                  {!active(m.status) && <span className="ml-1 text-xs no-underline">{m.statusLabel}</span>}
                </p>
              ))}
              {r.months.length > 3 && <p className="text-xs text-slate-400">그 전 {r.months.length - 3}개월 더</p>}
              {r.guest && r.guest.specials.length > 0 && <p className="text-violet-700">특강(비수강생) · {r.guest.specials.slice(0, 2).join(" · ")}{r.guest.specials.length > 2 ? ` 외 ${r.guest.specials.length - 2}` : ""}</p>}
              {r.exam && <p className="text-slate-600">모의고사 <b className="text-sky-ink">{r.exam.total}점</b> <span className="text-xs text-slate-400">({Number(r.exam.date.slice(5, 7))}/{Number(r.exam.date.slice(8, 10))}{r.exam.count > 1 ? ` · ${r.exam.count}회` : ""})</span></p>}
            </div>
            {/* 로그인 · 최근 접속 · 휴대폰 */}
            <div className="space-y-0.5 text-xs text-slate-500">
              <p className="flex flex-wrap items-center gap-1">
                {r.providers.length === 0 ? (r.grades.includes("prospect") ? null : <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-500">이름+비밀번호</span>) : r.providers.map((p) => (
                  <span key={p} className={`rounded-full px-2 py-0.5 font-bold ${p === "kakao" ? "bg-[#fee500] text-[#3c1e1e]" : "bg-white text-slate-700 ring-1 ring-slate-300"}`}>{p === "kakao" ? "카카오" : "구글"}</span>
                ))}
                <span className="ml-1">접속 <b className="text-sky-ink">{seenLabel(r.lastSeenAt, today)}</b></span>
              </p>
              {r.lastLoginAt && <p>마지막 로그인 {VIA[r.lastVia ?? ""] ?? ""} · {time(r.lastLoginAt)}</p>}
              <p>{phoneText(r.phone)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
