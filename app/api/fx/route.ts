import { NextResponse } from "next/server";
import { isCurrencyCode, type CurrencyCode } from "@/lib/currencies";
import { fetchHistoricalRate } from "@/lib/fx-sources";
import { rateKey, type RateMap, type RatePair } from "@/lib/fx";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAIRS = 120;
/** Rates for today can still move, so cached rows are refreshed after this window. */
const TODAY_TTL_MS = 6 * 60 * 60 * 1000;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parsePair(raw: unknown): RatePair | null {
  if (!raw || typeof raw !== "object") return null;
  const { from, to, date } = raw as Record<string, unknown>;
  if (!isCurrencyCode(from) || !isCurrencyCode(to)) return null;
  if (typeof date !== "string" || !ISO_DATE.test(date)) return null;
  return { from, to, date };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolveRates(supabase: SupabaseClient, pairs: RatePair[]) {
  const rates: RateMap = {};
  const wanted = new Map<string, RatePair>();

  for (const pair of pairs) {
    if (pair.from === pair.to) {
      rates[rateKey(pair.from, pair.to, pair.date)] = 1;
      continue;
    }
    wanted.set(rateKey(pair.from, pair.to, pair.date), pair);
  }
  if (wanted.size === 0) return { rates, missing: [] as RatePair[] };

  const list = [...wanted.values()];
  const { data: cached } = await supabase
    .from("fx_rates")
    .select("base, quote, rate_date, rate, fetched_at")
    .in("base", [...new Set(list.map((p) => p.from))])
    .in("quote", [...new Set(list.map((p) => p.to))])
    .in("rate_date", [...new Set(list.map((p) => p.date))]);

  const today = todayISO();
  const now = Date.now();

  for (const row of cached ?? []) {
    const key = rateKey(row.base as string, row.quote as string, row.rate_date as string);
    if (!wanted.has(key)) continue;
    const stale =
      (row.rate_date as string) >= today &&
      now - new Date(row.fetched_at as string).getTime() > TODAY_TTL_MS;
    if (stale) continue;
    rates[key] = Number(row.rate);
    wanted.delete(key);
  }

  const missing: RatePair[] = [];
  const upserts: {
    base: CurrencyCode;
    quote: CurrencyCode;
    rate_date: string;
    rate: number;
    fetched_at: string;
  }[] = [];

  for (const [key, pair] of wanted) {
    const rate = await fetchHistoricalRate(pair.from, pair.to, pair.date);
    if (rate === null || !Number.isFinite(rate) || rate <= 0) {
      missing.push(pair);
      continue;
    }
    rates[key] = rate;
    upserts.push({
      base: pair.from,
      quote: pair.to,
      rate_date: pair.date,
      rate,
      fetched_at: new Date().toISOString(),
    });
  }

  if (upserts.length > 0) {
    await supabase.from("fx_rates").upsert(upserts, { onConflict: "base,quote,rate_date" });
  }

  return { rates, missing };
}

async function handle(pairs: RatePair[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  if (pairs.length === 0) {
    return NextResponse.json({ error: "no valid pairs" }, { status: 400 });
  }
  if (pairs.length > MAX_PAIRS) {
    return NextResponse.json({ error: "too many pairs" }, { status: 400 });
  }

  const { rates, missing } = await resolveRates(supabase, pairs);
  return NextResponse.json({ rates, missing });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pair = parsePair({
    from: params.get("from"),
    to: params.get("to"),
    date: params.get("date"),
  });
  return handle(pair ? [pair] : []);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const raw = (body as { pairs?: unknown })?.pairs;
  const pairs = Array.isArray(raw)
    ? raw.map(parsePair).filter((p): p is RatePair => p !== null)
    : [];
  return handle(pairs);
}
