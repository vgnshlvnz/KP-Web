import { describe, it, expect } from 'vitest';
import {
  calculateKpAyanamsa,
  dateToJulianDay,
  formatDms,
  julianDayToDate,
  KP_NEW_J2000_DEG,
  KP_OLD_J2000_DEG,
} from '../src/ephemeris/ayanamsa.js';

describe('KP ayanamsa', () => {
  it('KP Old and KP New ayanamsa values at J2000.0', () => {
    const jd2000 = 2451545.0; // 2000-01-01 12:00:00 UT
    const oldVal = calculateKpAyanamsa(jd2000, 'KP_OLD');
    const newVal = calculateKpAyanamsa(jd2000, 'KP_NEW');

    // Verify against exact J2000 reference
    expect(oldVal.toFixed(6)).toBe(KP_OLD_J2000_DEG.toFixed(6));
    expect(newVal.toFixed(6)).toBe(KP_NEW_J2000_DEG.toFixed(6));

    // Difference between KP New and KP Old is approx 72.45 arcseconds
    const diffArcsec = (newVal - oldVal) * 3600;
    expect(
      Math.abs(diffArcsec - 72.45) < 0.1,
      `Expected diff ~72.45", got ${diffArcsec}"`
    ).toBe(true);
  });

  it('KP Ayanamsa across multiple epochs matches Swiss Ephemeris reference within 0.1 arcsec', () => {
    // Reference values computed from Swiss Ephemeris SE_SIDM_KRISHNAMURTI (5) and SE_SIDM_KRISHNAMURTI_VP291 (45)
    const testCases = [
      {
        year: 1900,
        month: 1,
        day: 1,
        expectedOld: 22.363678,
        expectedNew: 22.383809,
      },
      {
        year: 1950,
        month: 1,
        day: 1,
        expectedOld: 23.061873,
        expectedNew: 23.082001,
      },
      {
        year: 1980,
        month: 1,
        day: 1,
        expectedOld: 23.480856,
        expectedNew: 23.500982,
      },
      {
        year: 2026,
        month: 11,
        day: 21,
        expectedOld: 24.135844,
        expectedNew: 24.155968,
      },
      {
        year: 2050,
        month: 1,
        day: 1,
        expectedOld: 24.458761,
        expectedNew: 24.478882,
      },
    ];

    for (const tc of testCases) {
      const jd = dateToJulianDay(tc.year, tc.month, tc.day, 0, 0, 0);
      const oldDeg = calculateKpAyanamsa(jd, 'KP_OLD');
      const newDeg = calculateKpAyanamsa(jd, 'KP_NEW');

      const errOldArcsec = Math.abs(oldDeg - tc.expectedOld) * 3600;
      const errNewArcsec = Math.abs(newDeg - tc.expectedNew) * 3600;

      expect(
        errOldArcsec < 0.1,
        `Year ${tc.year} KP Old error too high: ${errOldArcsec}"`
      ).toBe(true);
      expect(
        errNewArcsec < 0.1,
        `Year ${tc.year} KP New error too high: ${errNewArcsec}"`
      ).toBe(true);
    }
  });

  it('Julian day and date conversions are reversible and accurate', () => {
    const jd = dateToJulianDay(1990, 5, 15, 14, 30, 0);
    expect(jd).toBe(2448027.1041666665);

    const date = julianDayToDate(jd);
    expect(date.getUTCFullYear()).toBe(1990);
    expect(date.getUTCMonth()).toBe(4); // 0-indexed May
    expect(date.getUTCDate()).toBe(15);
    expect(date.getUTCHours()).toBe(14);
    expect(date.getUTCMinutes()).toBe(30);
    expect(date.getUTCSeconds()).toBe(0);
  });

  it('DMS formatting handles minutes, seconds, and rounding', () => {
    expect(formatDms(23.76024)).toBe("23°45'37\"");
    expect(formatDms(0.0)).toBe("0°00'00\"");
    expect(formatDms(153.0)).toBe("153°00'00\"");
    expect(formatDms(29.999999)).toBe("30°00'00\"");
  });
});
