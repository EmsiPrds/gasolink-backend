"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sources = void 0;
/**
 * Starter source registry.
 *
 * Important: accuracy-first design means sources must be individually versioned and parsed.
 * This registry is intentionally config-driven so you can tighten/expand the list safely.
 */
exports.sources = [
    // OFFICIAL (highest confidence) - DOE
    {
        id: "doe_oil_monitor_listing",
        sourceType: "official_local",
        sourceName: "DOE Oil Monitor (listing)",
        url: "https://doe.gov.ph/site/oimb/articles/group/liquid-fuels?category=Oil+Monitor&display_type=Card",
        scrapeMode: "static_html",
        parserId: "doe_listing_v1",
    },
    {
        id: "doe_price_adjustments_listing",
        sourceType: "official_local",
        sourceName: "DOE Retail Pump Prices - Price Adjustments (listing)",
        url: "https://doe.gov.ph/articles/group/liquid-fuels?display_type=Card&maincat=Retail+Pump+Prices&subcategory=Price+Adjustments",
        scrapeMode: "static_html",
        parserId: "doe_listing_v1",
    },
    {
        id: "doe_ncr_pump_prices_listing",
        sourceType: "official_local",
        sourceName: "DOE NCR Pump Prices (listing)",
        url: "https://doe.gov.ph/articles/group/liquid-fuels?maincat=Retail%20Pump%20Prices&subcategory=NCR%20Pump%20Prices&display_type=Card",
        scrapeMode: "dynamic_browser",
        parserId: "doe_listing_v1",
    },
    {
        id: "doe_south_luzon_pump_prices_listing",
        sourceType: "official_local",
        sourceName: "DOE South Luzon Pump Prices (listing)",
        url: "https://doe.gov.ph/articles/group/liquid-fuels?maincat=Retail%20Pump%20Prices&subcategory=South%20Luzon%20Pump%20Prices&display_type=Card",
        scrapeMode: "dynamic_browser",
        parserId: "doe_listing_v1",
    },
    {
        id: "doe_north_luzon_pump_prices_listing",
        sourceType: "official_local",
        sourceName: "DOE North Luzon Pump Prices (listing)",
        url: "https://doe.gov.ph/articles/group/liquid-fuels?maincat=Retail%20Pump%20Prices&subcategory=North%20Luzon%20Pump%20Prices&display_type=Card",
        scrapeMode: "dynamic_browser",
        parserId: "doe_listing_v1",
    },
    {
        id: "doe_visayas_pump_prices_listing",
        sourceType: "official_local",
        sourceName: "DOE Visayas Pump Prices (listing)",
        url: "https://doe.gov.ph/articles/group/liquid-fuels?maincat=Retail%20Pump%20Prices&subcategory=Visayas%20Pump%20Prices&display_type=Card",
        scrapeMode: "dynamic_browser",
        parserId: "doe_listing_v1",
    },
    {
        id: "doe_mindanao_pump_prices_listing",
        sourceType: "official_local",
        sourceName: "DOE Mindanao Pump Prices (listing)",
        url: "https://doe.gov.ph/articles/group/liquid-fuels?maincat=Retail%20Pump%20Prices&subcategory=Mindanao%20Pump%20Prices&display_type=Card",
        scrapeMode: "dynamic_browser",
        parserId: "doe_listing_v1",
    },
    // COMPANY ADVISORY (medium-high confidence) - replace with official company advisory pages.
    { id: "petron_site", sourceType: "company_advisory", sourceName: "Petron (site)", url: "https://www.petron.com", scrapeMode: "static_html", parserId: "company_generic_v1" },
    { id: "shell_site", sourceType: "company_advisory", sourceName: "Shell PH (site)", url: "https://www.shell.com.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
    { id: "caltex_site", sourceType: "company_advisory", sourceName: "Caltex PH (site)", url: "https://www.caltex.com/ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
    { id: "seaoil_site", sourceType: "company_advisory", sourceName: "SeaOil (site)", url: "https://www.seaoil.com.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
    { id: "phoenix_site", sourceType: "company_advisory", sourceName: "Phoenix (site)", url: "https://www.phoenixfuels.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
    { id: "cleanfuel_site", sourceType: "company_advisory", sourceName: "Cleanfuel (site)", url: "https://cleanfuel.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
    { id: "unioil_site", sourceType: "company_advisory", sourceName: "Unioil (site)", url: "https://www.unioil.com", scrapeMode: "static_html", parserId: "company_generic_v1" },
    { id: "jetti_site", sourceType: "company_advisory", sourceName: "Jetti (site)", url: "https://www.jetti.com.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
    { id: "ptt_site", sourceType: "company_advisory", sourceName: "PTT PH (site)", url: "https://www.pttphils.com/news-advisory/", scrapeMode: "static_html", parserId: "company_generic_v1" },
    { id: "total_site", sourceType: "company_advisory", sourceName: "TotalEnergies PH (site)", url: "https://totalenergies.com.ph", scrapeMode: "static_html", parserId: "company_generic_v1" },
    // COMPANY/FACEBOOK (best-effort no-login; text+links only)
    { id: "petron_fb", sourceType: "company_advisory", sourceName: "Petron (Facebook)", url: "https://www.facebook.com/PetronCorporation", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },
    { id: "shell_fb", sourceType: "company_advisory", sourceName: "Shell (Facebook)", url: "https://www.facebook.com/Shell", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },
    { id: "caltex_fb", sourceType: "company_advisory", sourceName: "Caltex PH (Facebook)", url: "https://www.facebook.com/CaltexPhilippines", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },
    { id: "seaoil_fb", sourceType: "company_advisory", sourceName: "SeaOil (Facebook)", url: "https://www.facebook.com/seaoilphilippines", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },
    { id: "phoenix_fb", sourceType: "company_advisory", sourceName: "Phoenix (Facebook)", url: "https://www.facebook.com/PhoenixPetroleum", scrapeMode: "dynamic_browser", parserId: "fb_public_page_v1" },
    {
        id: "doe_fb",
        sourceType: "official_local",
        sourceName: "DOE (Facebook)",
        url: "https://www.facebook.com/DOEPhilippines",
        scrapeMode: "dynamic_browser",
        parserId: "ai_groq_v1",
    },
    // NEWS (advisory corroboration)
    { id: "gma_news", sourceType: "company_advisory", sourceName: "GMA News", url: "https://www.gmanetwork.com/news/", scrapeMode: "static_html", parserId: "ai_groq_v1" },
    { id: "abs_cbn_news", sourceType: "company_advisory", sourceName: "ABS-CBN News", url: "https://news.abs-cbn.com", scrapeMode: "dynamic_browser", parserId: "ai_groq_v1" },
    { id: "philstar", sourceType: "company_advisory", sourceName: "Philstar", url: "https://www.philstar.com", scrapeMode: "static_html", parserId: "ai_groq_v1" },
    { id: "inquirer", sourceType: "company_advisory", sourceName: "Inquirer", url: "https://newsinfo.inquirer.net", scrapeMode: "static_html", parserId: "ai_groq_v1" },
    { id: "manila_bulletin", sourceType: "company_advisory", sourceName: "Manila Bulletin", url: "https://mb.com.ph", scrapeMode: "static_html", parserId: "ai_groq_v1" },
    // OBSERVED (lower confidence)
    // Disabled for now until a dedicated `zigwheels_v1` parser is implemented.
    // { id: "zigwheels_fuel_price", sourceType: "observed_station", sourceName: "Zigwheels PH fuel price", url: "https://www.zigwheels.ph/fuel-price", scrapeMode: "static_html", parserId: "zigwheels_v1" },
];
