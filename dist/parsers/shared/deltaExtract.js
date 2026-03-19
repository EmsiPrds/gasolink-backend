"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFuelDeltas = extractFuelDeltas;
exports.extractEffectivity = extractEffectivity;
function parseNumber(s) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}
function extractFuelDeltas(text) {
    const deltas = [];
    const patterns = [
        {
            fuelType: "Gasoline",
            re: /(gasoline|gas)(?:oline)?[^0-9+\-]*([+\-])\s*(?:₱|P)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
        },
        {
            fuelType: "Diesel",
            re: /(diesel)[^0-9+\-]*([+\-])\s*(?:₱|P)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
        },
        {
            fuelType: "Kerosene",
            re: /(kerosene|kerosine)[^0-9+\-]*([+\-])\s*(?:₱|P)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
        },
    ];
    for (const p of patterns) {
        let m;
        while ((m = p.re.exec(text))) {
            const sign = m[2] === "-" ? -1 : 1;
            const amt = parseNumber(m[3]);
            if (amt === null)
                continue;
            deltas.push({ fuelType: p.fuelType, delta: sign * amt });
        }
    }
    // Deduplicate by fuelType keeping last seen (often the most specific)
    const byFuel = new Map();
    for (const d of deltas)
        byFuel.set(d.fuelType, d.delta);
    return Array.from(byFuel.entries()).map(([fuelType, delta]) => ({ fuelType, delta }));
}
function extractEffectivity(text) {
    // Best-effort: recognize common PH news formats; fail closed if not found.
    // Examples: "effective March 19, 2026", "effective on Mar. 19, 2026 6:00 AM"
    const re = /(effective(?:\s+on)?|takes?\s+effect(?:\s+on)?)\s+([A-Za-z]{3,9}\.?\s+\d{1,2},\s+\d{4})(?:\s+at\s+(\d{1,2}:\d{2})\s*(AM|PM))?/i;
    const m = text.match(re);
    if (!m)
        return null;
    const datePart = m[2];
    const timePart = m[3];
    const ampm = m[4];
    const base = new Date(datePart);
    if (!Number.isFinite(base.getTime()))
        return null;
    if (timePart && ampm) {
        const [hhStr, mmStr] = timePart.split(":");
        let hh = Number(hhStr);
        const mm = Number(mmStr);
        if (!Number.isFinite(hh) || !Number.isFinite(mm))
            return base;
        const upper = ampm.toUpperCase();
        if (upper === "PM" && hh < 12)
            hh += 12;
        if (upper === "AM" && hh === 12)
            hh = 0;
        base.setHours(hh, mm, 0, 0);
    }
    return base;
}
