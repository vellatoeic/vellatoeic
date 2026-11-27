import Icon from "@/components/Icon";
import { COURSES, PARTS, LECTURE_COURSES, TIME_SLOTS, cohortLabel, type Part } from "@/lib/config";
import { listLectures, currentCohort, isPreview } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { editLecture, removeLecture } from "@/app/actions";
import LoginForm from "../LoginForm";
import AdminTabs from "../AdminTabs";
import UploadForm from "./UploadForm";
import LectureBoard, { type BoardRowView } from "./LectureBoard";
import { BOARD_ROWS, dateLabel, defaultTitle, liveRowId, rowStatus, sessionNo } from "@/lib/lectureBoard";
import { scheduleDays } from "@/lib/classCalendar";
import { safe } from "@/lib/safe";
import CloseOnSubmitForm from "../CloseOnSubmitForm";
import { classCohortNow } from "@/lib/classCohort";
import { cohortUntil } from "@/lib/viewWindowServer";
import { todayKST } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function Lectures({ searchParams }: { searchParams: Promise<{ old?: string; d?: string }> }) {
  if (!(await isAdmin())) return <LoginForm preview={isPreview} />;
  const { old, d } = await searchParams;
  const now = await classCohortNow(); // 강의는 지금 수업 중인 기수가 기본
  const all = await listLectures();
  const today = todayKST();

  // '오늘 수업 링크' 판: 고른 날짜(기본 오늘)의 수업 기수 · 시간표 6칸
  const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  const dayCohort = day === today ? now : await classCohortNow(day);
  const [startDays, solveDays] = await Promise.all([
    safe("lectures.startDays", () => scheduleDays(dayCohort, "start-all"), [] as string[]),
    safe("lectures.solveDays", () => scheduleDays(dayCohort, "solve-all"), [] as string[]),
  ]);
  const classDays = [...new Set([...startDays, ...solveDays])].sort();
  const prevDay = classDays.filter((x) => x < day).at(-1) ?? null;
  const nextDay = classDays.find((x) => x > day) ?? null;
  const isClassDay = classDays.includes(day);
  const hhmm = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(11, 16);
  const live = day === today ? liveRowId(hhmm) : null;
  const rows: BoardRowView[] = BOARD_ROWS.map((r) => {
    const st = rowStatus(r, all, dayCohort, day);
    const no = sessionNo(r.courses.includes("start") ? startDays : solveDays, day);
    return {
      id: r.id, slot: r.slot, time: `${r.from}~${r.to}`, label: r.label,
      to: r.courses.map((c) => COURSES[c].label).join(" + "),
      title: defaultTitle(r, day, no), done: st.done, youtubeId: st.youtubeId,
      missing: st.missing.map((c) => COURSES[c].label), live: live === r.id,
    };
  });
  const sessionText = sessionNo(startDays, day);
  const allCohorts = [...new Set([now, ...all.map((l) => l.cohort)])].sort().reverse();
  // 열람 마감(다음 달 개강 전날)이 지난 기수는 기본으로 숨겨요 (기록은 보관, '지난 기수 보기'로만)
  const pastSet = new Set((await Promise.all(allCohorts.map(async (c) => (c !== now && (await cohortUntil(c)) < today ? c : null)))).filter((c): c is string => !!c));
  const pastCount = all.filter((l) => pastSet.has(l.cohort)).length;
  const cohorts = old ? allCohorts : allCohorts.filter((c) => !pastSet.has(c));

  return (
    <div className="space-y-6 pt-8">
      <AdminTabs active="lectures" />

      <div className="card space-y-2 text-sm text-slate-600">
        <p className="font-jua text-lg text-sky-ink">유튜브 업로드 방법</p>
        <p>1. 유튜브에 강의를 올릴 때 공개 범위를 <b className="text-sky-deep">&apos;일부 공개&apos;</b>로 선택해요.</p>
        <p>2. 영상 링크를 복사해서 아래 시간표 칸에 붙여넣으면 끝! 반·RC/LC·오전반/저녁반·제목은 자동이에요.</p>
        <p>3. 해당 기수에서 그 반을 신청하고 납부가 확인된 학생에게만 보여요.</p>
        <p>4. 가장 최근에 올린 링크가 학생 강의실 &apos;라이브 바로가기&apos;에 바로 연결돼요. (오전반 학생은 오전반 링크, 저녁반 학생은 저녁반 링크)</p>
      </div>

      <nav className="flex flex-wrap items-center gap-2 text-sm">
        {prevDay ? <a href={`/admin/lectures?d=${prevDay}`} className="btn-ghost !px-3 !py-1.5 inline-flex items-center gap-1"><Icon name="chevronLeft" size={14} />{dateLabel(prevDay)}</a> : <span />}
        <form className="flex items-center gap-2">
          <input type="date" name="d" defaultValue={day} className="input !w-44 !py-1.5" />
          <button className="btn-ghost !px-3 !py-1.5">보기</button>
        </form>
        {day !== today && <a href="/admin/lectures" className="font-bold text-sky-deep underline">오늘로</a>}
        {nextDay && <a href={`/admin/lectures?d=${nextDay}`} className="btn-ghost !px-3 !py-1.5 ml-auto inline-flex items-center gap-1">{dateLabel(nextDay)}<Icon name="chevronRight" size={14} /></a>}
      </nav>
      {!isClassDay && <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700">{dateLabel(day)}은 [일정표]에 없는 날이에요. 보강·특별 수업이면 그대로 올려도 돼요.</p>}
      <LectureBoard cohort={dayCohort} date={day} dateText={`${cohortLabel(dayCohort)} ${sessionText ? `${sessionText}회 · ` : ""}${dateLabel(day)}`} rows={rows} />

      <details className="card !p-4">
        <summary className="cursor-pointer font-jua text-lg text-sky-ink">직접 골라 올리기 (방학 시간표·특별 수업)</summary>
        <div className="mt-3"><UploadForm defaultCohort={now} /></div>
      </details>

      {pastSet.size > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-500">
          <Icon name="parcel" size={16} className="mr-1" />열람 기간이 끝난 지난 기수 {pastSet.size}개 (강의 {pastCount}개) {old ? "도 함께 보고 있어요" : "는 숨겨 뒀어요"}
          <a href={old ? "/admin/lectures" : "/admin/lectures?old=1"} className="ml-auto font-bold text-sky-deep underline">{old ? "지난 기수 숨기기" : "지난 기수 보기"}</a>
        </p>
      )}

      {cohorts.map((c) => {
        const ls = all.filter((l) => l.cohort === c);
        if (ls.length === 0) return null;
        return (
          <section key={c} className="card">
            <h2 className="font-jua text-2xl text-sky-ink">{cohortLabel(c)}</h2>
            {LECTURE_COURSES.map((course) =>
              (Object.keys(PARTS) as Part[]).map((part) => {
                const list = ls.filter((l) => l.course === course && l.part === part);
                if (list.length === 0) return null;
                return (
                  <div key={course + part} className="mt-4">
                    <p className="font-jua mb-2 text-sky-deep">
                      {COURSES[course].label} {PARTS[part]} · {list.length}개
                    </p>
                    <ol className="space-y-2">
                      {list.map((l, i) => (
                        <li key={l.id} className="rounded-2xl bg-sky-soft px-4 py-2">
                          <details className="group">
                            <summary className="flex list-none items-center gap-3">
                              <span className={`font-jua shrink-0 rounded-full px-2 py-0.5 text-xs ${l.slot ? "bg-white text-sky-deep" : "bg-amber-100 text-amber-700"}`}>{l.slot ? TIME_SLOTS[l.slot] : `${i + 1} · 구분 없음`}</span>
                              <a
                                href={`https://youtu.be/${l.youtube_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 text-slate-800 hover:underline"
                              >
                                {l.title}
                              </a>
                              <span className="cursor-pointer text-xs text-slate-500 hover:text-sky-deep group-open:text-sky-deep">수정</span>
                              <form action={removeLecture}>
                                <input type="hidden" name="id" value={l.id} />
                                <button className="text-xs text-slate-400 hover:text-red-500">삭제</button>
                              </form>
                            </summary>
                            <CloseOnSubmitForm action={editLecture} className="mt-3 grid gap-2 rounded-xl bg-white p-3 text-sm">
                              <input type="hidden" name="id" value={l.id} />
                              <label><span className="text-xs text-slate-500">강의 제목</span><input name="title" defaultValue={l.title} required className="input !py-2" /></label>
                              <label><span className="text-xs text-slate-500">유튜브 링크</span><input name="url" defaultValue={`https://youtu.be/${l.youtube_id}`} required className="input !py-2" /></label>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <label><span className="text-xs text-slate-500">기수</span><input type="month" name="cohort" defaultValue={l.cohort} required className="input !py-2" /></label>
                                <label><span className="text-xs text-slate-500">반</span>
                                  <select name="course" defaultValue={l.course} className="input !py-2">
                                    {LECTURE_COURSES.map((co) => <option key={co} value={co}>{COURSES[co].label}</option>)}
                                  </select>
                                </label>
                                <label><span className="text-xs text-slate-500">오전/저녁</span>
                                  <select name="slot" defaultValue={l.slot ?? ""} required className="input !py-2">
                                    {!l.slot && <option value="" disabled>선택</option>}
                                    <option value="am">오전반</option>
                                    <option value="pm">저녁반</option>
                                  </select>
                                </label>
                                <label><span className="text-xs text-slate-500">RC/LC</span>
                                  <select name="part" defaultValue={l.part} className="input !py-2">
                                    {(Object.keys(PARTS) as Part[]).map((p) => <option key={p} value={p}>{PARTS[p]}</option>)}
                                  </select>
                                </label>
                              </div>
                              <button className="btn !py-2 !text-sm">수정 저장</button>
                            </CloseOnSubmitForm>
                          </details>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              }),
            )}
          </section>
        );
      })}
    </div>
  );
}
