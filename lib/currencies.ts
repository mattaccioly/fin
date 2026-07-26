export const SUPPORTED_CURRENCIES = [
  "BRL",
  "EUR",
  "USD",
  "GBP",
  "CLP",
  "DKK",
  "PEN",
  "CNY",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "BRL";

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  BRL: "Real brasileiro",
  EUR: "Euro",
  USD: "Dólar americano",
  GBP: "Libra esterlina",
  CLP: "Peso chileno",
  DKK: "Coroa dinamarquesa",
  PEN: "Sol peruano",
  CNY: "Yuan chinês",
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  BRL: "R$",
  EUR: "€",
  USD: "US$",
  GBP: "£",
  CLP: "CLP$",
  DKK: "kr",
  PEN: "S/",
  CNY: "¥",
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function toCurrencyCode(
  value: unknown,
  fallback: CurrencyCode = DEFAULT_CURRENCY,
): CurrencyCode {
  return isCurrencyCode(value) ? value : fallback;
}
