"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { addMonths } from "@/lib/format";

type MonthContextValue = {
  year: number;
  month: number;
  go: (delta: number) => void;
  set: (year: number, month: number) => void;
};

const MonthContext = createContext<MonthContextValue | null>(null);

const STORAGE_KEY = "fin.selected-month";

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const [y, m] = stored.split("-").map(Number);
    if (y >= 2000 && m >= 1 && m <= 12) {
      setYear(y);
      setMonth(m);
    }
  }, []);

  const set = useCallback((y: number, m: number) => {
    setYear(y);
    setMonth(m);
    localStorage.setItem(STORAGE_KEY, `${y}-${m}`);
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = addMonths(year, month, delta);
      set(next.year, next.month);
    },
    [year, month, set],
  );

  return (
    <MonthContext.Provider value={{ year, month, go, set }}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth(): MonthContextValue {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used within MonthProvider");
  return ctx;
}
