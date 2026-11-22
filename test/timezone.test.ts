import { describe, expect, it } from 'vitest';
import {
  AmbiguousLocalTimeError,
  computeTimezoneOffset,
  formatOffsetMinutes,
  isValidTimezone,
  NonexistentLocalTimeError,
} from '../src/core/timezone';

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

/**
 * Historical offsets for `locations-select` (#12): the zone's rules at the date, not its current offset.
 *
 * Sources: the IANA tz database (`asia`, `northamerica`, `europe` and `australasia` files; Zone and Rule lines
 * named per case), checked against `zdump -v` of tzdata 2026e and against this runtime's Intl, which is
 * ICU 78.3 with tz 2026e. The expected values are the tzdb's; none was taken from the code under test.
 */
describe('historical UTC offsets (IANA tz database)', () => {
  const at = (...a: Parameters<typeof computeTimezoneOffset>) => computeTimezoneOffset(...a);

  describe('India (Asia/Kolkata)', () => {
    // tzdb asia: Zone Asia/Kolkata  5:30 - IST 1941 Oct; 5:30 1:00 +0630 1942 May 15; 5:30 - IST 1942 Sep;
    //            5:30 1:00 +0630 1945 Oct 15; 5:30 - IST
    it('+5:30 from 1950 onward and at independence, 15 Aug 1947 00:00', () => {
      expect(at(1950, 1, 1, 0, 0, 0, 'Asia/Kolkata').offsetSeconds).toBe(19800);
      expect(at(1985, 5, 15, 14, 30, 0, 'Asia/Kolkata').offsetSeconds).toBe(19800);
      const independence = at(1947, 8, 15, 0, 0, 0, 'Asia/Kolkata');
      expect(independence.offsetString).toBe('UTC+05:30');
      expect(independence.utcDateTimeString).toBe('1947-08-14T18:30:00.000Z');
    });

    it('war time 1941-1945 is +6:30 (1942-05-15 to 1942-09-01 and after 1945-10-15 are +5:30)', () => {
      expect(at(1941, 12, 1, 12, 0, 0, 'Asia/Kolkata').offsetSeconds).toBe(23400);
      expect(at(1942, 1, 1, 12, 0, 0, 'Asia/Kolkata').offsetSeconds).toBe(23400);
      expect(at(1942, 7, 1, 12, 0, 0, 'Asia/Kolkata').offsetSeconds).toBe(19800);
      expect(at(1943, 6, 1, 12, 0, 0, 'Asia/Kolkata').offsetSeconds).toBe(23400);
      expect(at(1944, 6, 1, 12, 0, 0, 'Asia/Kolkata').offsetSeconds).toBe(23400);
      expect(at(1945, 12, 1, 12, 0, 0, 'Asia/Kolkata').offsetSeconds).toBe(19800);
    });

    it('keeps the offset to the second before 1906 (MMT +5:21:10 = 19270 s)', () => {
      // tzdb asia: 5:21:10 - MMT 1906 Jan 1. The UTC instant must use the exact seconds, not a rounded minute.
      const r = at(1900, 6, 1, 12, 0, 0, 'Asia/Kolkata');
      expect(r.offsetSeconds).toBe(19270);
      expect(r.utcDateTimeString).toBe('1900-06-01T06:38:50.000Z');
    });
  });

  describe('Malaysia', () => {
    // tzdb asia: Zone Asia/Kuala_Lumpur  7:30 - +0730 1981 Dec 31 16:00u; 8:00 - +08
    it('Kuala Lumpur 1980 is +7:30, and +8:00 from 1982-01-01 00:00', () => {
      const y1980 = at(1980, 1, 1, 10, 0, 0, 'Asia/Kuala_Lumpur');
      expect(y1980.offsetString).toBe('UTC+07:30');
      expect(y1980.utcDateTimeString).toBe('1980-01-01T02:30:00.000Z');
      expect(at(1981, 12, 31, 23, 0, 0, 'Asia/Kuala_Lumpur').offsetSeconds).toBe(27000);
      const y1982 = at(1982, 1, 1, 0, 0, 0, 'Asia/Kuala_Lumpur');
      expect(y1982.offsetSeconds).toBe(28800);
      expect(y1982.utcDateTimeString).toBe('1981-12-31T16:00:00.000Z');
      expect(at(2024, 7, 15, 14, 30, 0, 'Asia/Kuala_Lumpur').offsetSeconds).toBe(28800);
    });

    it('Sabah and Sarawak (Asia/Kuching) were already +8 in 1980; Singapore was +7:30 like Malaya', () => {
      expect(at(1980, 6, 1, 12, 0, 0, 'Asia/Kuching').offsetSeconds).toBe(28800);
      expect(at(1980, 6, 1, 12, 0, 0, 'Asia/Singapore').offsetSeconds).toBe(27000);
    });
  });

  describe('daylight saving, in and before 1970', () => {
    it('US: Los Angeles 4 Jul 2024 is -7:00; New York 6 Jan 1974 03:00 is -4:00 (the 1974 energy-crisis DST began that day)', () => {
      // tzdb northamerica: Rule US 1974 only Jan 6 2:00 1:00 D; Rule US 2007 max Mar Sun>=8 2:00 1:00 D
      expect(at(2024, 7, 4, 12, 0, 0, 'America/Los_Angeles').offsetSeconds).toBe(-25200);
      expect(at(1974, 1, 6, 3, 0, 0, 'America/New_York').offsetSeconds).toBe(-14400);
      expect(at(1974, 1, 6, 1, 0, 0, 'America/New_York').offsetSeconds).toBe(-18000);
    });

    it('UK: British Standard Time was +1:00 all year from 1968-10-27 to 1971-10-31', () => {
      // tzdb europe: Zone Europe/London  ... 1:00 - BST 1971 Oct 31 2:00u
      const winter = at(1969, 1, 15, 12, 0, 0, 'Europe/London');
      expect(winter.offsetSeconds).toBe(3600);
      expect(winter.warnings?.some((w) => w.includes('before 1970'))).toBe(true);
    });
  });

  describe('a gap or an overlap is never resolved silently', () => {
    it('Kuala Lumpur 1981-12-31 23:30-23:59 does not exist (clocks went from 23:30 +7:30 to 00:00 +8)', () => {
      expect(() => at(1981, 12, 31, 23, 45, 0, 'Asia/Kuala_Lumpur')).toThrow(NonexistentLocalTimeError);
      expect(() => at(1981, 12, 31, 23, 45, 0, 'Asia/Kuala_Lumpur')).toThrow('does not exist in timezone "Asia/Kuala_Lumpur"');
      // The edges: 23:29:59 exists (+7:30) and 00:00:00 on 1 Jan exists (+8).
      expect(at(1981, 12, 31, 23, 29, 59, 'Asia/Kuala_Lumpur').offsetSeconds).toBe(27000);
      expect(() => at(1981, 12, 31, 23, 30, 0, 'Asia/Kuala_Lumpur')).toThrow(NonexistentLocalTimeError);
    });

    it('New York 2024-03-10 02:30 is in the spring-forward gap (clocks 02:00 to 03:00)', () => {
      expect(() => at(2024, 3, 10, 2, 30, 0, 'America/New_York')).toThrow(NonexistentLocalTimeError);
    });

    it('Samoa skipped the whole of 30 Dec 2011 (Pacific/Apia, -10 to +14)', () => {
      // tzdb australasia: Zone Pacific/Apia  -11:00 WS%sT 2011 Dec 29 24:00; 13:00 WS%sT
      expect(() => at(2011, 12, 30, 12, 0, 0, 'Pacific/Apia')).toThrow(NonexistentLocalTimeError);
      expect(at(2011, 12, 31, 12, 0, 0, 'Pacific/Apia').offsetSeconds).toBe(14 * 3600);
    });

    it('New York 2024-11-03 01:30 occurs twice: reject throws with both offsets, earlier/later choose', () => {
      let err: unknown;
      try {
        at(2024, 11, 3, 1, 30, 0, 'America/New_York', { ambiguous: 'reject' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(AmbiguousLocalTimeError);
      expect((err as AmbiguousLocalTimeError).offsetsMinutes).toEqual([-240, -300]);
      expect((err as Error).message).toContain('occurs twice');

      const earlier = at(2024, 11, 3, 1, 30, 0, 'America/New_York', { ambiguous: 'earlier' });
      expect(earlier.offsetSeconds).toBe(-14400);
      expect(earlier.utcDateTimeString).toBe('2024-11-03T05:30:00.000Z');
      const later = at(2024, 11, 3, 1, 30, 0, 'America/New_York', { ambiguous: 'later' });
      expect(later.offsetSeconds).toBe(-18000);
      expect(later.utcDateTimeString).toBe('2024-11-03T06:30:00.000Z');
      // A choice is still reported.
      expect(later.warnings?.some((w) => w.includes('Ambiguous local time'))).toBe(true);
    });

    it('with no option the earlier time is used and the warning says so (behaviour from before locations-select)', () => {
      const r = at(2024, 11, 3, 1, 30, 0, 'America/New_York');
      expect(r.offsetSeconds).toBe(-14400);
      expect(r.warnings?.some((w) => w.includes('Ambiguous local time') && w.includes('earlier'))).toBe(true);
    });

    it('an overlap that is not an hour: Lord Howe 2024-04-07 01:45 (30 minutes: +11:00 then +10:30)', () => {
      // tzdb australasia: Lord Howe DST is 30 minutes; ends 2024-04-07 02:00 LHDT, back to 01:30 LHST.
      expect(() => at(2024, 4, 7, 1, 45, 0, 'Australia/Lord_Howe', { ambiguous: 'reject' })).toThrow(AmbiguousLocalTimeError);
      expect(at(2024, 4, 7, 1, 45, 0, 'Australia/Lord_Howe', { ambiguous: 'earlier' }).offsetSeconds).toBe(39600);
      expect(at(2024, 4, 7, 1, 45, 0, 'Australia/Lord_Howe', { ambiguous: 'later' }).offsetSeconds).toBe(37800);
    });

    it('times next to a gap or overlap that are not affected give a single offset with no warning', () => {
      const r = at(2024, 11, 3, 3, 0, 0, 'America/New_York', { ambiguous: 'reject' });
      expect(r.offsetSeconds).toBe(-18000);
      expect(r.warnings).toBeUndefined();
    });
  });
});
