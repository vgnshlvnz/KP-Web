import { describe, it, expect } from 'vitest';
import {
  calculatePlacidusCusps,
  armcToMC,
  mcToArmc,
  ascendantToArmc,
  isPolarLatitude,
  PolarLatitudeError,
} from '../src/engine/placidus.js';
import { calculateKPChart, calculateCuspsFromARMC } from '../src/engine/index.js';
import { calculateSiderealTime } from '../src/engine/astronomy.js';
import { getHorary249Table } from '../src/engine/kp-lords.js';

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
    const res = calculatePlacidusCusps(100.0, polarLat, 23.44, 24.0, 'porphyry_fallback');
    expect(res.isPolarFallback).toBe(true);
    expect(res.warnings).toBeDefined();
    expect(res.warnings![0]).toContain('polar circle');
    expect(res.siderealCusps).toHaveLength(12);
  });
});

/** Smallest signed angular difference in arcseconds. */
function diffArcsec(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.abs(d) * 3600;
}

// Reference values: docs/build-fix/audit.md Appendix A.6, Swiss Ephemeris 2.10.03 `swe.houses_armc`,
// tropical Placidus, obliquity 23.4392911 deg. Columns: lat, ARMC, cusps 1, 2, 3, 10, 11, 12.
const SE_OBLIQUITY = 23.4392911;
const A6_GRID: Array<[number, number, number[]]> = [
  [-45, 0, [68.3084674, 102.2994706, 142.8840281, 0.0, 28.3182515, 50.0048535]],
  [-45, 97.5, [194.3058654, 232.9354674, 256.9150125, 96.8873229, 118.0648988, 146.6374783]],
  [-45, 187.5, [297.5644853, 316.1481854, 338.6827317, 188.1658174, 225.7277992, 264.9933645]],
  [-45, 292.5, [17.0807576, 43.8518146, 75.5184276, 290.8084689, 324.7569829, 353.660501]],
  [13.0827, 0, [95.2813581, 121.0022923, 148.7934982, 0.0, 33.2117756, 65.3687714]],
  [13.0827, 97.5, [187.4213532, 217.6336621, 247.5384713, 96.8873229, 126.6080323, 157.1754352]],
  [13.0827, 187.5, [271.5782203, 302.0581272, 334.8967936, 188.1658174, 218.7420453, 245.925486]],
  [13.0827, 292.5, [26.8726391, 57.9418728, 84.8763667, 290.8084689, 318.8682538, 351.2496285]],
  [51.4779, 0, [116.5503215, 132.613878, 152.5492778, 0.0, 38.6456608, 82.4156256]],
  [51.4779, 97.5, [185.2914671, 209.7980281, 240.4606563, 96.8873229, 132.5796178, 162.0532274]],
  [51.4779, 187.5, [249.033088, 285.2186046, 330.6123644, 188.1658174, 214.1760072, 233.2379916]],
  [51.4779, 292.5, [47.7205587, 74.7813954, 93.1904654, 290.8084689, 312.4778882, 347.2348034]],
  [60, 0, [124.5656857, 137.0211068, 154.0526789, 0.0, 41.9529351, 92.2106985]],
  [60, 97.5, [184.6678545, 207.0591278, 237.1562495, 96.8873229, 135.169854, 163.6990366]],
  [60, 187.5, [240.1387231, 274.8031711, 328.0211833, 188.1658174, 212.3068886, 228.2501182]],
  [60, 292.5, [67.4795575, 85.1968289, 97.7962457, 290.8084689, 308.5648161, 343.7803099]],
  [66.5, 0, [132.45305, 141.5753356, 155.6841208, 0.0, 47.3818585, 106.4097675]],
  [66.5, 97.5, [184.0921089, 204.3268367, 233.071298, 96.8873229, 138.1531719, 165.3189111]],
  [66.5, 187.5, [231.2728275, 257.8327824, 323.9920702, 188.1658174, 210.2476401, 223.0076513]],
  [66.5, 292.5, [99.9570879, 102.1672176, 105.4264285, 290.8084689, 301.6289038, 335.8471844]],
];
const GRID_CUSP_INDEX = [0, 1, 2, 9, 10, 11]; // cusps 1, 2, 3, 10, 11, 12

describe('Placidus vs Swiss Ephemeris houses_armc (Appendix A.6)', () => {
  for (const [lat, armc, expected] of A6_GRID) {
    it(`lat ${lat}, ARMC ${armc}: cusps 1, 2, 3, 10, 11, 12 within 0.01 arcsec; mirrored cusps are +180`, () => {
      const r = calculatePlacidusCusps(armc, lat, SE_OBLIQUITY, 0.0, 'refuse');
      expect(r.isPolarFallback).toBe(false);
      expect(r.chartWarnings).toEqual([]);
      GRID_CUSP_INDEX.forEach((idx, k) => {
        expect(diffArcsec(r.tropicalCusps[idx], expected[k])).toBeLessThanOrEqual(0.01);
      });
      // Cusps 4-9 are the opposites of 10, 11, 12, 1, 2, 3 (as in Swiss Ephemeris).
      const opposite: Array<[number, number]> = [[3, 9], [4, 10], [5, 11], [6, 0], [7, 1], [8, 2]];
      for (const [i, j] of opposite) {
        expect(diffArcsec(r.tropicalCusps[i], r.tropicalCusps[j] + 180)).toBeLessThan(1e-6);
      }
    });
  }

  it('66.5 N is computed as Placidus and is NOT clamped to 66 N (regression for #35)', () => {
    expect(isPolarLatitude(66.5, SE_OBLIQUITY)).toBe(false);
    const r = calculatePlacidusCusps(0, 66.5, SE_OBLIQUITY, 0.0, 'refuse');
    expect(r.isPolarFallback).toBe(false);
    const atClamp = calculatePlacidusCusps(0, 66.0, SE_OBLIQUITY, 0.0, 'refuse');
    // The clamped latitude gives a visibly different Ascendant (#35: errors of several degrees).
    expect(diffArcsec(r.ascendantTropical, atClamp.ascendantTropical)).toBeGreaterThan(1000);
    expect(diffArcsec(r.ascendantTropical, 132.45305)).toBeLessThanOrEqual(0.01);
  });
});

describe('Polar latitudes: Tromso 69.6492 N (Appendix A.5)', () => {
  // 2010-12-21 03:00:00 UTC: JD 2455551.625, dPsi 17.0466", true obliquity 23.4378170 deg.
  // KP Old true ayanamsa 23.91821112, KP New 23.93833535. Swiss Ephemeris switches to Porphyry.
  const LAT = 69.6492;
  const LON = 18.9553;
  const D_PSI = 17.0466 / 3600;
  const TRUE_OBL = 23.437817;
  const armc = calculateSiderealTime(2455551.625, LON, D_PSI, TRUE_OBL).armc;
  const cases: Array<[string, number, number[]]> = [
    [
      'KP Old',
      23.91821112,
      [187.231406, 227.355269, 267.479133, 307.602996, 327.479133, 347.355269,
        7.231406, 47.355269, 87.479133, 127.602996, 147.479133, 167.355269],
    ],
    [
      'KP New',
      23.93833535,
      [187.211282, 227.335145, 267.459009, 307.582872, 327.459009, 347.335145,
        7.211282, 47.335145, 87.459009, 127.582872, 147.459009, 167.335145],
    ],
  ];

  for (const [name, ayanamsa, expected] of cases) {
    it(`${name}: Porphyry cusps within 0.1 arcsec of Swiss Ephemeris, flagged as fallback`, () => {
      const r = calculatePlacidusCusps(armc, LAT, TRUE_OBL, ayanamsa, 'porphyry_fallback');
      expect(r.isPolarFallback).toBe(true);
      expect(r.warnings?.[0]).toContain('polar circle');
      expect(r.chartWarnings).toHaveLength(1);
      expect(r.chartWarnings[0].code).toBe('polar_fallback');
      expect(r.siderealCusps).toHaveLength(12);
      expected.forEach((exp, i) => {
        expect(diffArcsec(r.siderealCusps[i], exp)).toBeLessThanOrEqual(0.1);
      });
    });
  }

  it("'refuse' throws PolarLatitudeError at Tromso", () => {
    expect(() => calculatePlacidusCusps(armc, LAT, TRUE_OBL, 23.9, 'refuse')).toThrow(
      PolarLatitudeError
    );
  });

  it('with no polarHandling chosen it throws instead of picking a default (TODO(#29 Q7))', () => {
    expect(() => calculatePlacidusCusps(armc, LAT, TRUE_OBL, 23.9)).toThrow(/polarHandling/);
  });

  it('southern polar latitudes are treated the same way', () => {
    expect(isPolarLatitude(-69.65, TRUE_OBL)).toBe(true);
    expect(() => calculatePlacidusCusps(armc, -69.65, TRUE_OBL, 23.9, 'refuse')).toThrow(
      PolarLatitudeError
    );
    const r = calculatePlacidusCusps(armc, -69.65, TRUE_OBL, 23.9, 'porphyry_fallback');
    expect(r.isPolarFallback).toBe(true);
  });

  it('polarHandling does not matter at non-polar latitudes', () => {
    const a = calculatePlacidusCusps(armc, 51.4779, TRUE_OBL, 23.9, 'refuse');
    const b = calculatePlacidusCusps(armc, 51.4779, TRUE_OBL, 23.9, 'porphyry_fallback');
    const c = calculatePlacidusCusps(armc, 51.4779, TRUE_OBL, 23.9);
    expect(a.siderealCusps).toEqual(b.siderealCusps);
    expect(a.siderealCusps).toEqual(c.siderealCusps);
  });
});

describe('ascendantToArmc (horary Asc -> ARMC inversion)', () => {
  const KL_LAT = 3.139;
  const KL_OBL = 23.4407206; // Appendix A.1 true obliquity
  const KL_AYANAMSA = 23.65598842; // KP Old true ayanamsa at the KL 1992 instant
  const table = getHorary249Table();

  it('has all 249 horary entries to draw from', () => {
    expect(table).toHaveLength(249);
  });

  it('round-trips with calculatePlacidusCusps to 1e-6 arcsec for sub starts 1, 100, 145, 249', () => {
    for (const n of [1, 100, 145, 249]) {
      const startSidereal = table[n - 1].startLongitude;
      const ascTropical = (startSidereal + KL_AYANAMSA) % 360;
      const armc = ascendantToArmc(ascTropical, KL_LAT, KL_OBL);
      const r = calculatePlacidusCusps(armc, KL_LAT, KL_OBL, KL_AYANAMSA, 'refuse');
      expect(diffArcsec(r.ascendantTropical, ascTropical)).toBeLessThan(1e-6);
      // Asc is the START of the sub (not the midpoint).
      expect(diffArcsec(r.ascendantSidereal, startSidereal)).toBeLessThan(1e-6);
    }
  });

  it('round-trips for every horary sub start, at equatorial, mid and high (66.5 N) latitudes', () => {
    for (const lat of [3.139, -33.9, 51.4779, 66.5]) {
      for (const entry of table) {
        const asc = (entry.startLongitude + KL_AYANAMSA) % 360;
        const armc = ascendantToArmc(asc, lat, KL_OBL);
        const r = calculatePlacidusCusps(armc, lat, KL_OBL, KL_AYANAMSA, 'refuse');
        expect(diffArcsec(r.ascendantTropical, asc)).toBeLessThan(1e-6);
      }
    }
  });

  it('inverts a dense sweep of Ascendants, including 0 / 360 and 66.5 N where Asc moves fast', () => {
    const targets = [0, 359.99, 90, 180, 270];
    for (let a = 0; a < 360; a += 0.37) targets.push(a);
    for (const lat of [0, 30, 66.5, -66.5]) {
      for (const asc of targets) {
        const armc = ascendantToArmc(asc, lat, SE_OBLIQUITY);
        const r = calculatePlacidusCusps(armc, lat, SE_OBLIQUITY, 0.0, 'refuse');
        expect(diffArcsec(r.ascendantTropical, asc)).toBeLessThan(1e-6);
      }
    }
  });

  it('does not clamp the latitude: 66.5 N inverts exactly (regression for #35)', () => {
    // Appendix A.6: ARMC 97.5 at 66.5 N gives Asc 184.0921089 (Swiss Ephemeris).
    const armc = ascendantToArmc(184.0921089, 66.5, SE_OBLIQUITY);
    expect(diffArcsec(armc, 97.5)).toBeLessThan(0.01);
  });

  it('throws inside the polar circle (no fallback, no clamp)', () => {
    expect(() => ascendantToArmc(100, 69.6492, 23.4378)).toThrow(PolarLatitudeError);
    expect(() => ascendantToArmc(100, -80, 23.4378)).toThrow(PolarLatitudeError);
  });
});
