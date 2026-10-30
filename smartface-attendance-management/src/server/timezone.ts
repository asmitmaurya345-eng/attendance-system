/**
 * SmartFace Timezone Utilities
 * Explicit Asia/Kolkata (IST = UTC+05:30) date, shift, and grace period calculations.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns YYYY-MM-DD in the given timezone (defaults to Asia/Kolkata).
 */
export function getDateStringInTimezone(date: Date = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  // Use Intl.DateTimeFormat to reliably extract year, month, day in target timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // en-CA produces "YYYY-MM-DD"
}

/**
 * Returns HH:MM in the given timezone.
 */
export function getTimeStringInTimezone(date: Date = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date); // produces "HH:MM"
}

/**
 * Returns day of week (1=Monday, 7=Sunday) in the given timezone.
 */
export function getDayOfWeekInTimezone(date: Date = new Date(), timeZone = DEFAULT_TIMEZONE): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'narrow',
  });
  // Or compute day from date parts
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date);
  
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[parts] || 1;
}

/**
 * Creates a UTC Date representing the specified date (YYYY-MM-DD) and time (HH:MM)
 * interpreted in the given timezone (Asia/Kolkata = UTC+05:30).
 */
export function parseDateTimeInTimezone(dateStr: string, timeStr: string, timeZone = DEFAULT_TIMEZONE): Date {
  const [hour, minute] = timeStr.split(':').map(Number);
  // Asia/Kolkata offset is fixed at UTC+05:30 (no daylight saving time)
  // If timeZone is Asia/Kolkata: UTC = IST - 5h 30m
  if (timeZone === 'Asia/Kolkata') {
    const [y, m, d] = dateStr.split('-').map(Number);
    // Construct in UTC, then subtract 5 hours 30 minutes
    const utcTimestamp = Date.UTC(y, m - 1, d, hour, minute, 0, 0) - (5 * 60 + 30) * 60 * 1000;
    return new Date(utcTimestamp);
  }

  // General fallback using ISO offset if available, otherwise approximation
  const naiveIso = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  return new Date(`${naiveIso}+05:30`);
}

/**
 * Computes difference in minutes between two timestamps.
 */
export function diffInMinutes(dateA: Date, dateB: Date): number {
  return Math.round((dateA.getTime() - dateB.getTime()) / (60 * 1000));
}
