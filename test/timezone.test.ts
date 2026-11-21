import { describe, expect, it } from 'vitest';
import { computeTimezoneOffset, formatOffsetMinutes, isValidTimezone } from '../src/core/timezone';

describe('IANA Timezone & UTC Offset Calculator', () => {
  it('validates IANA timezone identifiers accurately', () => {
    expect(isValidTimezone('Asia/Kolkata')).toBe(true);
    expect(isValidTimezone('Asia/Kuala_Lumpur')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Europe/London')).toBe(true);
    expect(isValidTimezone('Invalid/Timezone')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone(null as unknown as string)).toBe(false);
  });

  it('formats offset minutes correctly', () => {
    expect(formatOffsetMinutes(330)).toBe('UTC+05:30');
    expect(formatOffsetMinutes(-300)).toBe('UTC-05:00');
    expect(formatOffsetMinutes(0)).toBe('UTC+00:00');
    expect(formatOffsetMinutes(345)).toBe('UTC+05:45'); // Nepal
    expect(formatOffsetMinutes(480)).toBe('UTC+08:00'); // Malaysia
  });

  it('calculates exact UTC date and offset for India Standard Time (no DST)', () => {
    // 15 May 1985 at 14:30:25 IST
    const res = computeTimezoneOffset(1985, 5, 15, 14, 30, 25, 'Asia/Kolkata');
    expect(res.offsetMinutes).toBe(330);
    expect(res.offsetSeconds).toBe(19800);
    expect(res.offsetString).toBe('UTC+05:30');
    expect(res.utcDateTimeString).toBe('1985-05-15T09:00:25.000Z');
    expect(res.isDst).toBe(false);
  });

  it('calculates Malaysia time and handles historical transitions', () => {
    // Current Malaysia: UTC+08:00
    const resModern = computeTimezoneOffset(2024, 7, 15, 14, 30, 25, 'Asia/Kuala_Lumpur');
    expect(resModern.offsetMinutes).toBe(480);
    expect(resModern.offsetString).toBe('UTC+08:00');
    expect(resModern.utcDateTimeString).toBe('2024-07-15T06:30:25.000Z');

    // Historical Malaysia (1980, before 1982 alignment): UTC+07:30
    const resHistorical = computeTimezoneOffset(1980, 6, 15, 12, 0, 0, 'Asia/Kuala_Lumpur');
    expect(resHistorical.offsetMinutes).toBe(450);
    expect(resHistorical.offsetString).toBe('UTC+07:30');
  });

  it('accurately computes Daylight Saving Time (DST) for America/New_York', () => {
    // Winter: Standard Time (EST = UTC-05:00)
    const winter = computeTimezoneOffset(2024, 1, 15, 12, 0, 0, 'America/New_York');
    expect(winter.offsetMinutes).toBe(-300);
    expect(winter.offsetString).toBe('UTC-05:00');
    expect(winter.isDst).toBe(false);

    // Summer: Daylight Saving Time (EDT = UTC-04:00)
    const summer = computeTimezoneOffset(2024, 7, 15, 12, 0, 0, 'America/New_York');
    expect(summer.offsetMinutes).toBe(-240);
    expect(summer.offsetString).toBe('UTC-04:00');
    expect(summer.isDst).toBe(true);
  });

  it('accurately computes British Summer Time (BST) for Europe/London', () => {
    // Winter: GMT (UTC+00:00)
    const winter = computeTimezoneOffset(2024, 1, 15, 12, 0, 0, 'Europe/London');
    expect(winter.offsetMinutes).toBe(0);
    expect(winter.offsetString).toBe('UTC+00:00');
    expect(winter.isDst).toBe(false);

    // Summer: BST (UTC+01:00)
    const summer = computeTimezoneOffset(2024, 7, 15, 12, 0, 0, 'Europe/London');
    expect(summer.offsetMinutes).toBe(60);
    expect(summer.offsetString).toBe('UTC+01:00');
    expect(summer.isDst).toBe(true);
  });

  it('provides a warning for birth years prior to 1970', () => {
    const res = computeTimezoneOffset(1965, 8, 10, 10, 0, 0, 'Asia/Kolkata');
    expect(res.warnings).toBeDefined();
    expect(res.warnings![0]).toContain('before 1970');
  });

  it('rejects nonexistent local time during DST spring-forward transition without guessing', () => {
    // 2024-03-10 at 02:30:00 in New York does not exist (clocks jumped from 01:59:59 to 03:00:00)
    expect(() => computeTimezoneOffset(2024, 3, 10, 2, 30, 0, 'America/New_York')).toThrow(
      'does not exist in timezone "America/New_York" due to a daylight saving time spring-forward transition'
    );
  });

  it('warns on ambiguous local time during DST fall-back transition', () => {
    // 2024-11-03 at 01:30:00 in New York occurs twice
    const res = computeTimezoneOffset(2024, 11, 3, 1, 30, 0, 'America/New_York');
    expect(res.warnings).toBeDefined();
    expect(res.warnings?.some((w) => w.includes('Ambiguous local time'))).toBe(true);
  });

  it('throws an error for unrecognized timezones', () => {
    expect(() => computeTimezoneOffset(1985, 5, 15, 14, 30, 25, 'Invalid/Zone')).toThrow(
      'Invalid or unsupported IANA timezone identifier'
    );
  });
});
