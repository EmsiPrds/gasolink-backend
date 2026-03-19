import type { SourceDefinition } from "./types";

/**
 * Starter source registry.
 *
 * Important: accuracy-first design means sources must be individually versioned and parsed.
 * This registry is intentionally config-driven so you can tighten/expand the list safely.
 */
export const sources: SourceDefinition[] = [
  // OFFICIAL (highest confidence) — DOE
  {
    id: "doe_oil_monitor_listing",
    sourceType: "official_local",
    sourceName: "DOE Oil Monitor (listing)",
    url: "https://doe.gov.ph/articles/group/liquid-fuels?category=Oil+Monitor&display_type=Card",
    scrapeMode: "static_html",
    parserId: "doe_listing_v1",
  },
  {
    id: "doe_retail_pump_prices_listing",
    sourceType: "official_local",
    sourceName: "DOE Retail Pump Prices (listing)",
    url: "https://doe.gov.ph/site/vfo/articles/group/liquid-fuels?category=Retail+Pump+Prices&display_type=Card",
    scrapeMode: "static_html",
    parserId: "doe_listing_v1",
  },
  {
    id: "doe_ncr_pump_prices_listing",
    sourceType: "official_local",
    sourceName: "DOE NCR Pump Prices (listing)",
    url: "https://doe.gov.ph/articles/group/liquid-fuels?display_type=Card&maincat=Retail+Pump+Prices&subcategory=NCR+Pump+Prices",
    scrapeMode: "static_html",
    parserId: "doe_listing_v1",
  },
  {
    id: "doe_notices_releases",
    sourceType: "official_local",
    sourceName: "DOE Notices & Releases",
    url: "https://doe.gov.ph/articles/group/notices-and-releases",
    scrapeMode: "static_html",
    parserId: "doe_notices_v1",
  },
  {
    id: "doe_services_retail_pump_prices_quality",
    sourceType: "official_local",
    sourceName: "DOE Services (Retail Pump Prices & Quality)",
    url: "https://doe.gov.ph/site/oimb/articles/group/services?category=Retail+Pump+Prices+And+Quality+Services+Application&display_type=Card",
    scrapeMode: "static_html",
    parserId: "doe_services_v1",
  },

  // COMPANY ADVISORY (medium-high confidence) — replace with official company advisory pages.
  { id: "petron_site", sourceType: "company_advisory", sourceName: "Petron (site)", url: "https://www.petron.com", scrapeMode: "static_html", parserId: "company_generic_v1" },
  { id: "shell_site", sourceType: "company_advisory", sourceName: "Shell PH (site)", url: "https://www.shell.com.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
  { id: "caltex_site", sourceType: "company_advisory", sourceName: "Caltex PH (site)", url: "https://www.caltex.com/ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
  { id: "seaoil_site", sourceType: "company_advisory", sourceName: "SeaOil (site)", url: "https://www.seaoil.com.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
  { id: "phoenix_site", sourceType: "company_advisory", sourceName: "Phoenix (site)", url: "https://www.phoenixfuels.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
  { id: "cleanfuel_site", sourceType: "company_advisory", sourceName: "Cleanfuel (site)", url: "https://cleanfuel.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
  { id: "unioil_site", sourceType: "company_advisory", sourceName: "Unioil (site)", url: "https://www.unioil.com", scrapeMode: "static_html", parserId: "company_generic_v1" },
  { id: "jetti_site", sourceType: "company_advisory", sourceName: "Jetti (site)", url: "https://www.jetti.com.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
  { id: "ptt_site", sourceType: "company_advisory", sourceName: "PTT PH (site)", url: "https://www.pttphils.com", scrapeMode: "static_html", parserId: "company_generic_v1" },
  { id: "total_site", sourceType: "company_advisory", sourceName: "TotalEnergies PH (site)", url: "https://totalenergies.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },

  // COMPANY/FACEBOOK (best-effort no-login; text+links only)
  { id: "petron_fb", sourceType: "company_advisory", sourceName: "Petron (Facebook)", url: "https://www.facebook.com/PetronCorporation", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },
  { id: "shell_fb", sourceType: "company_advisory", sourceName: "Shell (Facebook)", url: "https://www.facebook.com/Shell", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },
  { id: "caltex_fb", sourceType: "company_advisory", sourceName: "Caltex PH (Facebook)", url: "https://www.facebook.com/CaltexPhilippines", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },
  { id: "seaoil_fb", sourceType: "company_advisory", sourceName: "SeaOil (Facebook)", url: "https://www.facebook.com/seaoilphilippines", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },
  { id: "phoenix_fb", sourceType: "company_advisory", sourceName: "Phoenix (Facebook)", url: "https://www.facebook.com/PhoenixPetroleum", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },
  { id: "doe_fb", sourceType: "official_local", sourceName: "DOE (Facebook)", url: "https://www.facebook.com/DOEPhilippines", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },

  // NEWS (advisory corroboration)
  { id: "gma_news", sourceType: "company_advisory", sourceName: "GMA News", url: "https://www.gmanetwork.com/news/", scrapeMode: "static_html", parserId: "news_generic_v1" },
  { id: "abs_cbn_news", sourceType: "company_advisory", sourceName: "ABS-CBN News", url: "https://news.abs-cbn.com", scrapeMode: "static_html", parserId: "news_generic_v1" },
  { id: "philstar", sourceType: "company_advisory", sourceName: "Philstar", url: "https://www.philstar.com", scrapeMode: "static_html", parserId: "news_generic_v1" },
  { id: "inquirer", sourceType: "company_advisory", sourceName: "Inquirer", url: "https://newsinfo.inquirer.net", scrapeMode: "static_html", parserId: "news_generic_v1" },
  { id: "manila_bulletin", sourceType: "company_advisory", sourceName: "Manila Bulletin", url: "https://mb.com.ph", scrapeMode: "static_html", parserId: "news_generic_v1" },

  // OBSERVED (lower confidence) — structured trackers only
  { id: "zigwheels_fuel_price", sourceType: "observed_station", sourceName: "Zigwheels PH fuel price", url: "https://www.zigwheels.ph/fuel-price", scrapeMode: "static_html", parserId: "zigwheels_v1" },
];

