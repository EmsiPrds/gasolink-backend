"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = require("../config/db");
const env_1 = require("../config/env");
const AdminUser_1 = require("../models/AdminUser");
const Alert_1 = require("../models/Alert");
const CompanyPrice_1 = require("../models/CompanyPrice");
const FinalPublishedFuelPrice_1 = require("../models/FinalPublishedFuelPrice");
const FuelPricePH_1 = require("../models/FuelPricePH");
const GlobalPrice_1 = require("../models/GlobalPrice");
const Insight_1 = require("../models/Insight");
const NormalizedFuelRecord_1 = require("../models/NormalizedFuelRecord");
const RawScrapedSource_1 = require("../models/RawScrapedSource");
const UpdateLog_1 = require("../models/UpdateLog");
const enums_1 = require("../models/enums");
const companies = [
    "Petron",
    "Shell",
    "Caltex",
    "SeaOil",
    "Phoenix",
    "Cleanfuel",
    "Unioil",
    "Jetti",
];
function round2(n) {
    return Math.round(n * 100) / 100;
}
function seededWave(base, dayIndex, amplitude) {
    const wave = Math.sin(dayIndex / 6) * amplitude;
    const drift = (dayIndex - 45) * 0.01;
    return base + wave + drift;
}
async function main() {
    await (0, db_1.connectDb)();
    await Promise.all([
        AdminUser_1.AdminUser.deleteMany({}),
        Alert_1.Alert.deleteMany({}),
        CompanyPrice_1.CompanyPrice.deleteMany({}),
        FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.deleteMany({}),
        FuelPricePH_1.FuelPricePH.deleteMany({}),
        GlobalPrice_1.GlobalPrice.deleteMany({}),
        Insight_1.Insight.deleteMany({}),
        NormalizedFuelRecord_1.NormalizedFuelRecord.deleteMany({}),
        RawScrapedSource_1.RawScrapedSource.deleteMany({}),
        UpdateLog_1.UpdateLog.deleteMany({}),
    ]);
    const adminEmail = env_1.env.SEED_ADMIN_EMAIL ?? "admin@gasolink.local";
    const adminPassword = env_1.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
    const passwordHash = await bcrypt_1.default.hash(adminPassword, 12);
    const admin = await AdminUser_1.AdminUser.create({
        name: "Gasolink Admin",
        email: adminEmail,
        passwordHash,
        role: "admin",
    });
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 89);
    const globalDocs = [];
    for (let i = 0; i < 90; i++) {
        const ts = new Date(start);
        ts.setDate(start.getDate() + i);
        const brent = seededWave(82, i, 4.3);
        const wti = seededWave(78, i, 4.0);
        const usdp = seededWave(56.2, i, 0.25);
        const prevTs = new Date(ts);
        prevTs.setDate(ts.getDate() - 1);
        const prevBrent = seededWave(82, i - 1, 4.3);
        const prevWti = seededWave(78, i - 1, 4.0);
        const prevUsdp = seededWave(56.2, i - 1, 0.25);
        globalDocs.push({
            type: "Brent",
            value: round2(brent),
            changePercent: round2(((brent - prevBrent) / prevBrent) * 100),
            timestamp: ts,
        }, {
            type: "WTI",
            value: round2(wti),
            changePercent: round2(((wti - prevWti) / prevWti) * 100),
            timestamp: ts,
        }, {
            type: "USDPHP",
            value: round2(usdp),
            changePercent: round2(((usdp - prevUsdp) / prevUsdp) * 100),
            timestamp: ts,
        });
    }
    await GlobalPrice_1.GlobalPrice.insertMany(globalDocs);
    const phDocs = [];
    for (const region of enums_1.RegionValues) {
        for (const fuelType of enums_1.FuelTypeValues) {
            const base = fuelType === "Gasoline" ? 63.5 : fuelType === "Diesel" ? 56.2 : 69.1;
            const regionBump = region === "NCR" ? 0 : region === "Luzon" ? 0.4 : region === "Visayas" ? 1.1 : 1.6;
            const weeklyChange = round2((Math.random() - 0.45) * 2.8);
            phDocs.push({
                fuelType,
                price: round2(base + regionBump + weeklyChange),
                weeklyChange,
                region,
                source: "Seeded demo data",
                status: region === "NCR" ? "Verified" : "Advisory",
                updatedAt: now,
            });
        }
    }
    await FuelPricePH_1.FuelPricePH.insertMany(phDocs);
    // Seed accuracy-first pipeline tables with a small published view so the UI can show transparency.
    const raw1 = await RawScrapedSource_1.RawScrapedSource.create({
        sourceType: "official_local",
        sourceName: "Seeded official source",
        sourceUrl: "https://example.com/doe/seed",
        parserId: "doe_article_v1",
        rawHtml: "<html><body>seed</body></html>",
        scrapedAt: now,
        parserVersion: "v1",
        processingStatus: "raw",
    });
    const normalizedSeed = await NormalizedFuelRecord_1.NormalizedFuelRecord.create({
        sourceType: "official_local",
        statusLabel: "Official",
        confidenceScore: 1.0,
        fuelType: "Gasoline",
        region: "NCR",
        pricePerLiter: 63.5,
        priceChange: 0.75,
        currency: "PHP",
        sourceName: "Seeded official source",
        sourceUrl: "https://example.com/doe/seed",
        sourcePublishedAt: now,
        scrapedAt: now,
        effectiveAt: now,
        updatedAt: now,
        fingerprint: "seed:fingerprint:gasoline:ncr",
        rawSourceId: raw1._id,
        supportingSources: [
            {
                sourceName: "Seeded official source",
                sourceUrl: "https://example.com/doe/seed",
                sourceType: "official_local",
                sourcePublishedAt: now,
                scrapedAt: now,
                parserVersion: "v1",
            },
        ],
    });
    await FinalPublishedFuelPrice_1.FinalPublishedFuelPrice.create({
        displayType: "ph_final",
        fuelType: "Gasoline",
        region: "NCR",
        finalPrice: 63.5,
        priceChange: 0.75,
        currency: "PHP",
        supportingSources: [
            {
                normalizedRecordId: normalizedSeed._id,
                sourceType: "official_local",
                sourceName: "Seeded official source",
                sourceUrl: "https://example.com/doe/seed",
                sourcePublishedAt: now,
                scrapedAt: now,
                parserVersion: "v1",
                confidenceScore: 1.0,
                statusLabel: "Official",
            },
        ],
        finalStatus: "Official",
        confidenceScore: 1.0,
        lastVerifiedAt: now,
        updatedAt: now,
        publishKey: "seed:publishKey:gasoline:ncr",
    });
    const companyDocs = [];
    for (const region of enums_1.RegionValues) {
        for (const company of companies) {
            for (const fuelType of enums_1.FuelTypeValues) {
                const base = fuelType === "Gasoline" ? 63.8 : fuelType === "Diesel" ? 56.4 : 69.3;
                const regionBump = region === "NCR" ? 0 : region === "Luzon" ? 0.5 : region === "Visayas" ? 1.2 : 1.8;
                const companyBump = (companies.indexOf(company) - 3) * 0.12;
                const noise = (Math.random() - 0.5) * 0.6;
                const status = company === "Petron" || company === "Shell" ? "Verified" : "Advisory";
                companyDocs.push({
                    companyName: company,
                    fuelType,
                    price: round2(base + regionBump + companyBump + noise),
                    region,
                    city: region === "NCR" ? "Metro Manila" : undefined,
                    status,
                    source: "Seeded demo data",
                    verifiedBy: status === "Verified" ? admin._id : undefined,
                    updatedAt: now,
                });
            }
        }
    }
    await CompanyPrice_1.CompanyPrice.insertMany(companyDocs);
    await Insight_1.Insight.insertMany([
        {
            title: "Global oil prices moved up this week",
            message: "Brent and WTI are slightly higher. If this continues, local fuel prices may adjust next week. This is a guide, not a guarantee.",
            category: "weekly",
            status: "active",
            createdAt: now,
        },
        {
            title: "Diesel prices look steady",
            message: "Diesel prices in many areas are holding steady. Small changes can still happen depending on the weekly update.",
            category: "diesel",
            status: "active",
            createdAt: now,
        },
    ]);
    await Alert_1.Alert.insertMany([
        {
            title: "Weekly PH update window",
            message: "Local fuel prices in the Philippines usually update weekly. Check the status badges: Verified, Advisory, or Estimate.",
            level: "info",
            active: true,
            createdAt: now,
        },
        {
            title: "Major movement watch",
            message: "If Brent or WTI moves sharply within a day, local pump prices may be affected in the next adjustment cycle.",
            level: "warning",
            active: true,
            createdAt: now,
        },
    ]);
    await UpdateLog_1.UpdateLog.create({
        module: "seed",
        status: "success",
        message: "Database seeded with demo data",
        timestamp: now,
    });
    console.log("Seed complete.");
    console.log(`Admin login: ${adminEmail}`);
    console.log(`Admin password: ${adminPassword}`);
    console.log("IMPORTANT: change the admin password after first login.");
}
main()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error("Seed failed", err);
    process.exit(1);
});
