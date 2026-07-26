import { toCurrencyCode, type CurrencyCode } from "@/lib/currencies";

export type RatePair = { from: CurrencyCode; to: CurrencyCode; date: string };

/** Rates keyed by `from>to@date`, expressed as: 1 unit of `from` = rate units of `to`. */
export type RateMap = Record<string, number>;

export type AmountRow = {
  amount: number | string;
  currency?: string | null;
  date: string;
};

export function rateKey(from: string, to: string, date: string): string {
  return `${from}>${to}@${date}`;
}

/** Converted value, or null when the rate for that date has not been loaded yet. */
export function convertAmount(
  amount: number | string,
  from: string,
  to: CurrencyCode,
  date: string,
  rates: RateMap,
): number | null {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return 0;
  const source = toCurrencyCode(from);
  if (source === to) return value;
  const rate = rates[rateKey(source, to, date)];
  if (!rate) return null;
  return value * rate;
}

export type ConvertedTotal = {
  /** Sum of every row that could be converted. */
  total: number;
  /** Rows still waiting for a rate. */
  missing: number;
};

export function sumConverted(
  rows: AmountRow[],
  to: CurrencyCode,
  rates: RateMap,
): ConvertedTotal {
  let total = 0;
  let missing = 0;
  for (const row of rows) {
    const converted = convertAmount(row.amount, row.currency ?? to, to, row.date, rates);
    if (converted === null) missing += 1;
    else total += converted;
  }
  return { total, missing };
}

/** Distinct (currency, date) pairs that still need a rate to be summable in `to`. */
export function missingPairs(rows: AmountRow[], to: CurrencyCode, rates: RateMap): RatePair[] {
  const seen = new Set<string>();
  const pairs: RatePair[] = [];
  for (const row of rows) {
    const from = toCurrencyCode(row.currency ?? to);
    if (from === to || !row.date) continue;
    const key = rateKey(from, to, row.date);
    if (rates[key] || seen.has(key)) continue;
    seen.add(key);
    pairs.push({ from, to, date: row.date });
  }
  return pairs;
}

export async function fetchRates(pairs: RatePair[]): Promise<RateMap> {
  if (pairs.length === 0) return {};
  const res = await fetch("/api/fx", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairs }),
  });
  if (!res.ok) throw new Error("fx request failed");
  const json = (await res.json()) as { rates?: RateMap };
  return json.rates ?? {};
}
