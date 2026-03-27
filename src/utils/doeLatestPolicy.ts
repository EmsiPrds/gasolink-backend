type DateLike = Date | string | null | undefined;

export function normalizeSourceUrl(url: string): string {
  return url.trim().toLowerCase().replace(/[?#].*$/, "");
}

function toValidDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function extractDoeDateFromUrl(sourceUrl: string): Date | null {
  const normalized = normalizeSourceUrl(sourceUrl);

  // Prefer MMDDYYYY (DOE common pattern).
  const mmddyyyy = normalized.match(/(?:^|[^0-9])([0-1][0-9])([0-3][0-9])(20[0-9]{2})(?:[^0-9]|$)/);
  if (mmddyyyy) {
    const month = Number(mmddyyyy[1]);
    const day = Number(mmddyyyy[2]);
    const year = Number(mmddyyyy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  // Fallback DDMMYYYY.
  const ddmmyyyy = normalized.match(/(?:^|[^0-9])([0-3][0-9])([0-1][0-9])(20[0-9]{2})(?:[^0-9]|$)/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const year = Number(ddmmyyyy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  const iso = normalized.match(/(\d{4})[-_/](\d{2})[-_/](\d{2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  return null;
}

export function resolveDoeDocumentDate(sourceUrl: string, fallbackDate?: DateLike): Date | null {
  return extractDoeDateFromUrl(sourceUrl) ?? toValidDate(fallbackDate);
}

export function isWithinDays(date: Date, now: Date, days: number): boolean {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return date >= cutoff && date <= now;
}

export function selectLatestDoeDocument<T>(
  items: T[],
  getSourceUrl: (item: T) => string,
  getFallbackDate: (item: T) => DateLike,
  now: Date,
  maxAgeDays: number,
): { sourceUrl: string; date: Date } | null {
  let latest: { sourceUrl: string; date: Date } | null = null;

  for (const item of items) {
    const sourceUrl = getSourceUrl(item);
    const docDate = resolveDoeDocumentDate(sourceUrl, getFallbackDate(item));
    if (!docDate) continue;
    if (!isWithinDays(docDate, now, maxAgeDays)) continue;
    if (!latest || docDate > latest.date) {
      latest = { sourceUrl: normalizeSourceUrl(sourceUrl), date: docDate };
    }
  }

  return latest;
}
