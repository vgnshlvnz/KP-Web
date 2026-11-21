import { describe, it, expect } from 'vitest';
import {
  toJulianDate,
  calculateNutation,
  calculateObliquity,
  calculateSiderealTime,
  calculateAyanamsa,
  normalizeDegrees,
} from '../src/engine/astronomy.js';

describe('Astronomical Calculations', () => {
  it('calculates correct Julian Day for J2000 epoch', () => {
    const jd = toJulianDate(2000, 1, 1, 12, 0, 0);
    expect(jd).toBe(2451545.0);
  });

  it('calculates Julian Day for historical dates', () => {
    // India Independence: 1947-08-15 00:00 UT
    const jd1 = toJulianDate(1947, 8, 15, 0, 0, 0);
    expect(jd1).toBe(2432412.5);

    // 2026-11-21 12:00 UT
    const jd2 = toJulianDate(2026, 11, 21, 12, 0, 0);
    expect(jd2).toBe(2461366.0);
  });

  it('computes mean obliquity close to IAU standard', () => {
    const jd = 2451545.0; // J2000
    const obl = calculateObliquity(jd);
    // At J2000, mean obliquity is 23°26'21.406" ≈ 23.439291°
    expect(obl.meanObliquity).toBeCloseTo(23.439291, 4);
  });

  it('computes nutation in longitude and obliquity', () => {
    const jd = 2461366.0; // 2026-11-21 12:00 UT
    const nut = calculateNutation(jd);
    // Nutation in longitude is typically between -18" and +18" (±0.005°)
    expect(Math.abs(nut.dPsi)).toBeLessThan(0.006);
    expect(Math.abs(nut.dEps)).toBeLessThan(0.004);
  });

  it('computes GMST and GAST sidereal time', () => {
    const jd = 2451545.0; // J2000 12h UT
    const st = calculateSiderealTime(jd, 0.0);
    // At J2000.0, GMST at 12h UT is approx 18h43m (approx 280.46°)
    expect(st.gmstDegrees).toBeCloseTo(280.46, 1);
  });

  it('computes KP Old ayanamsa matching Swiss Ephemeris within arc-second precision', () => {
    // Benchmark values from Swiss Ephemeris SIDM_KRISHNAMURTI:
    // 1900-01-01: 22.363678°
    // 1950-01-01: 23.061873°
    // 2000-01-01: 23.760221°
    // 2026-01-01: 24.123452°
    const benchmarks = [
      { y: 1900, expected: 22.363678 },
      { y: 1950, expected: 23.061873 },
      { y: 2000, expected: 23.760221 },
      { y: 2026, expected: 24.123452 },
    ];

    for (const b of benchmarks) {
      const jd = toJulianDate(b.y, 1, 1, 0, 0, 0);
      const aya = calculateAyanamsa(jd, 'kp_old');
      const diffArcsec = Math.abs(aya.meanAyanamsa - b.expected) * 3600.0;
      expect(diffArcsec).toBeLessThan(1.0); // Sub-arcsecond precision!
    }
  });

  it('computes KP New ayanamsa matching Swiss Ephemeris within arc-second precision', () => {
    // Benchmark values from Swiss Ephemeris SIDM_KRISHNAMURTI_VP291:
    // 1900-01-01: 22.383809°
    // 1950-01-01: 23.082001°
    // 2000-01-01: 23.780346°
    // 2026-01-01: 24.143575°
    const benchmarks = [
      { y: 1900, expected: 22.383809 },
      { y: 1950, expected: 23.082001 },
      { y: 2000, expected: 23.780346 },
      { y: 2026, expected: 24.143575 },
    ];

    for (const b of benchmarks) {
      const jd = toJulianDate(b.y, 1, 1, 0, 0, 0);
      const aya = calculateAyanamsa(jd, 'kp_new');
      const diffArcsec = Math.abs(aya.meanAyanamsa - b.expected) * 3600.0;
      expect(diffArcsec).toBeLessThan(1.0); // Sub-arcsecond precision!
    }
  });

  it('verifies that KP New is ~72.4 arcseconds ahead of KP Old', () => {
    const jd = toJulianDate(2026, 11, 21, 12, 0, 0);
    const oldAya = calculateAyanamsa(jd, 'kp_old');
    const newAya = calculateAyanamsa(jd, 'kp_new');
    const diffSec = (newAya.meanAyanamsa - oldAya.meanAyanamsa) * 3600.0;
    expect(diffSec).toBeCloseTo(72.4, 0);
  });
});
