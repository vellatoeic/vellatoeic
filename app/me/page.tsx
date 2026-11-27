import Link from "next/link";
import { COURSES, KINDS, TRACKS, TIME_SLOTS, cohortLabel } from "@/lib/config";
import { listLoginLinks, type LoginLink } from "@/lib/db";
import { myProfileState } from "@/lib/profileServer";
import { loginSetup } from "@/lib/socialServer";
import { PROVIDER_LABEL } from "@/lib/socialLogin";
import { phoneLabel, reasonLabel } from "@/lib/profile";
import { safe } from "@/lib/safe";
import SocialButtons from "@/components/SocialButtons";
import Icon from "@/components/Icon";
import StudentLogin from "@/app/class/StudentLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 정보 · vella_toeic", robots: { index: false } };

// 학생 '내 정보' (메뉴 '수강생 전용'): 이름 · 개인번호 · 수강 반 · 휴대폰 · 목표 점수 · 공부 이유 · 로그인 연결 (각 칸 [바꾸기] → /welcome?s=…&edit=1)
export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const state = await myProfileState();
  if (!state) return <StudentLogin next="/me" note="교재 신청할 때 만든 계정으로 들어와요." />;
  const { saved } = await searchParams;
  const { apps, no, profile } = state;
  const name = apps[0]?.name ?? "";
  const accounts = [...new Set(apps.map((a) => a.account_id).filter((x): x is string => !!x))];
  const links = await safe("me.links", () => listLoginLinks(accounts), [] as LoginLink[]);
  const { providers } = await loginSetup();
  const sorted = [...apps].sort((a, b) => b.cohort.localeCompare(a.cohort));

  const Row = ({ label, value, edit, empty = "아직 안 적었어요" }: { label: string; value: React.ReactNode; edit?: string; empty?: string }) => (
    <div className="flex items-center gap-3 py-3">
      <span className="w-20 shrink-0 text-sm text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 font-bold text-sky-ink">{value || <span className="font-normal text-slate-400">{empty}</span>}</span>
      {edit && <Link href={`/welcome?s=${edit}&edit=1`} className="shrink-0 rounded-full bg-sky-soft px-3 py-1 text-xs font-bold text-sky-deep">바꾸기</Link>}
    </div>
  );

  return (
    <div className="stagger wide space-y-5 pt-8">
      <h1 className="flex items-center gap-2 font-jua text-3xl text-sky-ink"><Icon name="people" size={36} />내 정보</h1>
      {saved && <p className="card !bg-emerald-50 text-center font-bold text-emerald-700">저장했어요</p>}

      <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-5">
          <section className="rounded-3xl bg-gradient-to-br from-[#4fb3e8] via-sky-deep to-[#1f78ad] p-5 text-white shadow-[0_10px_26px_rgba(43,143,199,0.3)]">
            <p className="text-sm opacity-85">{name}님의 개인번호</p>
            <p className="font-jua text-5xl tracking-[0.25em] tabular-nums">{no ?? "준비 중"}</p>
            <p className="mt-2 text-sm opacity-95">모의고사 답안지 앞면 &apos;수험번호&apos; 칸에 적어요.</p>
            <Link href="/class/scores" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm font-bold">
              <Icon name="trophy" size={18} />모의고사 결과 보기 ›
            </Link>
          </section>

          <section className="card divide-y divide-sky-soft !py-2">
            <Row label="이름" value={name} />
            <Row label="휴대폰" value={phoneLabel(profile?.phone ?? null)} edit="phone" />
            <Row label="목표 점수" value={profile?.target_score ? `${profile.target_score}점` : ""} edit="target" />
            <Row label="공부 이유" value={profile?.reasons?.length ? [...profile.reasons.map(reasonLabel), ...(profile.reason_note ? [`(${profile.reason_note})`] : [])].join(" · ") : ""} edit="reason" />
          </section>
        </div>

        <div className="space-y-5">
          <section className="card space-y-2">
            <p className="font-jua text-lg text-sky-ink">수강 반</p>
            {sorted.map((a) => (
              <p key={a.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-sky-soft px-4 py-2.5 text-sm">
                <b className="text-sky-ink">{cohortLabel(a.cohort)}</b>
                <span className="text-slate-700">{COURSES[a.course].label} {TRACKS[a.track]}{a.slot ? ` · ${TIME_SLOTS[a.slot]}` : ""} · {KINDS[a.kind].short}</span>
                <span className={`ml-auto text-xs font-bold ${a.status === "pending" ? "text-amber-600" : "text-emerald-700"}`}>{a.status === "pending" ? "입금 확인 중" : "납부 완료"}</span>
              </p>
            ))}
          </section>

          <section className="card space-y-3">
            <p className="font-jua text-lg text-sky-ink">로그인 연결</p>
            {links.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {links.map((l) => (
                  <li key={`${l.provider}:${l.subject}`} className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 font-bold text-emerald-700">
                    <Icon name="check" size={16} />{PROVIDER_LABEL[l.provider]} 연결됨{l.email || l.nickname ? <span className="font-normal text-slate-500">· {l.email ?? l.nickname}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">아직 연결한 계정이 없어요. 연결하면 다음부터 버튼 하나로 들어와요.</p>
            )}
            {providers.length > 0 && <SocialButtons providers={providers.filter((p) => !links.some((l) => l.provider === p))} next="/me" link />}
          </section>
        </div>
      </div>
    </div>
  );
}
