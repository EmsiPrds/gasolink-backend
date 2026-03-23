import type { FuelType } from "../../models/enums";

export type FuelDelta = { fuelType: FuelType; delta: number };

function parseNumber(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function extractFuelDeltas(text: string): FuelDelta[] {
  const deltas: FuelDelta[] = [];
  const patterns: Array<{ fuelType: FuelType; re: RegExp }> = [
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
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text))) {
      const sign = m[2] === "-" ? -1 : 1;
      const amt = parseNumber(m[3]);
      if (amt === null) continue;
      deltas.push({ fuelType: p.fuelType, delta: sign * amt });
    }
  }

  // Deduplicate by fuelType keeping last seen (often the most specific)
  const byFuel = new Map<FuelType, number>();
  for (const d of deltas) byFuel.set(d.fuelType, d.delta);
  return Array.from(byFuel.entries()).map(([fuelType, delta]) => ({ fuelType, delta }));
}

export function extractEffectivity(text: string): Date | null {
  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  const monthPattern = months.join("|");

  // Pattern: "effective 05:00 a.m. of 23 March 2026"
  const re1 = new RegExp(`effective.*?([0-9]{1,2})\\s+(${monthPattern})\\s+([0-9]{4})`, "i");
  const m1 = text.match(re1);
  if (m1) {
    const d = Date.parse(`${m1[1]} ${m1[2]} ${m1[3]} UTC`);
    if (Number.isFinite(d)) return new Date(d);
  }

  // Pattern: "As of March 23, 2026"
  const re2 = new RegExp(`as of\\s+(${monthPattern})\\s+([0-9]{1,2}),?\\s+([0-9]{4})`, "i");
  const m2 = text.match(re2);
  if (m2) {
    const d = Date.parse(`${m2[2]} ${m2[1]} ${m2[3]} UTC`);
    if (Number.isFinite(d)) return new Date(d);
  }

  return null;
}

