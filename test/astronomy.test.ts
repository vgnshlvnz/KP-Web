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

  // --- port-ephemeris (#41): nutation, obliquity and sidereal time now delegate to astronomy-engine.
  // Reference: audit.md Appendix A (Swiss Ephemeris 2.10.03).
  const REFERENCE = [
    { label: 'KL 1992', jd: 2448692.426388889, lon: 101.6869, dPsiArcsec: 17.4325, trueObl: 23.4407206, armc: 244.0203059 },
    { label: 'Greenwich 2000', jd: 2451545.0, lon: -0.0015, dPsiArcsec: -13.9315, trueObl: 23.4376767, armc: 280.4555724 },
    { label: 'Chennai 1950', jd: 2433448.270486111, lon: 80.2707, dPsiArcsec: -1.2657, trueObl: 23.4480701, armc: 261.1123491 },
    { label: 'Petaling Jaya 2026', jd: 2461365.541666667, lon: 101.6067, dPsiArcsec: 8.1737, trueObl: 23.4378255, armc: 176.6604417 },
  ];

  it.each(REFERENCE)('nutation, true obliquity and ARMC agree with Swiss Ephemeris: $label', (c) => {
    const nut = calculateNutation(c.jd);
    expect(Math.abs(nut.dPsi * 3600 - c.dPsiArcsec)).toBeLessThan(0.2);

    const obl = calculateObliquity(c.jd, nut.dEps);
    expect(Math.abs(obl.trueObliquity - c.trueObl) * 3600).toBeLessThan(0.1);

    const st = calculateSiderealTime(c.jd, c.lon, nut.dPsi, obl.trueObliquity);
    const err = ((((st.armc - c.armc) % 360) + 540) % 360) - 180;
    expect(Math.abs(err) * 3600).toBeLessThan(0.2);
  });

  it('keeps the exported shapes: true obliquity = mean + dEps, GAST = GMST + dPsi*cos(eps)', () => {
    const jd = 2461365.541666667;
    const nut = calculateNutation(jd);
    const obl = calculateObliquity(jd, nut.dEps);
    expect(obl.trueObliquity - obl.meanObliquity).toBeCloseTo(nut.dEps, 12);
    // Default dEps = 0 returns the mean obliquity as the true one.
    expect(calculateObliquity(jd).trueObliquity).toBe(calculateObliquity(jd).meanObliquity);

    const noNut = calculateSiderealTime(jd, 101.6067);
    expect(noNut.gastDegrees).toBeCloseTo(noNut.gmstDegrees, 12);
    const withNut = calculateSiderealTime(jd, 101.6067, nut.dPsi, obl.trueObliquity);
    expect(withNut.gastDegrees - withNut.gmstDegrees).toBeCloseTo(nut.dPsi * Math.cos((obl.trueObliquity * Math.PI) / 180), 10);
    expect(withNut.armc).toBeCloseTo(((withNut.gastDegrees + 101.6067) % 360 + 360) % 360, 10);
    expect(withNut.lstHours * 15).toBeCloseTo(withNut.armc, 10);
  });
});
