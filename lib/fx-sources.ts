import type { CurrencyCode } from "@/lib/currencies";

/**
 * Daily FX rates for a past date, tried in order:
 *  1. Yahoo Finance chart (quotes every cross directly, but rate-limits hard)
 *  2. currency-api on jsDelivr (all our currencies, daily, from 2024 on)
 *  3. Frankfurter/ECB (deep history, no CLP or PEN)
 */

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

/** Yahoo rejects requests without a browser-like agent. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/** Days of history requested before the target date, to survive weekends and holidays. */
const LOOKBACK_DAYS = 12;

type Bar = { date: string; close: number };

function epochSeconds(isoDate: string, offsetDays: number): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d + offsetDays) / 1000);
}

async function getJSON(url: string, headers?: Record<string, string>): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function yahooSymbolRate(symbol: string, date: string): Promise<number | null> {
  const url = `${YAHOO_CHART}/${symbol}?period1=${epochSeconds(date, -LOOKBACK_DAYS)}&period2=${epochSeconds(date, 2)}&interval=1d`;
  const json = (await getJSON(url, { "User-Agent": USER_AGENT, Accept: "application/json" })) as {
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[] }[] };
      }[];
    };
  } | null;

  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  let best: Bar | null = null;
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) continue;
    const barDate = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    if (barDate > date) continue;
    if (!best || barDate >= best.date) best = { date: barDate, close };
  }
  return best?.close ?? null;
}

async function yahooRate(
  from: CurrencyCode,
  to: CurrencyCode,
  date: string,
): Promise<number | null> {
  const direct = await yahooSymbolRate(`${from}${to}=X`, date);
  if (direct) return direct;

  // Exotic crosses are not quoted directly; pivot through the USD legs, which always are.
  const usdToFrom = from === "USD" ? 1 : await yahooSymbolRate(`USD${from}=X`, date);
  const usdToQuote = to === "USD" ? 1 : await yahooSymbolRate(`USD${to}=X`, date);
  if (!usdToFrom || !usdToQuote) return null;
  return usdToQuote / usdToFrom;
}

/** One table per (base, date) is reused across pairs of the same request. */
const tableCache = new Map<string, Record<string, number> | null>();
const TABLE_CACHE_LIMIT = 60;

function rememberTable(key: string, table: Record<string, number> | null) {
  if (tableCache.size >= TABLE_CACHE_LIMIT) {
    const oldest = tableCache.keys().next().value;
    if (oldest !== undefined) tableCache.delete(oldest);
  }
  tableCache.set(key, table);
}

async function currencyApiTable(
  base: CurrencyCode,
  date: string,
): Promise<Record<string, number> | null> {
  const key = `${base}@${date}`;
  const cached = tableCache.get(key);
  if (cached !== undefined) return cached;

  const code = base.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const versions = date >= today ? [date, "latest"] : [date];
  const urls = versions.flatMap((version) => [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${version}/v1/currencies/${code}.json`,
    `https://${version}.currency-api.pages.dev/v1/currencies/${code}.json`,
  ]);

  for (const url of urls) {
    const json = (await getJSON(url)) as Record<string, unknown> | null;
    const table = json?.[code];
    if (table && typeof table === "object") {
      const parsed = table as Record<string, number>;
      rememberTable(key, parsed);
      return parsed;
    }
  }

  rememberTable(key, null);
  return null;
}

async function currencyApiRate(
  from: CurrencyCode,
  to: CurrencyCode,
  date: string,
): Promise<number | null> {
  const table = await currencyApiTable(from, date);
  const rate = table?.[to.toLowerCase()];
  return typeof rate === "number" && rate > 0 ? rate : null;
}

async function frankfurterRate(
  from: CurrencyCode,
  to: CurrencyCode,
  date: string,
): Promise<number | null> {
  const json = (await getJSON(
    `https://api.frankfurter.app/${date}?from=${from}&to=${to}`,
  )) as { rates?: Record<string, number> } | null;
  const rate = json?.rates?.[to];
  return typeof rate === "number" && rate > 0 ? rate : null;
}

/** 1 unit of `from` expressed in `to`, using the rate of `date` (YYYY-MM-DD). */
export async function fetchHistoricalRate(
  from: CurrencyCode,
  to: CurrencyCode,
  date: string,
): Promise<number | null> {
  if (from === to) return 1;
  return (
    (await yahooRate(from, to, date)) ??
    (await currencyApiRate(from, to, date)) ??
    (await frankfurterRate(from, to, date))
  );
}
