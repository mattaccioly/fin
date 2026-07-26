import { toISODate, parseLocalDate } from "@/lib/format";

/** Active days = expense dates ∪ no-spend days (YYYY-MM-DD). */
export function computeStreak(
  activeDates: string[],
  today: Date = new Date(),
): { current: number; best: number } {
  const set = new Set(activeDates);
  if (set.size === 0) return { current: 0, best: 0 };

  const sorted = [...set].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseLocalDate(sorted[i - 1]);
    const curr = parseLocalDate(sorted[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  // Current streak: walk back from today (or yesterday if today not yet logged)
  const todayIso = toISODate(today);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!set.has(todayIso)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let current = 0;
  while (set.has(toISODate(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, best: Math.max(best, current) };
}
