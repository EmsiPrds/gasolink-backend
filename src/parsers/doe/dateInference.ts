const MONTH_LOOKUP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function normalizeMonthToken(token: string): number | null {
  const month = MONTH_LOOKUP[token.trim().toLowerCase()];
  return Number.isFinite(month) ? month : null;
}

function toUtcDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function parseYearToken(token: string): number | null {
  const digits = token.trim().replace(/\D/g, "");
  if (digits.length === 4) {
    const year = Number(digits);
    return year >= 2000 && year <= 2100 ? year : null;
  }
  if (digits.length === 2) {
    const yy = Number(digits);
    return yy >= 0 && yy <= 99 ? 2000 + yy : null;
  }
  return null;
}

function buildMonthPattern(): string {
  return "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
}

export function inferDoeDocumentDateFromText(text: string): Date | null {
  const monthPattern = buildMonthPattern();

  // Example: "For the week of March 10-16, 2026"
  const sameMonthWeek = new RegExp(
    `for the week of\\s+${monthPattern}\\s+([0-9]{1,2})\\s*(?:to|-)\\s*([0-9]{1,2}),?\\s+(20[0-9]{2})`,
    "i",
  );
  const sameMonthMatch = text.match(sameMonthWeek);
  if (sameMonthMatch) {
    const month = normalizeMonthToken(sameMonthMatch[1]);
    const year = parseYearToken(sameMonthMatch[4]);
    const endDay = Number(sameMonthMatch[3]);
    if (month && year) return toUtcDate(year, month, endDay);
  }

  // Example: "For the week of February 24 to March 2, 2026"
  const crossMonthWeek = new RegExp(
    `for the week of\\s+${monthPattern}\\s+([0-9]{1,2})\\s*(?:to|-)\\s*${monthPattern}\\s+([0-9]{1,2}),?\\s+(20[0-9]{2})`,
    "i",
  );
  const crossMonthMatch = text.match(crossMonthWeek);
  if (crossMonthMatch) {
    const endMonth = normalizeMonthToken(crossMonthMatch[3]);
    const year = parseYearToken(crossMonthMatch[5]);
    const endDay = Number(crossMonthMatch[4]);
    if (endMonth && year) return toUtcDate(year, endMonth, endDay);
  }

  // Example: "As of March 23, 2026"
  const asOf = new RegExp(`as of\\s+${monthPattern}\\s+([0-9]{1,2}),?\\s+(20[0-9]{2})`, "i");
  const asOfMatch = text.match(asOf);
  if (asOfMatch) {
    const month = normalizeMonthToken(asOfMatch[1]);
    const day = Number(asOfMatch[2]);
    const year = parseYearToken(asOfMatch[3]);
    if (month && year) return toUtcDate(year, month, day);
  }

  // Example: "effective 05:00 a.m. of 23 March 2026"
  const effectiveDayMonth = new RegExp(`effective.*?([0-9]{1,2})\\s+${monthPattern}\\s+(20[0-9]{2})`, "i");
  const effectiveDayMonthMatch = text.match(effectiveDayMonth);
  if (effectiveDayMonthMatch) {
    const day = Number(effectiveDayMonthMatch[1]);
    const month = normalizeMonthToken(effectiveDayMonthMatch[2]);
    const year = parseYearToken(effectiveDayMonthMatch[3]);
    if (month && year) return toUtcDate(year, month, day);
  }

  // Example: "effective March 23, 2026"
  const effectiveMonthDay = new RegExp(`effective.*?${monthPattern}\\s+([0-9]{1,2}),?\\s+(20[0-9]{2})`, "i");
  const effectiveMonthDayMatch = text.match(effectiveMonthDay);
  if (effectiveMonthDayMatch) {
    const month = normalizeMonthToken(effectiveMonthDayMatch[1]);
    const day = Number(effectiveMonthDayMatch[2]);
    const year = parseYearToken(effectiveMonthDayMatch[3]);
    if (month && year) return toUtcDate(year, month, day);
  }

  return null;
}

export function inferDoeDocumentDateFromLabel(label: string, fallbackYear?: number | null): Date | null {
  const monthPattern = buildMonthPattern();

  // Example: "March 17 to 23"
  const sameMonthRange = new RegExp(`^\\s*${monthPattern}\\s+([0-9]{1,2})\\s*(?:to|-)\\s*([0-9]{1,2})\\s*$`, "i");
  const sameMonthMatch = label.match(sameMonthRange);
  if (sameMonthMatch && fallbackYear) {
    const month = normalizeMonthToken(sameMonthMatch[1]);
    const endDay = Number(sameMonthMatch[3]);
    if (month) return toUtcDate(fallbackYear, month, endDay);
  }

  // Example: "February 24 to March 2"
  const crossMonthRange = new RegExp(
    `^\\s*${monthPattern}\\s+([0-9]{1,2})\\s*(?:to|-)\\s*${monthPattern}\\s+([0-9]{1,2})\\s*$`,
    "i",
  );
  const crossMonthMatch = label.match(crossMonthRange);
  if (crossMonthMatch && fallbackYear) {
    const endMonth = normalizeMonthToken(crossMonthMatch[3]);
    const endDay = Number(crossMonthMatch[4]);
    if (endMonth) return toUtcDate(fallbackYear, endMonth, endDay);
  }

  return null;
}

export function inferDoeDocumentDateFromUrl(url: string): Date | null {
  // Example: "ncr-price-monitoring-03172026-pdf"
  const mmddyyyy = url.match(/(?:^|[^0-9])([0-1][0-9])([0-3][0-9])(20[0-9]{2})(?:[^0-9]|$)/);
  if (mmddyyyy) {
    const month = Number(mmddyyyy[1]);
    const day = Number(mmddyyyy[2]);
    const year = Number(mmddyyyy[3]);
    return toUtcDate(year, month, day);
  }

  // Example: "...2025_mar-18-24..."
  const yearMonthDayRange = url.match(/(20[0-9]{2})[_-](jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[_-]([0-9]{1,2})(?:[_-]([0-9]{1,2}))?/i);
  if (yearMonthDayRange) {
    const year = Number(yearMonthDayRange[1]);
    const month = normalizeMonthToken(yearMonthDayRange[2]);
    const endDay = Number(yearMonthDayRange[4] ?? yearMonthDayRange[3]);
    if (month) return toUtcDate(year, month, endDay);
  }

  // Example: "...20260319..." or "...2026-03-19..."
  const yyyymmdd = url.match(/(20[0-9]{2})[-_]?([0-1][0-9])[-_]?([0-3][0-9])/);
  if (yyyymmdd) {
    const year = Number(yyyymmdd[1]);
    const month = Number(yyyymmdd[2]);
    const day = Number(yyyymmdd[3]);
    return toUtcDate(year, month, day);
  }

  // Example: "...061725..."
  const mmddyy = url.match(/(?:^|[^0-9])([0-1][0-9])([0-3][0-9])([0-9]{2})(?:[^0-9]|$)/);
  if (mmddyy) {
    const month = Number(mmddyy[1]);
    const day = Number(mmddyy[2]);
    const year = parseYearToken(mmddyy[3]);
    if (year) return toUtcDate(year, month, day);
  }

  return null;
}
