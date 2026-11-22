/**
 * Ayanamsa modes added by work package add-ayanamsas (#64) vs Swiss Ephemeris 2.10.03.
 *
 * Lahiri, Raman, Fagan-Bradley, Yukteshwar, J.N. Bhasin and Usha-Shashi now follow KP-Qt's
 * precession (`kpqt-precession.ts`). The mean pins below were regenerated at UT from that
 * function (maximum move from the old Swiss Ephemeris pins: 1.429 arcsec, Raman at 2100-01-01).
 * Sun, Moon and the KL 1992 cusps for those six were regenerated with them (Sun up to 2.018",
 * Moon up to 2.572", cusps up to 1.097"). Nil is unchanged and is still the tropical comparison.
 * The external contract for these six, plus KP Ayanamsa and KP Straight Line, is
 * `test/fixtures/kpqt-ayanamsa-reference.json`.
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
  isAyanamsaMode,
} from '../src/engine/ayanamsa-defs.js';
import { KPQT_AYA_TABLE } from '../src/engine/kpqt-precession.js';
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
    lahiri: 23.74803228,
    raman: 22.30200228,
    fagan_bradley: 24.63135250,
    yukteshwar: 22.36978428,
    jn_bhasin: 22.65311828,
    usha_shashi: 19.94852228,
  } },
  { label: 'Greenwich 2000', utc: '2000-01-01T12:00:00Z', jdUt: 2451545.000000000, mean: {
    lahiri: 23.85713277,
    raman: 22.41110277,
    fagan_bradley: 24.74045298,
    yukteshwar: 22.47888477,
    jn_bhasin: 22.76221877,
    usha_shashi: 20.05762277,
  } },
  { label: 'Chennai 1950', utc: '1950-06-15T18:29:30Z', jdUt: 2433448.270486111, mean: {
    lahiri: 23.16506302,
    raman: 21.71903302,
    fagan_bradley: 24.04838328,
    yukteshwar: 21.78681502,
    jn_bhasin: 22.07014902,
    usha_shashi: 19.36555302,
  } },
  { label: 'Petaling Jaya 2026', utc: '2026-11-21T01:00:00Z', jdUt: 2461365.541666667, mean: {
    lahiri: 24.23276130,
    raman: 22.78673130,
    fagan_bradley: 25.11608148,
    yukteshwar: 22.85451330,
    jn_bhasin: 23.13784730,
    usha_shashi: 20.43325130,
  } },
  { label: 'Tromso 2010', utc: '2010-12-21T03:00:00Z', jdUt: 2455551.625000000, mean: {
    lahiri: 24.01037785,
    raman: 22.56434785,
    fagan_bradley: 24.89369805,
    yukteshwar: 22.63212985,
    jn_bhasin: 22.91546385,
    usha_shashi: 20.21086785,
  } },
  { label: '1900-01-01', utc: '1900-01-01T00:00:00Z', jdUt: 2415020.500000000, mean: {
    lahiri: 22.46048911,
    raman: 21.01445911,
    fagan_bradley: 23.34380945,
    yukteshwar: 21.08224111,
    jn_bhasin: 21.36557511,
    usha_shashi: 18.66097911,
  } },
  { label: '1950-01-01', utc: '1950-01-01T00:00:00Z', jdUt: 2433282.500000000, mean: {
    lahiri: 23.15872419,
    raman: 21.71269419,
    fagan_bradley: 24.04204446,
    yukteshwar: 21.78047619,
    jn_bhasin: 22.06381019,
    usha_shashi: 19.35921419,
  } },
  { label: '2100-01-01', utc: '2100-01-01T00:00:00Z', jdUt: 2488069.500000000, mean: {
    lahiri: 25.25439390,
    raman: 23.80836390,
    fagan_bradley: 26.13771403,
    yukteshwar: 23.87614590,
    jn_bhasin: 24.15947990,
    usha_shashi: 21.45488390,
  } },
];

const BODY_REFERENCE: BodyReference[] = [
  { label: 'KL 1992', utc: '1992-03-10T22:14:00Z', bodies: {
    Sun: {
      lahiri: 326.8471034,
      raman: 328.2931334,
      fagan_bradley: 325.9637832,
      yukteshwar: 328.2253514,
      jn_bhasin: 327.9420174,
      usha_shashi: 330.6466134,
      nil: 350.6000550,
    },
    Moon: {
      lahiri: 41.9322114,
      raman: 43.3782414,
      fagan_bradley: 41.0488912,
      yukteshwar: 43.3104594,
      jn_bhasin: 43.0271254,
      usha_shashi: 45.7317214,
      nil: 65.6854953,
    },
  } },
  { label: 'Greenwich 2000', utc: '2000-01-01T12:00:00Z', bodies: {
    Sun: {
      lahiri: 256.5154071,
      raman: 257.9614371,
      fagan_bradley: 255.6320869,
      yukteshwar: 257.8936551,
      jn_bhasin: 257.6103211,
      usha_shashi: 260.3149171,
      nil: 280.3689187,
    },
    Moon: {
      lahiri: 199.4706580,
      raman: 200.9166880,
      fagan_bradley: 198.5873378,
      yukteshwar: 200.8489060,
      jn_bhasin: 200.5655720,
      usha_shashi: 203.2701680,
      nil: 223.3237514,
    },
  } },
  { label: 'Chennai 1950', utc: '1950-06-15T18:29:30Z', bodies: {
    Sun: {
      lahiri: 60.9035591,
      raman: 62.3495891,
      fagan_bradley: 60.0202388,
      yukteshwar: 62.2818071,
      jn_bhasin: 61.9984731,
      usha_shashi: 64.7030691,
      nil: 84.0682156,
    },
    Moon: {
      lahiri: 62.1250366,
      raman: 63.5710666,
      fagan_bradley: 61.2417164,
      yukteshwar: 63.5032846,
      jn_bhasin: 63.2199506,
      usha_shashi: 65.9245466,
      nil: 85.2895232,
    },
  } },
  { label: 'Petaling Jaya 2026', utc: '2026-11-21T01:00:00Z', bodies: {
    Sun: {
      lahiri: 214.4865274,
      raman: 215.9325574,
      fagan_bradley: 213.6032072,
      yukteshwar: 215.8647754,
      jn_bhasin: 215.5814414,
      usha_shashi: 218.2860374,
      nil: 238.7217721,
    },
    Moon: {
      lahiri: 346.4701529,
      raman: 347.9161829,
      fagan_bradley: 345.5868327,
      yukteshwar: 347.8484009,
      jn_bhasin: 347.5650669,
      usha_shashi: 350.2696629,
      nil: 10.7039716,
    },
  } },
  { label: 'Tromso 2010', utc: '2010-12-21T03:00:00Z', bodies: {
    Sun: {
      lahiri: 245.1094317,
      raman: 246.5554617,
      fagan_bradley: 244.2261115,
      yukteshwar: 246.4876797,
      jn_bhasin: 246.2043457,
      usha_shashi: 248.9089417,
      nil: 269.1245239,
    },
    Moon: {
      lahiri: 62.3511543,
      raman: 63.7971843,
      fagan_bradley: 61.4678341,
      yukteshwar: 63.7294023,
      jn_bhasin: 63.4460683,
      usha_shashi: 66.1506643,
      nil: 86.3659810,
    },
  } },
];

const KL_CUSPS: Record<string, number[]> = {
  lahiri: [307.6321348, 340.6981687, 12.8538451, 42.1587282, 69.5204332, 97.2853165, 127.6321348, 160.6981687, 192.8538451, 222.1587282, 249.5204332, 277.2853165],
  raman: [309.0781648, 342.1441987, 14.2998751, 43.6047582, 70.9664632, 98.7313465, 129.0781648, 162.1441987, 194.2998751, 223.6047582, 250.9664632, 278.7313465],
  fagan_bradley: [306.7488146, 339.8148484, 11.9705249, 41.2754080, 68.6371130, 96.4019962, 126.7488146, 159.8148484, 191.9705249, 221.2754080, 248.6371130, 276.4019962],
  yukteshwar: [309.0103828, 342.0764167, 14.2320931, 43.5369762, 70.8986812, 98.6635645, 129.0103828, 162.0764167, 194.2320931, 223.5369762, 250.8986812, 278.6635645],
  jn_bhasin: [308.7270488, 341.7930827, 13.9487591, 43.2536422, 70.6153472, 98.3802305, 128.7270488, 161.7930827, 193.9487591, 223.2536422, 250.6153472, 278.3802305],
  usha_shashi: [311.4316448, 344.4976787, 16.6533551, 45.9582382, 73.3199432, 101.0848265, 131.4316448, 164.4976787, 196.6533551, 225.9582382, 253.3199432, 281.0848265],
  nil: [331.3850086, 4.4510425, 36.6067190, 65.9116022, 93.2733072, 121.0381904, 151.3850086, 184.4510425, 216.6067190, 245.9116022, 273.2733072, 301.0381904],
};

const MEAN_AYANAMSA_ARCSEC = 0.001;
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

/** Test fixtures, not defaults (#22 decided: no API default; #23 and #24 still open, TODO(#23), TODO(#24)). */
const OPTIONS = (ayanamsa: AyanamsaMode): ChartCalculationOptions => ({
  ayanamsa,
  nodeAgentRuleSet: 'none',
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
});

describe('supported ayanamsa modes (#29, owner)', () => {
  it('lists the supported ids: KPSTLA (#72), the two KP-Qt formulas, KP Old, KP New and the seven added', () => {
    expect([...AYANAMSA_MODES].sort()).toEqual(
      ['kp_straight_line_adjusted', 'kp_straight_line', 'kp_ayanamsa', 'kp_old', 'kp_new', 'lahiri', 'raman', 'fagan_bradley', 'yukteshwar', 'jn_bhasin', 'usha_shashi', 'nil'].sort()
    );
  });

  it('the six KP-Qt table modes use the kAya sidereal-mode index', () => {
    expect(KPQT_AYA_TABLE.lahiri.sidMode).toBe(1);
    expect(KPQT_AYA_TABLE.raman.sidMode).toBe(3);
    expect(KPQT_AYA_TABLE.fagan_bradley.sidMode).toBe(0);
    expect(KPQT_AYA_TABLE.yukteshwar.sidMode).toBe(7);
    expect(KPQT_AYA_TABLE.jn_bhasin.sidMode).toBe(8);
    expect(KPQT_AYA_TABLE.usha_shashi.sidMode).toBe(4);
    expect(Object.keys(KPQT_AYA_TABLE).sort()).toEqual([...SE_MODES].sort());
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

describe.each(MEAN_REFERENCE)('mean ayanamsa vs KP-Qt precession at UT: $label', (ref) => {
  it.each(SE_MODES)(`%s within ${MEAN_AYANAMSA_ARCSEC}"`, (mode) => {
    const got = calculateAyanamsa(ref.jdUt, mode).meanAyanamsa;
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

describe.each(BODY_REFERENCE)('sidereal Sun and Moon after the KP-Qt ayanamsa: $label', (ref) => {
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
  it.each([...SE_MODES, 'nil' as const])('%s: 12 cusps within 0.5" of the pinned Placidus cusps', (mode) => {
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
