// The restaurant's clock: dates and times are shown and validated in this zone, not the guest's
export const RESTAURANT_TIME_ZONE = 'America/Chicago';

// The most guests one online booking can hold
export const MAX_PARTY_SIZE = 10;

// Today's date in the restaurant's zone as YYYY-MM-DD (en-CA formats dates that way)
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// "17:30" becomes "5:30 PM"
export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return time;
  }
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// "2026-12-05" becomes "Saturday, December 5, 2026"; formatted in UTC so the day never shifts
export function formatDateLabel(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number);
  if (!y || !mo || !d) {
    return iso;
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(Date.UTC(y, mo - 1, d)));
}

// Splits an ISO timestamp into the date and time labels in the restaurant's zone
export function formatStart(startDate: string | null | undefined): { date: string; time: string } {
  // A missing start gives empty labels (new Date(null) would read as 1970)
  if (typeof startDate !== 'string' || !startDate.trim()) {
    return { date: '', time: '' };
  }
  const at = new Date(startDate);
  if (Number.isNaN(at.getTime())) {
    return { date: startDate, time: '' };
  }
  return {
    date: new Intl.DateTimeFormat('en-US', {
      timeZone: RESTAURANT_TIME_ZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(at),
    time: new Intl.DateTimeFormat('en-US', {
      timeZone: RESTAURANT_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
    }).format(at),
  };
}

export function guestsLabel(count: number): string {
  return count === 1 ? '1 guest' : `${count} guests`;
}

// 125 seconds becomes "2:05"
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The API's spelling of "canceled" is not fixed, so match either form
export function isCanceled(status: string): boolean {
  return /^cancel/i.test(status);
}
