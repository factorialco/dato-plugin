type Country =
  | "us"
  | "mx"
  | "br"
  | "ar"
  | "co"
  | "es"
  | "fr"
  | "de"
  | "gb"
  | "it"
  | "pt"
  | "nl"
  | "se"
  | "ch"
  | "be"
  | "at";

type Region = "area_a" | "area_b" | "europe" | "world" | "world_top";

type Currency = "EUR" | "USD" | "GBP" | "MXN" | "BRL" | "COP" | "ARS";

type CurrencyFormatLocale = "en-US" | "en-GB" | "es-ES" | "pt-BR" | "de-DE";

export type Plan = {
  name: string;
  priceInCents: number;
  config: {
    country: Country | null;
    region: Region | null;
    currency: Currency;
    currencyFormatLocale: CurrencyFormatLocale;
    pricingModel: "flat_fee" | "per_unit" | "volume";
  };
};
