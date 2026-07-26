"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMonths } from "@/lib/format";

/** Redirects to month-wrap once when previous month wasn't closed yet. */
export function MonthWrapGate() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const now = new Date();
      const prevMonth = addMonths(now.getFullYear(), now.getMonth() + 1, -1);

      const { data: closing } = await supabase
        .from("month_closings")
        .select("id")
        .eq("user_id", user.id)
        .eq("year", prevMonth.year)
        .eq("month", prevMonth.month)
        .maybeSingle();

      if (closing || cancelled) return;

      const start = `${prevMonth.year}-${String(prevMonth.month).padStart(2, "0")}-01`;
      const lastDay = new Date(prevMonth.year, prevMonth.month, 0).getDate();
      const end = `${prevMonth.year}-${String(prevMonth.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const [{ count: expCount }, { count: incCount }] = await Promise.all([
        supabase
          .from("expenses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),
        supabase
          .from("incomes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),
      ]);

      if (cancelled) return;
      if ((expCount ?? 0) + (incCount ?? 0) === 0) return;

      const key = `wrap-shown-${prevMonth.year}-${prevMonth.month}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      router.push(`/month-wrap?year=${prevMonth.year}&month=${prevMonth.month}`);
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
