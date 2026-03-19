import { z } from "zod";

export const PeriodSchema = z
  .union([z.literal("7"), z.literal("30"), z.literal("90"), z.number()])
  .optional()
  .transform((v) => {
    const n = typeof v === "number" ? v : v ? Number(v) : 30;
    if (![7, 30, 90].includes(n)) return 30;
    return n;
  });

export function sinceDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

