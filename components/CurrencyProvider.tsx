"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  DEFAULT_CURRENCY,
  isCurrencyCode,
  toCurrencyCode,
  type CurrencyCode,
} from "@/lib/currencies";
import {
  convertAmount,
  fetchRates,
  missingPairs,
  rateKey,
  sumConverted,
  type AmountRow,
  type ConvertedTotal,
  type RateMap,
  type RatePair,
} from "@/lib/fx";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "fin.main-currency";
/** Kept under the API route limit so a long month never fails as one request. */
const BATCH_SIZE = 100;

type CurrencyContextValue = {
  mainCurrency: CurrencyCode;
  setMainCurrency: (currency: CurrencyCode) => Promise<void>;
  /** Preference resolved from the database (localStorage value shows meanwhile). */
  ready: boolean;
  rates: RateMap;
  /** Fetches whatever is missing to express these rows in the main currency. */
  loadRates: (rows: AmountRow[], to?: CurrencyCode) => Promise<RateMap>;
  convert: (amount: number | string, currency: string, date: string) => number | null;
  /** True when no source could quote that currency on that date. */
  noQuote: (currency: string, date: string) => boolean;
  sum: (rows: AmountRow[]) => ConvertedTotal;
  format: (value: number | string | null | undefined, currency?: CurrencyCode) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [mainCurrency, setMainCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [ready, setReady] = useState(false);
  const [rates, setRates] = useState<RateMap>({});

  const mainCurrencyRef = useRef(mainCurrency);
  mainCurrencyRef.current = mainCurrency;
  const ratesRef = useRef<RateMap>({});
  const inflight = useRef(new Map<string, Promise<RateMap>>());
  /** Pairs no source could quote — retrying them on every render would loop forever. */
  const unavailable = useRef(new Set<string>());

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (isCurrencyCode(cached)) setMainCurrencyState(cached);

    let active = true;
    async function loadPreference() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (active) setReady(true);
        return;
      }
      const { data } = await supabase
        .from("user_preferences")
        .select("main_currency")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      const next = toCurrencyCode(data?.main_currency);
      setMainCurrencyState(next);
      localStorage.setItem(STORAGE_KEY, next);
      setReady(true);
    }
    void loadPreference();
    return () => {
      active = false;
    };
  }, [supabase]);

  const setMainCurrency = useCallback(
    async (next: CurrencyCode) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, main_currency: next }, { onConflict: "user_id" });
      if (error) throw error;
      setMainCurrencyState(next);
      localStorage.setItem(STORAGE_KEY, next);
    },
    [supabase],
  );

  const loadRates = useCallback(async (rows: AmountRow[], to?: CurrencyCode) => {
    const target = to ?? mainCurrencyRef.current;
    const pairs = missingPairs(rows, target, ratesRef.current).filter(
      (pair) => !unavailable.current.has(rateKey(pair.from, pair.to, pair.date)),
    );
    if (pairs.length === 0) return ratesRef.current;

    const running: Promise<RateMap>[] = [];
    const fresh: RatePair[] = [];
    for (const pair of pairs) {
      const pending = inflight.current.get(rateKey(pair.from, pair.to, pair.date));
      if (pending) running.push(pending);
      else fresh.push(pair);
    }

    let failed = false;
    const started = chunk(fresh, BATCH_SIZE).map((group) => {
      const request = fetchRates(group).catch(() => {
        failed = true;
        return {} as RateMap;
      });
      for (const pair of group) {
        inflight.current.set(rateKey(pair.from, pair.to, pair.date), request);
      }
      return request.finally(() => {
        for (const pair of group) {
          inflight.current.delete(rateKey(pair.from, pair.to, pair.date));
        }
      });
    });

    const results = await Promise.all([...running, ...started]);
    if (failed) toast.error("Não foi possível buscar as cotações");

    const merged = Object.assign({}, ratesRef.current, ...results) as RateMap;
    for (const pair of pairs) {
      const key = rateKey(pair.from, pair.to, pair.date);
      if (!merged[key]) unavailable.current.add(key);
    }
    ratesRef.current = merged;
    setRates(merged);
    return merged;
  }, []);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      mainCurrency,
      setMainCurrency,
      ready,
      rates,
      loadRates,
      convert: (amount, currency, date) =>
        convertAmount(amount, currency, mainCurrency, date, rates),
      noQuote: (currency, date) =>
        unavailable.current.has(rateKey(toCurrencyCode(currency), mainCurrency, date)),
      sum: (rows) => sumConverted(rows, mainCurrency, rates),
      format: (val, currency) => formatCurrency(val, currency ?? mainCurrency),
    }),
    [mainCurrency, setMainCurrency, ready, rates, loadRates],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

/** Keeps the rates needed to show these rows in the main currency loaded. */
export function useRowRates(rows: AmountRow[]) {
  const { loadRates, mainCurrency } = useCurrency();
  useEffect(() => {
    if (rows.length === 0) return;
    void loadRates(rows);
  }, [rows, mainCurrency, loadRates]);
}
