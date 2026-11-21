/**
 * Ayanamsa modes added by work package add-ayanamsas (#64) vs Swiss Ephemeris 2.10.03.
 *
 * Owner decision on #29 (2026-11-21, answer A): Lahiri, Raman, Fagan-Bradley, Yukteshwar,
 * J.N. Bhasin, Usha-Shashi and Nil (tropical), as explicit choices, defined as Swiss Ephemeris defines
 * them (by name: SE_SIDM_LAHIRI, SE_SIDM_RAMAN, SE_SIDM_FAGAN_BRADLEY, SE_SIDM_YUKTESHWAR,
 * SE_SIDM_JN_BHASIN, SE_SIDM_USHASHASHI), next to KP Old / KP New (those are tested in
 * ayanamsa.test.ts and ephemeris-reference.test.ts, unchanged).
 *
 * Reference values were generated locally with Swiss Ephemeris (pyswisseph 2.10.3.2 = SE 2.10.03, full
 * `sepl_18` / `semo_18` files) by the script reproduced at the end of this comment. Swiss Ephemeris is
 * used only to generate numbers; it is not a dependency.
 *
 * Tolerances (arcseconds): mean ayanamsa 0.05; sidereal Sun 2, Moon 6 (the existing planet tolerances
 * in ephemeris-reference.test.ts); Placidus cusps 0.5 (audit.md Appendix A.6 measured 0.2).
 * The mean ayanamsa is checked at the 5 audit instants (Appendix A.1 to A.5) and at 1900-01-01,
 * 1950-01-01 and 2100-01-01. 'nil' is the tropical zodiac: sidereal = tropical exactly.
 *
 * Generating script (`gen_ts.py`):
 *
 * # Reference generator for test/ayanamsa-reference.test.ts (local only; never a dependency).
 * #   python3 -m venv /tmp/kp-aya-venv && /tmp/kp-aya-venv/bin/pip install pyswisseph   # 2.10.3.2 = Swiss Ephemeris 2.10.03
 * #   /tmp/kp-aya-venv/bin/python gen_ts.py > refs.ts.txt
 * # The planet ephemeris files sepl_18.se1 / semo_18.se1 (full SE precision, not Moshier) are in /tmp/kp-audit-ephe.
 * import swisseph as swe
 *
 * swe.set_ephe_path('/tmp/kp-audit-ephe')
 * # SE sidereal modes BY NAME (swe.SIDM_*), never by number.
 * MODES = {
 *     'lahiri': swe.SIDM_LAHIRI, 'raman': swe.SIDM_RAMAN, 'fagan_bradley': swe.SIDM_FAGAN_BRADLEY,
 *     'yukteshwar': swe.SIDM_YUKTESHWAR, 'jn_bhasin': swe.SIDM_JN_BHASIN, 'usha_shashi': swe.SIDM_USHASHASHI,
 * }
 * INSTANTS = [  # label, UTC, y, m, d, decimal hours  (the 5 audit instants, then 1900, 1950, 2100)
 *     ('KL 1992', '1992-03-10T22:14:00Z', 1992, 3, 10, 22 + 14 / 60),
 *     ('Greenwich 2000', '2000-01-01T12:00:00Z', 2000, 1, 1, 12.0),
 *     ('Chennai 1950', '1950-06-15T18:29:30Z', 1950, 6, 15, 18 + 29 / 60 + 30 / 3600),
 *     ('Petaling Jaya 2026', '2026-11-21T01:00:00Z', 2026, 11, 21, 1.0),
 *     ('Tromso 2010', '2010-12-21T03:00:00Z', 2010, 12, 21, 3.0),
 *     ('1900-01-01', '1900-01-01T00:00:00Z', 1900, 1, 1, 0.0),
 *     ('1950-01-01', '1950-01-01T00:00:00Z', 1950, 1, 1, 0.0),
 *     ('2100-01-01', '2100-01-01T00:00:00Z', 2100, 1, 1, 0.0),
 * ]
 *
 * print('// Swiss Ephemeris', swe.version)
 * print('const MEAN_REFERENCE: MeanReference[] = [')
 * for label, utc, y, mo, d, h in INSTANTS:
 *     jd = swe.julday(y, mo, d, h)
 *     print(f"  {{ label: '{label}', utc: '{utc}', jdUt: {jd:.9f}, mean: {{")
 *     for name, m in MODES.items():
 *         swe.set_sid_mode(m, 0, 0)
 *         # mean ayanamsa: no nutation
 *         print(f"    {name}: {swe.get_ayanamsa_ex_ut(jd, swe.FLG_SWIEPH | swe.FLG_NONUT)[1]:.8f},")
 *     print('  } },')
 * print('];\n')
 * print('const BODY_REFERENCE: BodyReference[] = [')
 * for label, utc, y, mo, d, h in INSTANTS[:5]:
 *     jd = swe.julday(y, mo, d, h)
 *     print(f"  {{ label: '{label}', utc: '{utc}', bodies: {{")
 *     for body, bn in ((swe.SUN, 'Sun'), (swe.MOON, 'Moon')):
 *         print(f"    {bn}: {{")
 *         for name, m in MODES.items():
 *             swe.set_sid_mode(m, 0, 0)
 *             res, rf = swe.calc_ut(jd, body, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)
 *             assert rf & swe.FLG_SWIEPH, rf  # full SE files, not Moshier
 *             print(f"      {name}: {res[0]:.7f},")
 *         # nil = tropical: no FLG_SIDEREAL
 *         res, rf = swe.calc_ut(jd, body, swe.FLG_SWIEPH)
 *         assert rf & swe.FLG_SWIEPH, rf
 *         print(f"      nil: {res[0]:.7f},")
 *         print('    },')
 *     print('  } },')
 * print('];')
 *
 * # Placidus cusps, KL 1992 (3.1390 N, 101.6869 E), sidereal per mode; nil = tropical (no FLG_SIDEREAL).
 * kl_jd = swe.julday(1992, 3, 10, 22 + 14 / 60)
 * print('\nconst KL_CUSPS: Record<string, number[]> = {')
 * for name, m in MODES.items():
 *     swe.set_sid_mode(m, 0, 0)
 *     cusps, ascmc = swe.houses_ex(kl_jd, 3.139, 101.6869, b'P', swe.FLG_SIDEREAL)
 *     print(f"  {name}: [{', '.join(f'{c:.7f}' for c in cusps)}],")
 * cusps, ascmc = swe.houses_ex(kl_jd, 3.139, 101.6869, b'P', 0)
 * print(f"  nil: [{', '.join(f'{c:.7f}' for c in cusps)}],")
 * print('};')
 */
import { describe, it, expect } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import { calculateAyanamsa } from '../src/engine/astronomy.js';
import { calculateEphemeris } from '../src/engine/ephemeris.js';
import { calculateChart } from '../src/engine/index.js';
import { calculateHoraryChart } from '../src/engine/horary.js';
import {
  AYANAMSA_MODES,
  SE_AYANAMSA_DEFINITIONS,
  isAyanamsaMode,
} from '../src/engine/ayanamsa-defs.js';
import { validateAyanamsa } from '../src/core/validation.js';
import type { AyanamsaMode, ChartCalculationOptions, DateTimeLocation } from '../src/engine/types.js';

type SeMode = 'lahiri' | 'raman' | 'fagan_bradley' | 'yukteshwar' | 'jn_bhasin' | 'usha_shashi';
const SE_MODES: SeMode[] = ['lahiri', 'raman', 'fagan_bradley', 'yukteshwar', 'jn_bhasin', 'usha_shashi'];

interface MeanReference {
  label: string;
  utc: string;
  jdUt: number;
  mean: Record<SeMode, number>;
}
interface BodyReference {
  label: string;
  utc: string;
  bodies: Record<'Sun' | 'Moon', Record<SeMode | 'nil', number>>;
}

const MEAN_REFERENCE: MeanReference[] = [
  { label: 'KL 1992', utc: '1992-03-10T22:14:00Z', jdUt: 2448692.426388889, mean: {
    lahiri: 23.74799838,
    raman: 22.30169706,
    fagan_bradley: 24.63120602,
    yukteshwar: 22.36970905,
    jn_bhasin: 22.65304305,
    usha_shashi: 19.94844705,
  } },
  { label: 'Greenwich 2000', utc: '2000-01-01T12:00:00Z', jdUt: 2451545.000000000, mean: {
    lahiri: 23.85709235,
    raman: 22.41079104,
    fagan_bradley: 24.74029999,
    yukteshwar: 22.47880303,
    jn_bhasin: 22.76213703,
    usha_shashi: 20.05754103,
  } },
  { label: 'Chennai 1950', utc: '1950-06-15T18:29:30Z', jdUt: 2433448.270486111, mean: {
    lahiri: 23.16506360,
    raman: 21.71876222,
    fagan_bradley: 24.04827123,
    yukteshwar: 21.78677421,
    jn_bhasin: 22.07010821,
    usha_shashi: 19.36551221,
  } },
  { label: 'Petaling Jaya 2026', utc: '2026-11-21T01:00:00Z', jdUt: 2461365.541666667, mean: {
    lahiri: 24.23269830,
    raman: 22.78639702,
    fagan_bradley: 25.11590594,
    yukteshwar: 22.85440900,
    jn_bhasin: 23.13774300,
    usha_shashi: 20.43314700,
  } },
  { label: 'Tromso 2010', utc: '2010-12-21T03:00:00Z', jdUt: 2455551.625000000, mean: {
    lahiri: 24.01032825,
    raman: 22.56402695,
    fagan_bradley: 24.89353589,
    yukteshwar: 22.63203894,
    jn_bhasin: 22.91537294,
    usha_shashi: 20.21077694,
  } },
  { label: '1900-01-01', utc: '1900-01-01T00:00:00Z', jdUt: 2415020.500000000, mean: {
    lahiri: 22.46053059,
    raman: 21.01422913,
    fagan_bradley: 23.34373822,
    yukteshwar: 21.08224111,
    jn_bhasin: 21.36557511,
    usha_shashi: 18.66097911,
  } },
  { label: '1950-01-01', utc: '1950-01-01T00:00:00Z', jdUt: 2433282.500000000, mean: {
    lahiri: 23.15872514,
    raman: 21.71242376,
    fagan_bradley: 24.04193278,
    yukteshwar: 21.78043575,
    jn_bhasin: 22.06376975,
    usha_shashi: 19.35917375,
  } },
  { label: '2100-01-01', utc: '2100-01-01T00:00:00Z', jdUt: 2488069.500000000, mean: {
    lahiri: 25.25426827,
    raman: 23.80796705,
    fagan_bradley: 26.13747592,
    yukteshwar: 23.87597903,
    jn_bhasin: 24.15931303,
    usha_shashi: 21.45471703,
  } },
];

const BODY_REFERENCE: BodyReference[] = [
  { label: 'KL 1992', utc: '1992-03-10T22:14:00Z', bodies: {
    Sun: {
      lahiri: 326.8472142,
      raman: 328.2935156,
      fagan_bradley: 325.9640066,
      yukteshwar: 328.2255036,
      jn_bhasin: 327.9421696,
      usha_shashi: 330.6467656,
      nil: 350.6000550,
    },
    Moon: {
      lahiri: 41.9326546,
      raman: 43.3789559,
      fagan_bradley: 41.0494470,
      yukteshwar: 43.3109439,
      jn_bhasin: 43.0276099,
      usha_shashi: 45.7322059,
      nil: 65.6854953,
    },
  } },
  { label: 'Greenwich 2000', utc: '2000-01-01T12:00:00Z', bodies: {
    Sun: {
      lahiri: 256.5156962,
      raman: 257.9619975,
      fagan_bradley: 255.6324885,
      yukteshwar: 257.8939855,
      jn_bhasin: 257.6106515,
      usha_shashi: 260.3152475,
      nil: 280.3689187,
    },
    Moon: {
      lahiri: 199.4705290,
      raman: 200.9168303,
      fagan_bradley: 198.5873213,
      yukteshwar: 200.8488183,
      jn_bhasin: 200.5654843,
      usha_shashi: 203.2700803,
      nil: 223.3237514,
    },
  } },
  { label: 'Chennai 1950', utc: '1950-06-15T18:29:30Z', bodies: {
    Sun: {
      lahiri: 60.9035036,
      raman: 62.3498050,
      fagan_bradley: 60.0202960,
      yukteshwar: 62.2817930,
      jn_bhasin: 61.9984590,
      usha_shashi: 64.7030550,
      nil: 84.0682156,
    },
    Moon: {
      lahiri: 62.1248112,
      raman: 63.5711126,
      fagan_bradley: 61.2416036,
      yukteshwar: 63.5031006,
      jn_bhasin: 63.2197666,
      usha_shashi: 65.9243626,
      nil: 85.2895232,
    },
  } },
  { label: 'Petaling Jaya 2026', utc: '2026-11-21T01:00:00Z', bodies: {
    Sun: {
      lahiri: 214.4868034,
      raman: 215.9331046,
      fagan_bradley: 213.6035957,
      yukteshwar: 215.8650927,
      jn_bhasin: 215.5817587,
      usha_shashi: 218.2863547,
      nil: 238.7217721,
    },
    Moon: {
      lahiri: 346.4690029,
      raman: 347.9153042,
      fagan_bradley: 345.5857952,
      yukteshwar: 347.8472922,
      jn_bhasin: 347.5639582,
      usha_shashi: 350.2685542,
      nil: 10.7039716,
    },
  } },
  { label: 'Tromso 2010', utc: '2010-12-21T03:00:00Z', bodies: {
    Sun: {
      lahiri: 245.1094605,
      raman: 246.5557618,
      fagan_bradley: 244.2262529,
      yukteshwar: 246.4877498,
      jn_bhasin: 246.2044158,
      usha_shashi: 248.9090118,
      nil: 269.1245239,
    },
    Moon: {
      lahiri: 62.3509176,
      raman: 63.7972189,
      fagan_bradley: 61.4677099,
      yukteshwar: 63.7292069,
      jn_bhasin: 63.4458729,
      usha_shashi: 66.1504689,
      nil: 86.3659810,
    },
  } },
];

const KL_CUSPS: Record<string, number[]> = {
  lahiri: [307.6321679, 340.6982017, 12.8538783, 42.1587614, 69.5204664, 97.2853496, 127.6321679, 160.6982017, 192.8538783, 222.1587614, 249.5204664, 277.2853496],
  raman: [309.0784692, 342.1445031, 14.3001796, 43.6050628, 70.9667678, 98.7316510, 129.0784692, 162.1445031, 194.3001796, 223.6050628, 250.9667678, 278.7316510],
  fagan_bradley: [306.7489603, 339.8149941, 11.9706706, 41.2755538, 68.6372588, 96.4021420, 126.7489603, 159.8149941, 191.9706706, 221.2755538, 248.6372588, 276.4021420],
  yukteshwar: [309.0104572, 342.0764911, 14.2321676, 43.5370508, 70.8987558, 98.6636390, 129.0104572, 162.0764911, 194.2321676, 223.5370508, 250.8987558, 278.6636390],
  jn_bhasin: [308.7271232, 341.7931571, 13.9488336, 43.2537168, 70.6154218, 98.3803050, 128.7271232, 161.7931571, 193.9488336, 223.2537168, 250.6154218, 278.3803050],
  usha_shashi: [311.4317192, 344.4977531, 16.6534296, 45.9583128, 73.3200178, 101.0849010, 131.4317192, 164.4977531, 196.6534296, 225.9583128, 253.3200178, 281.0849010],
  nil: [331.3850086, 4.4510425, 36.6067190, 65.9116022, 93.2733072, 121.0381904, 151.3850086, 184.4510425, 216.6067190, 245.9116022, 273.2733072, 301.0381904],
};

const MEAN_AYANAMSA_ARCSEC = 0.05;
const SUN_ARCSEC = 2;
const MOON_ARCSEC = 6;
const CUSP_ARCSEC = 0.5;

/** Smallest signed angular difference a - b in arcseconds. */
function diffArcsec(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d * 3600;
}

/** Julian Day (TT) of a UTC instant, the time scale `calculateEphemeris` evaluates the ayanamsa in. */
function jdTt(utc: string): number {
  return Astronomy.MakeTime(new Date(utc)).tt + 2451545.0;
}

/** Test fixtures for the options that are still open (TODO(#22), TODO(#23), TODO(#24)); not defaults. */
const OPTIONS = (ayanamsa: AyanamsaMode): ChartCalculationOptions => ({
  ayanamsa,
  nodeAgentRuleSet: 'none',
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
});

describe('supported ayanamsa modes (#29, owner)', () => {
  it('lists exactly the nine explicit ids: KP Old, KP New and the seven added', () => {
    expect([...AYANAMSA_MODES].sort()).toEqual(
      ['kp_old', 'kp_new', 'lahiri', 'raman', 'fagan_bradley', 'yukteshwar', 'jn_bhasin', 'usha_shashi', 'nil'].sort()
    );
  });

  it('each SE-defined mode names its Swiss Ephemeris constant and has a sane definition', () => {
    expect(SE_AYANAMSA_DEFINITIONS.lahiri.seConstant).toBe('SE_SIDM_LAHIRI');
    expect(SE_AYANAMSA_DEFINITIONS.raman.seConstant).toBe('SE_SIDM_RAMAN');
    expect(SE_AYANAMSA_DEFINITIONS.fagan_bradley.seConstant).toBe('SE_SIDM_FAGAN_BRADLEY');
    expect(SE_AYANAMSA_DEFINITIONS.yukteshwar.seConstant).toBe('SE_SIDM_YUKTESHWAR');
    expect(SE_AYANAMSA_DEFINITIONS.jn_bhasin.seConstant).toBe('SE_SIDM_JN_BHASIN');
    expect(SE_AYANAMSA_DEFINITIONS.usha_shashi.seConstant).toBe('SE_SIDM_USHASHASHI');
    expect(Object.keys(SE_AYANAMSA_DEFINITIONS).sort()).toEqual([...SE_MODES].sort());
  });

  it('is rejected, not defaulted, for anything that is not an exact lowercase id', () => {
    for (const bad of ['Lahiri', 'LAHIRI', 'KP_OLD', 'kp-old', 'lahiri2', '', ' ', 'default', 'tropical', 'constructor', '__proto__', undefined, null, 0]) {
      expect(isAyanamsaMode(bad), String(bad)).toBe(false);
      expect(() => calculateAyanamsa(2451545.0, bad as never), String(bad)).toThrow(/ayanamsa/i);
      expect(() => calculateEphemeris(new Date('2000-01-01T12:00:00Z'), { ayanamsa: bad as never }), String(bad)).toThrow(/ayanamsa/i);
      expect(validateAyanamsa(bad), String(bad)).not.toBeNull();
    }
    for (const bad of ['Lahiri', 'KP_OLD', 'kp-old', '']) {
      expect(() => calculateChart(KL, OPTIONS(bad as never)), bad).toThrow(/ayanamsa/i);
    }
  });
});

describe.each(MEAN_REFERENCE)('mean ayanamsa vs Swiss Ephemeris: $label', (ref) => {
  it.each(SE_MODES)(`%s within ${MEAN_AYANAMSA_ARCSEC}"`, (mode) => {
    const got = calculateAyanamsa(jdTt(ref.utc), mode).meanAyanamsa;
    expect(Math.abs(got - ref.mean[mode]) * 3600).toBeLessThanOrEqual(MEAN_AYANAMSA_ARCSEC);
  });

  it('nil is 0 (mean and true), whatever the nutation passed in', () => {
    const r = calculateAyanamsa(jdTt(ref.utc), 'nil', 0.004);
    expect(r.meanAyanamsa).toBe(0);
    expect(r.trueAyanamsa).toBe(0);
  });
});

describe('true ayanamsa of the SE-defined modes', () => {
  it.each(SE_MODES)('%s: true = mean + the nutation passed in', (mode) => {
    const r = calculateAyanamsa(2451545.0, mode, 0.004);
    expect(r.trueAyanamsa - r.meanAyanamsa).toBeCloseTo(0.004, 12);
    expect(calculateAyanamsa(2451545.0, mode).trueAyanamsa).toBe(r.meanAyanamsa);
  });
});

describe.each(BODY_REFERENCE)('sidereal Sun and Moon vs Swiss Ephemeris: $label', (ref) => {
  const date = new Date(ref.utc);

  describe.each(SE_MODES)('%s', (mode) => {
    const eph = calculateEphemeris(date, { ayanamsa: mode });
    it(`Sun within ${SUN_ARCSEC}"`, () => {
      const p = eph.planets.find((x) => x.name === 'Sun')!;
      expect(Math.abs(diffArcsec(p.siderealLongitude, ref.bodies.Sun[mode]))).toBeLessThanOrEqual(SUN_ARCSEC);
    });
    it(`Moon within ${MOON_ARCSEC}"`, () => {
      const p = eph.planets.find((x) => x.name === 'Moon')!;
      expect(Math.abs(diffArcsec(p.siderealLongitude, ref.bodies.Moon[mode]))).toBeLessThanOrEqual(MOON_ARCSEC);
    });
    it('sidereal = tropical - (mean ayanamsa + dPsi)', () => {
      for (const p of eph.planets) {
        expect(diffArcsec(p.tropicalLongitude - (eph.meanAyanamsaDeg + eph.nutationInLongitudeDeg), p.siderealLongitude)).toBeCloseTo(0, 6);
      }
    });
  });

  describe('nil (tropical)', () => {
    const eph = calculateEphemeris(date, { ayanamsa: 'nil' });
    it('sidereal longitude = tropical longitude exactly, for every body', () => {
      expect(eph.meanAyanamsaDeg).toBe(0);
      expect(eph.trueAyanamsaDeg).toBe(0);
      for (const p of eph.planets) {
        expect(p.siderealLongitude).toBe(p.tropicalLongitude);
      }
    });
    it(`Sun within ${SUN_ARCSEC}" and Moon within ${MOON_ARCSEC}" of the Swiss Ephemeris tropical longitude`, () => {
      const sun = eph.planets.find((x) => x.name === 'Sun')!;
      const moon = eph.planets.find((x) => x.name === 'Moon')!;
      expect(Math.abs(diffArcsec(sun.siderealLongitude, ref.bodies.Sun.nil))).toBeLessThanOrEqual(SUN_ARCSEC);
      expect(Math.abs(diffArcsec(moon.siderealLongitude, ref.bodies.Moon.nil))).toBeLessThanOrEqual(MOON_ARCSEC);
    });
  });
});

const KL: DateTimeLocation = {
  year: 1992, month: 3, day: 11, hour: 6, minute: 14, second: 0, utcOffsetHours: 8, latitude: 3.139, longitude: 101.6869,
};

describe('calculateChart with the added modes (KL 1992, Placidus)', () => {
  it.each([...SE_MODES, 'nil' as const])('%s: 12 cusps within 0.5" of the Swiss Ephemeris Placidus cusps', (mode) => {
    const chart = calculateChart(KL, OPTIONS(mode));
    const ref = KL_CUSPS[mode];
    expect(chart.cusps).toHaveLength(12);
    chart.cusps.forEach((c, i) => {
      expect(Math.abs(diffArcsec(c.longitude, ref[i])), `${mode} cusp ${i + 1}`).toBeLessThanOrEqual(CUSP_ARCSEC);
    });
  });

  it('nil: the chart ayanamsa value is 0 and the Ascendant is the tropical Ascendant', () => {
    const chart = calculateChart(KL, OPTIONS('nil'));
    expect(chart.ayanamsaType).toBe('nil');
    expect(chart.ayanamsaValue).toBe(0);
    expect(chart.ascendant).toBeCloseTo(chart.cusps[0].longitude, 9);
    expect(Math.abs(diffArcsec(chart.ascendant, KL_CUSPS.nil[0]))).toBeLessThanOrEqual(CUSP_ARCSEC);
  });

  it.each(SE_MODES)('%s: chart reports the mode and the true ayanamsa that was subtracted', (mode) => {
    const chart = calculateChart(KL, OPTIONS(mode));
    const eph = calculateEphemeris(new Date('1992-03-10T22:14:00Z'), { ayanamsa: mode });
    expect(chart.ayanamsaType).toBe(mode);
    expect(chart.ayanamsaValue).toBeCloseTo(eph.trueAyanamsaDeg, 12);
    const sun = chart.planets.find((p) => p.name === 'Sun')!;
    expect(Math.abs(diffArcsec(sun.longitude, eph.planets.find((p) => p.name === 'Sun')!.siderealLongitude))).toBeLessThan(1e-6);
  });

  it('two modes differ by their ayanamsa difference: Lahiri vs Fagan-Bradley', () => {
    const a = calculateChart(KL, OPTIONS('lahiri'));
    const b = calculateChart(KL, OPTIONS('fagan_bradley'));
    const sunA = a.planets.find((p) => p.name === 'Sun')!.longitude;
    const sunB = b.planets.find((p) => p.name === 'Sun')!.longitude;
    expect(diffArcsec(sunA, sunB)).toBeCloseTo((b.ayanamsaValue - a.ayanamsaValue) * 3600, 6);
  });
});

describe('calculateHoraryChart with the added modes: Asc is the START of the sub', () => {
  it.each([...SE_MODES, 'nil' as const])('%s: horary 100, Asc - sub start in [0, 0.5"]', (mode) => {
    const chart = calculateHoraryChart({ questionTime: KL, horaryNumber: 100 }, OPTIONS(mode));
    const d = diffArcsec(chart.ascendant, chart.horarySubStartDeg);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(0.5);
  });
});
