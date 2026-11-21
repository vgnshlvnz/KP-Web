import test from 'node:test';
import assert from 'node:assert';
import {
  calculateKpAyanamsa,
  dateToJulianDay,
  formatDms,
  julianDayToDate,
  KP_NEW_J2000_DEG,
  KP_OLD_J2000_DEG,
} from '../dist/ephemeris/ayanamsa.js';

test('KP Old and KP New ayanamsa values at J2000.0', () => {
  const jd2000 = 2451545.0; // 2000-01-01 12:00:00 UT
  const oldVal = calculateKpAyanamsa(jd2000, 'KP_OLD');
  const newVal = calculateKpAyanamsa(jd2000, 'KP_NEW');

  // Verify against exact J2000 reference
  assert.strictEqual(oldVal.toFixed(6), KP_OLD_J2000_DEG.toFixed(6));
  assert.strictEqual(newVal.toFixed(6), KP_NEW_J2000_DEG.toFixed(6));

  // Difference between KP New and KP Old is approx 72.45 arcseconds
  const diffArcsec = (newVal - oldVal) * 3600;
  assert.ok(
    Math.abs(diffArcsec - 72.45) < 0.1,
    `Expected diff ~72.45", got ${diffArcsec}"`
  );
});

test('KP Ayanamsa across multiple epochs matches Swiss Ephemeris reference within 0.1 arcsec', () => {
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

    assert.ok(
      errOldArcsec < 0.1,
      `Year ${tc.year} KP Old error too high: ${errOldArcsec}"`
    );
    assert.ok(
      errNewArcsec < 0.1,
      `Year ${tc.year} KP New error too high: ${errNewArcsec}"`
    );
  }
});

test('Julian day and date conversions are reversible and accurate', () => {
  const jd = dateToJulianDay(1990, 5, 15, 14, 30, 0);
  assert.strictEqual(jd, 2448027.1041666665);

  const date = julianDayToDate(jd);
  assert.strictEqual(date.getUTCFullYear(), 1990);
  assert.strictEqual(date.getUTCMonth(), 4); // 0-indexed May
  assert.strictEqual(date.getUTCDate(), 15);
  assert.strictEqual(date.getUTCHours(), 14);
  assert.strictEqual(date.getUTCMinutes(), 30);
  assert.strictEqual(date.getUTCSeconds(), 0);
});

test('DMS formatting handles minutes, seconds, and rounding', () => {
  assert.strictEqual(formatDms(23.76024), "23°45'37\"");
  assert.strictEqual(formatDms(0.0), "0°00'00\"");
  assert.strictEqual(formatDms(153.0), "153°00'00\"");
  assert.strictEqual(formatDms(29.999999), "30°00'00\"");
});
