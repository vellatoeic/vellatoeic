import { todayKST } from "./config";
import { listStamps, type Application } from "./db";
import { canWatch } from "./access";
import { classDaysOf, holidaysOf } from "./classCalendar";
import { watchSummary, type WatchSummary } from "./watchlist";

// 여러 학생의 출석·숙제 요약을 한 번에 (신청 관리 줄 요약·학생 검색에 써요). 납부 완료 학생만 계산해요.
export async function summariesFor(apps: Application[]): Promise<Map<string, WatchSummary>> {
  const today = todayKST();
  const targets = apps.filter(canWatch);
  const out = new Map<string, WatchSummary>();
  if (targets.length === 0) return out;
  const { attendance, homework } = await listStamps(targets.map((a) => a.id));
  const daysCache = new Map<string, Promise<string[]>>();
  const daysOf = (a: Application) => {
    const key = `${a.cohort}|${a.course}|${a.track}`;
    if (!daysCache.has(key)) {
      daysCache.set(key, Promise.all([classDaysOf(a), holidaysOf(a.cohort)]).then(([days, holidays]) => days.filter((d) => !holidays[d])));
    }
    return daysCache.get(key)!;
  };
  for (const a of targets) {
    out.set(a.id, watchSummary(await daysOf(a), attendance.filter((x) => x.app_id === a.id), homework.filter((x) => x.app_id === a.id).map((x) => x.day), today));
  }
  return out;
}
