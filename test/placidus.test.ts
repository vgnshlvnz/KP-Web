import { describe, it, expect } from 'vitest';
import {
  calculatePlacidusCusps,
  armcToMC,
  mcToArmc,
} from '../src/engine/placidus.js';
import { calculateKPChart, calculateCuspsFromARMC } from '../src/engine/index.js';

describe('Placidus House Cusps Engine', () => {
  // Benchmark 1: India Independence Chart
  // Date: 1947-08-14 18:30:00 UT (1947-08-15 00:00:00 IST)
  // Location: New Delhi (28.6139° N, 77.2090° E)
  // Computed using Swiss Ephemeris / Jagannatha Hora with KP Old and KP New ayanamsas:
  const delhiChart = {
    year: 1947,
    month: 8,
    day: 14,
    hour: 18,
    minute: 30,
    second: 0,
    utcOffsetHours: 0,
    latitude: 28.6139,
    longitude: 77.209,
    kpOldExpectedCusps: [
      37.829122,  // Cusp 1 (Taurus ~7°50')
      63.438101,  // Cusp 2
      86.645166,  // Cusp 3
      111.550112, // Cusp 4
      141.710889, // Cusp 5
      178.786132, // Cusp 6
      217.829122, // Cusp 7 (Scorpio ~7°50')
      243.438101, // Cusp 8
      266.645166, // Cusp 9
      291.550112, // Cusp 10 (Capricorn ~21°33')
      321.710889, // Cusp 11
      358.786132, // Cusp 12
    ],
    kpNewExpectedCusps: [
      37.808994,  // Cusp 1
      63.417972,  // Cusp 2
      86.625038,  // Cusp 3
      111.529984, // Cusp 4
      141.690761, // Cusp 5
      178.766004, // Cusp 6
      217.808994, // Cusp 7
      243.417972, // Cusp 8
      266.625038, // Cusp 9
      291.529984, // Cusp 10
      321.690761, // Cusp 11
      358.766004, // Cusp 12
    ],
  };

  // Benchmark 2: Chennai Sample Chart
  // Date: 2026-11-21 06:25:00 UT
  // Location: Chennai (13.0827° N, 80.2707° E)
  const chennaiChart = {
    year: 2026,
    month: 11,
    day: 21,
    hour: 6,
    minute: 25,
    second: 0,
    utcOffsetHours: 0,
    latitude: 13.0827,
    longitude: 80.2707,
    kpOldExpectedCusps: [
      296.821386, // Cusp 1 (Capricorn ~26°49')
      332.120363, // Cusp 2 (Aquarius ~2°07')
      5.632094,   // Cusp 3 (Aries ~5°38')
      34.878698,  // Cusp 4 (Taurus ~4°53')
      61.159809,  // Cusp 5 (Gemini ~1°10')
      87.381451,  // Cusp 6 (Gemini ~27°23')
      116.821386, // Cusp 7 (Cancer ~26°49')
      152.120363, // Cusp 8 (Virgo ~2°07')
      185.632094, // Cusp 9 (Libra ~5°38')
      214.878698, // Cusp 10 (Scorpio ~4°53')
      241.159809, // Cusp 11 (Sagittarius ~1°10')
      267.381451, // Cusp 12 (Sagittarius ~27°23')
    ],
  };

  it('computes all 12 Placidus cusps in KP Old to arc-second precision (Delhi chart)', () => {
    const result = calculateKPChart(
      {
        year: delhiChart.year,
        month: delhiChart.month,
        day: delhiChart.day,
        hour: delhiChart.hour,
        minute: delhiChart.minute,
        second: delhiChart.second,
        utcOffsetHours: delhiChart.utcOffsetHours,
        latitude: delhiChart.latitude,
        longitude: delhiChart.longitude,
      },
      'kp_old'
    );

    expect(result.cusps).toHaveLength(12);

    for (let i = 0; i < 12; i++) {
      const computed = result.cusps[i].longitude;
      const expected = delhiChart.kpOldExpectedCusps[i];
      const diffArcsec = Math.abs(computed - expected) * 3600.0;
      // Precision should be within 1 arcsecond
      expect(diffArcsec).toBeLessThan(1.0);
    }
  });

  it('computes all 12 Placidus cusps in KP New to arc-second precision (Delhi chart)', () => {
    const result = calculateKPChart(
      {
        year: delhiChart.year,
        month: delhiChart.month,
        day: delhiChart.day,
        hour: delhiChart.hour,
        minute: delhiChart.minute,
        second: delhiChart.second,
        utcOffsetHours: delhiChart.utcOffsetHours,
        latitude: delhiChart.latitude,
        longitude: delhiChart.longitude,
      },
      'kp_new'
    );

    expect(result.cusps).toHaveLength(12);

    for (let i = 0; i < 12; i++) {
      const computed = result.cusps[i].longitude;
      const expected = delhiChart.kpNewExpectedCusps[i];
      const diffArcsec = Math.abs(computed - expected) * 3600.0;
      expect(diffArcsec).toBeLessThan(1.0);
    }
  });

  it('computes all 12 Placidus cusps to arc-second precision (Chennai chart)', () => {
    const result = calculateKPChart(
      {
        year: chennaiChart.year,
        month: chennaiChart.month,
        day: chennaiChart.day,
        hour: chennaiChart.hour,
        minute: chennaiChart.minute,
        second: chennaiChart.second,
        utcOffsetHours: chennaiChart.utcOffsetHours,
        latitude: chennaiChart.latitude,
        longitude: chennaiChart.longitude,
      },
      'kp_old'
    );

    for (let i = 0; i < 12; i++) {
      const computed = result.cusps[i].longitude;
      const expected = chennaiChart.kpOldExpectedCusps[i];
      const diffArcsec = Math.abs(computed - expected) * 3600.0;
      expect(diffArcsec).toBeLessThan(1.0);
    }
  });

  it('preserves exact 180° opposition between opposite houses', () => {
    const result = calculateKPChart(
      {
        year: 2026,
        month: 11,
        day: 21,
        hour: 12,
        minute: 0,
        second: 0,
        latitude: 13.0827,
        longitude: 80.2707,
      },
      'kp_old'
    );

    // Cusp 7 is opposite Cusp 1
    const diff1_7 = Math.abs((result.cusps[6].longitude - result.cusps[0].longitude + 360) % 360 - 180);
    expect(diff1_7).toBeLessThan(1e-7);

    // Cusp 10 is opposite Cusp 4
    const diff4_10 = Math.abs((result.cusps[3].longitude - result.cusps[9].longitude + 360) % 360 - 180);
    expect(diff4_10).toBeLessThan(1e-7);

    // Cusp 11 is opposite Cusp 5
    const diff5_11 = Math.abs((result.cusps[4].longitude - result.cusps[10].longitude + 360) % 360 - 180);
    expect(diff5_11).toBeLessThan(1e-7);

    // Cusp 12 is opposite Cusp 6
    const diff6_12 = Math.abs((result.cusps[5].longitude - result.cusps[11].longitude + 360) % 360 - 180);
    expect(diff6_12).toBeLessThan(1e-7);
  });

  it('computes cusps directly from ARMC for Horary RAMC inversion', () => {
    // ARMC = 320.776189°, Lat = 13.0827°, Obl = 23.437818°, Ayanamsa = 24.135864°
    const cusps = calculateCuspsFromARMC(
      320.776189,
      13.0827,
      23.437818,
      24.135864
    );

    expect(cusps).toHaveLength(12);
    // Ascendant (Cusp 1): 57.805257 - 24.135864 ≈ 33.66939° (approx 33.67°)
    expect(cusps[0].longitude).toBeCloseTo(33.669, 2);
    // MC (Cusp 10): 318.341226 - 24.135864 ≈ 294.205°
    expect(cusps[9].longitude).toBeCloseTo(294.205, 2);
  });

  it('handles MC to ARMC inversion correctly', () => {
    const obliquity = 23.439291;
    for (const testArmc of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const mc = armcToMC(testArmc, obliquity);
      const invertedArmc = mcToArmc(mc, obliquity);
      expect(invertedArmc).toBeCloseTo(testArmc, 4);
    }
  });

  it('falls back to Porphyry inside polar circle with a warning', () => {
    const polarLat = 75.0; // Arctic circle
    const res = calculatePlacidusCusps(100.0, polarLat, 23.44, 24.0);
    expect(res.isPolarFallback).toBe(true);
    expect(res.warnings).toBeDefined();
    expect(res.warnings![0]).toContain('polar circle');
    expect(res.siderealCusps).toHaveLength(12);
  });
});
