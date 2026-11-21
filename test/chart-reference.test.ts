/**
 * Full charts vs Swiss Ephemeris, 5 cases x 2 ayanamsas (work package `port-chart`, #54).
 *
 * Reference values: docs/build-fix/audit.md Appendix A.1 to A.5 and A.7 (Swiss Ephemeris 2.10.03,
 * `pyswisseph`, sidereal via `FLG_SIDEREAL`, Placidus; Tromso cusps are SE's Porphyry fallback).
 * The 210 longitude/lord rows below were generated from those tables by script, not typed by hand.
 * Swiss Ephemeris was used only to generate the numbers; it is not a dependency.
 *
 * Every option passed to `calculateChart` here is a TEST FIXTURE, not a default: each one is an
 * open owner decision (#22, #23, #24, #29 Q6..Q12) and the function has no default for any of them.
 *
 * Tolerances (arcseconds), as in `ephemeris-reference.test.ts` (#41) and the work package:
 * cusps 0.5, Sun 2, Moon 6, Mars/Mercury/Jupiter/Venus/Saturn 12, mean node 1.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { calculateChart, PolarLatitudeError, getPositionLords, getDashaAtBirth } from '../src/engine/index.js';
import { calculateSignificators, calculateFourLevelSignificators } from '../src/engine/significators.js';
import { calculateVimshottariDasha } from '../src/engine/dasha.js';
import type {
  ChartCalculationOptions,
  ChartCalculationResult,
  DateTimeLocation,
  FullChartCalculationResult,
  AyanamsaMode,
} from '../src/engine/types.js';

type CaseId = 'kl1992' | 'gw2000' | 'chn1950' | 'pj2026' | 'tromso2010';

interface ReferenceCase {
  input: DateTimeLocation;
  /** ARMC from the case header in Appendix A (not available for Tromso, where Placidus fails). */
  armc?: number;
  /** A.7: day lord (null = no sunrise), running bhukti and years left in the KP Old Moon dasha. */
  dayLord: string | null;
  dashaLord: string;
  balanceYears: number;
  bhukti: string;
  bhuktiYearsLeft: number;
}

const CASES: Record<CaseId, ReferenceCase> = {
  kl1992: {
    input: { year: 1992, month: 3, day: 11, hour: 6, minute: 14, second: 0, utcOffsetHours: 8, latitude: 3.139, longitude: 101.6869 },
    armc: 244.0203059,
    dayLord: 'Mars',
    dashaLord: 'Moon',
    balanceYears: 8.47787,
    bhukti: 'Rahu',
    bhuktiYearsLeft: 1.394536,
  },
  gw2000: {
    input: { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0, utcOffsetHours: 0, latitude: 51.4779, longitude: -0.0015 },
    armc: 280.4555724,
    dayLord: 'Saturn',
    dashaLord: 'Rahu',
    balanceYears: 0.584035,
    bhukti: 'Mars',
    bhuktiYearsLeft: 0.584035,
  },
  chn1950: {
    input: { year: 1950, month: 6, day: 15, hour: 23, minute: 59, second: 30, utcOffsetHours: 5.5, latitude: 13.0827, longitude: 80.2707 },
    armc: 261.1123491,
    dayLord: 'Jupiter',
    dashaLord: 'Mars',
    balanceYears: 2.333627,
    bhukti: 'Ketu',
    bhuktiYearsLeft: 0.233627,
  },
  pj2026: {
    input: { year: 2026, month: 11, day: 21, hour: 9, minute: 0, second: 0, utcOffsetHours: 8, latitude: 3.1073, longitude: 101.6067 },
    armc: 176.6604417,
    dayLord: 'Saturn',
    dashaLord: 'Saturn',
    balanceYears: 0.143656,
    bhukti: 'Jupiter',
    bhuktiYearsLeft: 0.143656,
  },
  tromso2010: {
    input: { year: 2010, month: 12, day: 21, hour: 3, minute: 0, second: 0, utcOffsetHours: 0, latitude: 69.6492, longitude: 18.9553 },
    dayLord: null,
    dashaLord: 'Mars',
    balanceYears: 2.214921,
    bhukti: 'Ketu',
    bhuktiYearsLeft: 0.114921,
  },
};

/**
 * Fixture options. NOT defaults: each value is one of the open owner decisions.
 *  - nodeMode 'MEAN' because Appendix A's mean-node rows are what this test pins (TODO(#29 Q6)).
 *  - polarHandling 'porphyry_fallback' because that is what SE does for Tromso (TODO(#29 Q7)).
 */
const OPTIONS = (ayanamsa: AyanamsaMode): ChartCalculationOptions => ({
  ayanamsa,
  nodeMode: 'MEAN',
  nodeAgentRuleSet: 'sign_lord_star_lord_same_sign',
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
  dashaYearDays: 365.2425,
  polarHandling: 'porphyry_fallback',
  sunriseDefinition: 'upper_limb_refraction',
  nearBoundaryThresholdArcsec: 60,
  includeOuterPlanets: false,
});

const chartCache = new Map<string, FullChartCalculationResult>();
function chartFor(id: CaseId, ayanamsa: AyanamsaMode): FullChartCalculationResult {
  const key = `${id}/${ayanamsa}`;
  let chart = chartCache.get(key);
  if (!chart) {
    chart = calculateChart(CASES[id].input, OPTIONS(ayanamsa));
    chartCache.set(key, chart);
  }
  return chart;
}

// Swiss Ephemeris 2.10.03 sidereal longitudes and independently computed lords.
// Source: docs/build-fix/audit.md Appendix A.1 to A.5. [case, ayanamsa, point, longitude, sign/star/sub/sub-sub]
const APPENDIX_A: Array<[CaseId, AyanamsaMode, string, number, string]> = [
  ['kl1992', 'kp_old', 'Sun', 326.9440666, 'Saturn/Jupiter/Venus/Sun'],
  ['kl1992', 'kp_new', 'Sun', 326.9239411, 'Saturn/Jupiter/Venus/Venus'],
  ['kl1992', 'kp_old', 'Moon', 42.0295069, 'Venus/Moon/Rahu/Rahu'],
  ['kl1992', 'kp_new', 'Moon', 42.0093815, 'Venus/Moon/Rahu/Rahu'],
  ['kl1992', 'kp_old', 'Mars', 293.0611426, 'Saturn/Moon/Sun/Saturn'],
  ['kl1992', 'kp_new', 'Mars', 293.0410172, 'Saturn/Moon/Sun/Saturn'],
  ['kl1992', 'kp_old', 'Mercury', 345.0414661, 'Jupiter/Saturn/Jupiter/Jupiter'],
  ['kl1992', 'kp_new', 'Mercury', 345.0213406, 'Jupiter/Saturn/Jupiter/Jupiter'],
  ['kl1992', 'kp_old', 'Jupiter', 134.6139223, 'Sun/Venus/Venus/Jupiter'],
  ['kl1992', 'kp_new', 'Jupiter', 134.5937968, 'Sun/Venus/Venus/Jupiter'],
  ['kl1992', 'kp_old', 'Venus', 302.5516451, 'Saturn/Mars/Ketu/Saturn'],
  ['kl1992', 'kp_new', 'Venus', 302.5315197, 'Saturn/Mars/Ketu/Saturn'],
  ['kl1992', 'kp_old', 'Saturn', 290.2731592, 'Saturn/Moon/Ketu/Saturn'],
  ['kl1992', 'kp_new', 'Saturn', 290.2530337, 'Saturn/Moon/Ketu/Saturn'],
  ['kl1992', 'kp_old', 'Rahu (mean)', 252.4479023, 'Jupiter/Ketu/Mercury/Mars'],
  ['kl1992', 'kp_new', 'Rahu (mean)', 252.4277768, 'Jupiter/Ketu/Mercury/Mars'],
  ['kl1992', 'kp_old', 'Ketu (mean)', 72.4479023, 'Mercury/Rahu/Saturn/Jupiter'],
  ['kl1992', 'kp_new', 'Ketu (mean)', 72.4277768, 'Mercury/Rahu/Saturn/Jupiter'],
  ['kl1992', 'kp_old', 'Cusp 1', 307.7290202, 'Saturn/Rahu/Rahu/Mercury'],
  ['kl1992', 'kp_new', 'Cusp 1', 307.7088948, 'Saturn/Rahu/Rahu/Mercury'],
  ['kl1992', 'kp_old', 'Cusp 2', 340.7950541, 'Jupiter/Saturn/Sun/Mercury'],
  ['kl1992', 'kp_new', 'Cusp 2', 340.7749286, 'Jupiter/Saturn/Sun/Mercury'],
  ['kl1992', 'kp_old', 'Cusp 3', 12.9507306, 'Mars/Ketu/Mercury/Jupiter'],
  ['kl1992', 'kp_new', 'Cusp 3', 12.9306051, 'Mars/Ketu/Mercury/Jupiter'],
  ['kl1992', 'kp_old', 'Cusp 4', 42.2556138, 'Venus/Moon/Rahu/Jupiter'],
  ['kl1992', 'kp_new', 'Cusp 4', 42.2354883, 'Venus/Moon/Rahu/Jupiter'],
  ['kl1992', 'kp_old', 'Cusp 5', 69.6173188, 'Mercury/Rahu/Jupiter/Venus'],
  ['kl1992', 'kp_new', 'Cusp 5', 69.5971933, 'Mercury/Rahu/Jupiter/Venus'],
  ['kl1992', 'kp_old', 'Cusp 6', 97.382202, 'Moon/Saturn/Ketu/Venus'],
  ['kl1992', 'kp_new', 'Cusp 6', 97.3620765, 'Moon/Saturn/Ketu/Ketu'],
  ['kl1992', 'kp_old', 'Cusp 7', 127.7290202, 'Sun/Ketu/Jupiter/Jupiter'],
  ['kl1992', 'kp_new', 'Cusp 7', 127.7088948, 'Sun/Ketu/Jupiter/Jupiter'],
  ['kl1992', 'kp_old', 'Cusp 8', 160.7950541, 'Mercury/Moon/Moon/Mercury'],
  ['kl1992', 'kp_new', 'Cusp 8', 160.7749286, 'Mercury/Moon/Moon/Mercury'],
  ['kl1992', 'kp_old', 'Cusp 9', 192.9507306, 'Venus/Rahu/Mercury/Venus'],
  ['kl1992', 'kp_new', 'Cusp 9', 192.9306051, 'Venus/Rahu/Mercury/Ketu'],
  ['kl1992', 'kp_old', 'Cusp 10', 222.2556138, 'Mars/Saturn/Mars/Rahu'],
  ['kl1992', 'kp_new', 'Cusp 10', 222.2354883, 'Mars/Saturn/Mars/Rahu'],
  ['kl1992', 'kp_old', 'Cusp 11', 249.6173188, 'Jupiter/Ketu/Saturn/Saturn'],
  ['kl1992', 'kp_new', 'Cusp 11', 249.5971933, 'Jupiter/Ketu/Saturn/Saturn'],
  ['kl1992', 'kp_old', 'Cusp 12', 277.382202, 'Saturn/Sun/Ketu/Rahu'],
  ['kl1992', 'kp_new', 'Cusp 12', 277.3620765, 'Saturn/Sun/Ketu/Rahu'],
  ['gw2000', 'kp_old', 'Sun', 256.6125485, 'Jupiter/Venus/Moon/Jupiter'],
  ['gw2000', 'kp_new', 'Sun', 256.5924236, 'Jupiter/Venus/Moon/Jupiter'],
  ['gw2000', 'kp_old', 'Moon', 199.5673813, 'Venus/Rahu/Mars/Saturn'],
  ['gw2000', 'kp_new', 'Moon', 199.5472563, 'Venus/Rahu/Mars/Saturn'],
  ['gw2000', 'kp_old', 'Mars', 304.2069324, 'Saturn/Mars/Venus/Saturn'],
  ['gw2000', 'kp_new', 'Mars', 304.1868074, 'Saturn/Mars/Venus/Saturn'],
  ['gw2000', 'kp_old', 'Mercury', 248.1329069, 'Jupiter/Ketu/Jupiter/Mercury'],
  ['gw2000', 'kp_new', 'Mercury', 248.1127819, 'Jupiter/Ketu/Jupiter/Mercury'],
  ['gw2000', 'kp_old', 'Jupiter', 1.496717, 'Mars/Ketu/Venus/Mars'],
  ['gw2000', 'kp_new', 'Jupiter', 1.4765921, 'Mars/Ketu/Venus/Mars'],
  ['gw2000', 'kp_old', 'Venus', 217.8094182, 'Mars/Saturn/Ketu/Jupiter'],
  ['gw2000', 'kp_new', 'Venus', 217.7892933, 'Mars/Saturn/Ketu/Jupiter'],
  ['gw2000', 'kp_old', 'Saturn', 16.6392933, 'Mars/Venus/Moon/Jupiter'],
  ['gw2000', 'kp_new', 'Saturn', 16.6191684, 'Mars/Venus/Moon/Jupiter'],
  ['gw2000', 'kp_old', 'Rahu (mean)', 101.2842759, 'Moon/Saturn/Moon/Rahu'],
  ['gw2000', 'kp_new', 'Rahu (mean)', 101.2641509, 'Moon/Saturn/Moon/Rahu'],
  ['gw2000', 'kp_old', 'Ketu (mean)', 281.2842759, 'Saturn/Moon/Mars/Jupiter'],
  ['gw2000', 'kp_new', 'Ketu (mean)', 281.2641509, 'Saturn/Moon/Mars/Rahu'],
  ['gw2000', 'kp_old', 'Cusp 1', 0.5065415, 'Mars/Ketu/Ketu/Jupiter'],
  ['gw2000', 'kp_new', 'Cusp 1', 0.4864166, 'Mars/Ketu/Ketu/Jupiter'],
  ['gw2000', 'kp_old', 'Cusp 2', 37.3842096, 'Venus/Sun/Ketu/Rahu'],
  ['gw2000', 'kp_new', 'Cusp 2', 37.3640847, 'Venus/Sun/Ketu/Rahu'],
  ['gw2000', 'kp_old', 'Cusp 3', 58.2630165, 'Venus/Mars/Saturn/Mercury'],
  ['gw2000', 'kp_new', 'Cusp 3', 58.2428916, 'Venus/Mars/Saturn/Mercury'],
  ['gw2000', 'kp_old', 'Cusp 4', 75.8533342, 'Mercury/Rahu/Venus/Moon'],
  ['gw2000', 'kp_new', 'Cusp 4', 75.8332092, 'Mercury/Rahu/Venus/Moon'],
  ['gw2000', 'kp_old', 'Cusp 5', 95.303931, 'Moon/Saturn/Saturn/Jupiter'],
  ['gw2000', 'kp_new', 'Cusp 5', 95.2838061, 'Moon/Saturn/Saturn/Jupiter'],
  ['gw2000', 'kp_old', 'Cusp 6', 123.941969, 'Sun/Ketu/Moon/Rahu'],
  ['gw2000', 'kp_new', 'Cusp 6', 123.921844, 'Sun/Ketu/Moon/Rahu'],
  ['gw2000', 'kp_old', 'Cusp 7', 180.5065415, 'Venus/Mars/Mercury/Venus'],
  ['gw2000', 'kp_new', 'Cusp 7', 180.4864166, 'Venus/Mars/Mercury/Venus'],
  ['gw2000', 'kp_old', 'Cusp 8', 217.3842096, 'Mars/Saturn/Ketu/Venus'],
  ['gw2000', 'kp_new', 'Cusp 8', 217.3640847, 'Mars/Saturn/Ketu/Ketu'],
  ['gw2000', 'kp_old', 'Cusp 9', 238.2630165, 'Mars/Mercury/Saturn/Mercury'],
  ['gw2000', 'kp_new', 'Cusp 9', 238.2428916, 'Mars/Mercury/Saturn/Mercury'],
  ['gw2000', 'kp_old', 'Cusp 10', 255.8533342, 'Jupiter/Venus/Sun/Jupiter'],
  ['gw2000', 'kp_new', 'Cusp 10', 255.8332092, 'Jupiter/Venus/Sun/Jupiter'],
  ['gw2000', 'kp_old', 'Cusp 11', 275.303931, 'Saturn/Sun/Mercury/Mercury'],
  ['gw2000', 'kp_new', 'Cusp 11', 275.2838061, 'Saturn/Sun/Mercury/Mercury'],
  ['gw2000', 'kp_old', 'Cusp 12', 303.941969, 'Saturn/Mars/Venus/Jupiter'],
  ['gw2000', 'kp_new', 'Cusp 12', 303.921844, 'Saturn/Mars/Venus/Jupiter'],
  ['chn1950', 'kp_old', 'Sun', 61.000356, 'Mercury/Mars/Mercury/Mars'],
  ['chn1950', 'kp_new', 'Sun', 60.9802281, 'Mercury/Mars/Mercury/Mars'],
  ['chn1950', 'kp_old', 'Moon', 62.2216636, 'Mercury/Mars/Ketu/Rahu'],
  ['chn1950', 'kp_new', 'Moon', 62.2015357, 'Mercury/Mars/Ketu/Mars'],
  ['chn1950', 'kp_old', 'Mars', 158.4111041, 'Mercury/Sun/Venus/Moon'],
  ['chn1950', 'kp_new', 'Mars', 158.3909762, 'Mercury/Sun/Venus/Moon'],
  ['chn1950', 'kp_old', 'Mercury', 38.369697, 'Venus/Sun/Venus/Moon'],
  ['chn1950', 'kp_new', 'Mercury', 38.3495691, 'Venus/Sun/Venus/Moon'],
  ['chn1950', 'kp_old', 'Jupiter', 314.1821124, 'Saturn/Rahu/Mercury/Saturn'],
  ['chn1950', 'kp_new', 'Jupiter', 314.1619845, 'Saturn/Rahu/Mercury/Saturn'],
  ['chn1950', 'kp_old', 'Venus', 23.2874832, 'Mars/Venus/Saturn/Mars'],
  ['chn1950', 'kp_new', 'Venus', 23.2673553, 'Mars/Venus/Saturn/Moon'],
  ['chn1950', 'kp_old', 'Saturn', 140.3495955, 'Sun/Venus/Jupiter/Saturn'],
  ['chn1950', 'kp_new', 'Saturn', 140.3294676, 'Sun/Venus/Jupiter/Jupiter'],
  ['chn1950', 'kp_old', 'Rahu (mean)', 340.2668205, 'Jupiter/Saturn/Venus/Ketu'],
  ['chn1950', 'kp_new', 'Rahu (mean)', 340.2466926, 'Jupiter/Saturn/Venus/Ketu'],
  ['chn1950', 'kp_old', 'Ketu (mean)', 160.2668205, 'Mercury/Moon/Moon/Rahu'],
  ['chn1950', 'kp_new', 'Ketu (mean)', 160.2466926, 'Mercury/Moon/Moon/Rahu'],
  ['chn1950', 'kp_old', 'Cusp 1', 326.1843669, 'Saturn/Jupiter/Ketu/Rahu'],
  ['chn1950', 'kp_new', 'Cusp 1', 326.164239, 'Saturn/Jupiter/Ketu/Rahu'],
  ['chn1950', 'kp_old', 'Cusp 2', 1.3285613, 'Mars/Ketu/Venus/Moon'],
  ['chn1950', 'kp_new', 'Cusp 2', 1.3084334, 'Mars/Ketu/Venus/Moon'],
  ['chn1950', 'kp_old', 'Cusp 3', 31.9285406, 'Venus/Sun/Jupiter/Mercury'],
  ['chn1950', 'kp_new', 'Cusp 3', 31.9084127, 'Venus/Sun/Jupiter/Mercury'],
  ['chn1950', 'kp_old', 'Cusp 4', 58.7680931, 'Venus/Mars/Saturn/Venus'],
  ['chn1950', 'kp_new', 'Cusp 4', 58.7479652, 'Venus/Mars/Saturn/Venus'],
  ['chn1950', 'kp_old', 'Cusp 5', 84.736263, 'Mercury/Jupiter/Mercury/Moon'],
  ['chn1950', 'kp_new', 'Cusp 5', 84.7161351, 'Mercury/Jupiter/Mercury/Moon'],
  ['chn1950', 'kp_old', 'Cusp 6', 113.0344105, 'Moon/Mercury/Moon/Ketu'],
  ['chn1950', 'kp_new', 'Cusp 6', 113.0142826, 'Moon/Mercury/Moon/Mercury'],
  ['chn1950', 'kp_old', 'Cusp 7', 146.1843669, 'Sun/Venus/Ketu/Mars'],
  ['chn1950', 'kp_new', 'Cusp 7', 146.164239, 'Sun/Venus/Ketu/Moon'],
  ['chn1950', 'kp_old', 'Cusp 8', 181.3285613, 'Venus/Mars/Mercury/Rahu'],
  ['chn1950', 'kp_new', 'Cusp 8', 181.3084334, 'Venus/Mars/Mercury/Rahu'],
  ['chn1950', 'kp_old', 'Cusp 9', 211.9285406, 'Mars/Jupiter/Rahu/Saturn'],
  ['chn1950', 'kp_new', 'Cusp 9', 211.9084127, 'Mars/Jupiter/Rahu/Saturn'],
  ['chn1950', 'kp_old', 'Cusp 10', 238.7680931, 'Mars/Mercury/Saturn/Venus'],
  ['chn1950', 'kp_new', 'Cusp 10', 238.7479652, 'Mars/Mercury/Saturn/Venus'],
  ['chn1950', 'kp_old', 'Cusp 11', 264.736263, 'Jupiter/Venus/Mercury/Sun'],
  ['chn1950', 'kp_new', 'Cusp 11', 264.7161351, 'Jupiter/Venus/Mercury/Sun'],
  ['chn1950', 'kp_old', 'Cusp 12', 293.0344105, 'Saturn/Moon/Sun/Saturn'],
  ['chn1950', 'kp_new', 'Cusp 12', 293.0142826, 'Saturn/Moon/Sun/Saturn'],
  ['pj2026', 'kp_old', 'Sun', 214.5836556, 'Mars/Saturn/Saturn/Moon'],
  ['pj2026', 'kp_new', 'Sun', 214.5635325, 'Mars/Saturn/Saturn/Moon'],
  ['pj2026', 'kp_old', 'Moon', 346.5658552, 'Jupiter/Saturn/Jupiter/Rahu'],
  ['pj2026', 'kp_new', 'Moon', 346.545732, 'Jupiter/Saturn/Jupiter/Rahu'],
  ['pj2026', 'kp_old', 'Mars', 123.8271669, 'Sun/Ketu/Moon/Rahu'],
  ['pj2026', 'kp_new', 'Mars', 123.8070438, 'Sun/Ketu/Moon/Mars'],
  ['pj2026', 'kp_old', 'Mercury', 195.0995922, 'Venus/Rahu/Ketu/Saturn'],
  ['pj2026', 'kp_new', 'Mercury', 195.0794691, 'Venus/Rahu/Ketu/Saturn'],
  ['pj2026', 'kp_old', 'Jupiter', 122.11225, 'Sun/Ketu/Venus/Jupiter'],
  ['pj2026', 'kp_new', 'Jupiter', 122.0921268, 'Sun/Ketu/Venus/Jupiter'],
  ['pj2026', 'kp_old', 'Venus', 179.6770784, 'Mercury/Mars/Saturn/Rahu'],
  ['pj2026', 'kp_new', 'Venus', 179.6569553, 'Mercury/Mars/Saturn/Rahu'],
  ['pj2026', 'kp_old', 'Saturn', 344.1487878, 'Jupiter/Saturn/Rahu/Ketu'],
  ['pj2026', 'kp_new', 'Saturn', 344.1286646, 'Jupiter/Saturn/Rahu/Ketu'],
  ['pj2026', 'kp_old', 'Rahu (mean)', 300.8741479, 'Saturn/Mars/Mercury/Moon'],
  ['pj2026', 'kp_new', 'Rahu (mean)', 300.8540247, 'Saturn/Mars/Mercury/Moon'],
  ['pj2026', 'kp_old', 'Ketu (mean)', 120.8741479, 'Sun/Ketu/Venus/Venus'],
  ['pj2026', 'kp_new', 'Ketu (mean)', 120.8540247, 'Sun/Ketu/Venus/Venus'],
  ['pj2026', 'kp_old', 'Cusp 1', 241.5632163, 'Jupiter/Ketu/Venus/Mars'],
  ['pj2026', 'kp_new', 'Cusp 1', 241.5430932, 'Jupiter/Ketu/Venus/Mars'],
  ['pj2026', 'kp_old', 'Cusp 2', 269.8293738, 'Jupiter/Sun/Rahu/Saturn'],
  ['pj2026', 'kp_new', 'Cusp 2', 269.8092507, 'Jupiter/Sun/Rahu/Saturn'],
  ['pj2026', 'kp_old', 'Cusp 3', 299.9639939, 'Saturn/Mars/Saturn/Jupiter'],
  ['pj2026', 'kp_new', 'Cusp 3', 299.9438708, 'Saturn/Mars/Saturn/Jupiter'],
  ['pj2026', 'kp_old', 'Cusp 4', 332.222781, 'Jupiter/Jupiter/Rahu/Mercury'],
  ['pj2026', 'kp_new', 'Cusp 4', 332.2026579, 'Jupiter/Jupiter/Rahu/Saturn'],
  ['pj2026', 'kp_old', 'Cusp 5', 4.3404748, 'Mars/Ketu/Moon/Mercury'],
  ['pj2026', 'kp_new', 'Cusp 5', 4.3203517, 'Mars/Ketu/Moon/Mercury'],
  ['pj2026', 'kp_old', 'Cusp 6', 34.0291221, 'Venus/Sun/Saturn/Venus'],
  ['pj2026', 'kp_new', 'Cusp 6', 34.008999, 'Venus/Sun/Saturn/Venus'],
  ['pj2026', 'kp_old', 'Cusp 7', 61.5632163, 'Mercury/Mars/Mercury/Jupiter'],
  ['pj2026', 'kp_new', 'Cusp 7', 61.5430932, 'Mercury/Mars/Mercury/Jupiter'],
  ['pj2026', 'kp_old', 'Cusp 8', 89.8293738, 'Mercury/Jupiter/Moon/Jupiter'],
  ['pj2026', 'kp_new', 'Cusp 8', 89.8092507, 'Mercury/Jupiter/Moon/Jupiter'],
  ['pj2026', 'kp_old', 'Cusp 9', 119.9639939, 'Moon/Mercury/Saturn/Jupiter'],
  ['pj2026', 'kp_new', 'Cusp 9', 119.9438708, 'Moon/Mercury/Saturn/Jupiter'],
  ['pj2026', 'kp_old', 'Cusp 10', 152.222781, 'Mercury/Sun/Jupiter/Venus'],
  ['pj2026', 'kp_new', 'Cusp 10', 152.2026579, 'Mercury/Sun/Jupiter/Venus'],
  ['pj2026', 'kp_old', 'Cusp 11', 184.3404748, 'Venus/Mars/Venus/Saturn'],
  ['pj2026', 'kp_new', 'Cusp 11', 184.3203517, 'Venus/Mars/Venus/Saturn'],
  ['pj2026', 'kp_old', 'Cusp 12', 214.0291221, 'Mars/Saturn/Saturn/Ketu'],
  ['pj2026', 'kp_new', 'Cusp 12', 214.008999, 'Mars/Saturn/Saturn/Ketu'],
  ['tromso2010', 'kp_old', 'Sun', 245.2063128, 'Jupiter/Ketu/Mars/Mercury'],
  ['tromso2010', 'kp_new', 'Sun', 245.1861886, 'Jupiter/Ketu/Mars/Mercury'],
  ['tromso2010', 'kp_old', 'Moon', 62.4477699, 'Mercury/Mars/Ketu/Saturn'],
  ['tromso2010', 'kp_new', 'Moon', 62.4276456, 'Mercury/Mars/Ketu/Jupiter'],
  ['tromso2010', 'kp_old', 'Mars', 256.0793162, 'Jupiter/Venus/Sun/Ketu'],
  ['tromso2010', 'kp_new', 'Mars', 256.059192, 'Jupiter/Venus/Sun/Mercury'],
  ['tromso2010', 'kp_old', 'Mercury', 242.6503949, 'Jupiter/Ketu/Venus/Mercury'],
  ['tromso2010', 'kp_new', 'Mercury', 242.6302706, 'Jupiter/Ketu/Venus/Mercury'],
  ['tromso2010', 'kp_old', 'Jupiter', 331.3314708, 'Jupiter/Jupiter/Mars/Moon'],
  ['tromso2010', 'kp_new', 'Jupiter', 331.3113466, 'Jupiter/Jupiter/Mars/Moon'],
  ['tromso2010', 'kp_old', 'Venus', 199.8073222, 'Venus/Rahu/Mars/Venus'],
  ['tromso2010', 'kp_new', 'Venus', 199.787198, 'Venus/Rahu/Mars/Venus'],
  ['tromso2010', 'kp_old', 'Saturn', 172.1654533, 'Mercury/Moon/Venus/Saturn'],
  ['tromso2010', 'kp_new', 'Saturn', 172.1453291, 'Mercury/Moon/Venus/Saturn'],
  ['tromso2010', 'kp_old', 'Rahu (mean)', 248.9651793, 'Jupiter/Ketu/Jupiter/Mars'],
  ['tromso2010', 'kp_new', 'Rahu (mean)', 248.9450551, 'Jupiter/Ketu/Jupiter/Moon'],
  ['tromso2010', 'kp_old', 'Ketu (mean)', 68.9651793, 'Mercury/Rahu/Jupiter/Saturn'],
  ['tromso2010', 'kp_new', 'Ketu (mean)', 68.9450551, 'Mercury/Rahu/Jupiter/Saturn'],
  ['tromso2010', 'kp_old', 'Cusp 1', 187.231406, 'Venus/Rahu/Rahu/Jupiter'],
  ['tromso2010', 'kp_new', 'Cusp 1', 187.211282, 'Venus/Rahu/Rahu/Jupiter'],
  ['tromso2010', 'kp_old', 'Cusp 2', 227.355269, 'Mars/Mercury/Mercury/Venus'],
  ['tromso2010', 'kp_new', 'Cusp 2', 227.335145, 'Mars/Mercury/Mercury/Venus'],
  ['tromso2010', 'kp_old', 'Cusp 3', 267.479133, 'Jupiter/Sun/Moon/Mars'],
  ['tromso2010', 'kp_new', 'Cusp 3', 267.459009, 'Jupiter/Sun/Moon/Mars'],
  ['tromso2010', 'kp_old', 'Cusp 4', 307.602996, 'Saturn/Rahu/Rahu/Mercury'],
  ['tromso2010', 'kp_new', 'Cusp 4', 307.582872, 'Saturn/Rahu/Rahu/Mercury'],
  ['tromso2010', 'kp_old', 'Cusp 5', 327.479133, 'Saturn/Jupiter/Venus/Rahu'],
  ['tromso2010', 'kp_new', 'Cusp 5', 327.459009, 'Saturn/Jupiter/Venus/Rahu'],
  ['tromso2010', 'kp_old', 'Cusp 6', 347.355269, 'Jupiter/Mercury/Mercury/Venus'],
  ['tromso2010', 'kp_new', 'Cusp 6', 347.335145, 'Jupiter/Mercury/Mercury/Venus'],
  ['tromso2010', 'kp_old', 'Cusp 7', 7.231406, 'Mars/Ketu/Rahu/Sun'],
  ['tromso2010', 'kp_new', 'Cusp 7', 7.211282, 'Mars/Ketu/Rahu/Sun'],
  ['tromso2010', 'kp_old', 'Cusp 8', 47.355269, 'Venus/Moon/Saturn/Rahu'],
  ['tromso2010', 'kp_new', 'Cusp 8', 47.335145, 'Venus/Moon/Saturn/Rahu'],
  ['tromso2010', 'kp_old', 'Cusp 9', 87.479133, 'Mercury/Jupiter/Venus/Rahu'],
  ['tromso2010', 'kp_new', 'Cusp 9', 87.459009, 'Mercury/Jupiter/Venus/Rahu'],
  ['tromso2010', 'kp_old', 'Cusp 10', 127.602996, 'Sun/Ketu/Jupiter/Jupiter'],
  ['tromso2010', 'kp_new', 'Cusp 10', 127.582872, 'Sun/Ketu/Jupiter/Jupiter'],
  ['tromso2010', 'kp_old', 'Cusp 11', 147.479133, 'Sun/Sun/Moon/Mars'],
  ['tromso2010', 'kp_new', 'Cusp 11', 147.459009, 'Sun/Sun/Moon/Mars'],
  ['tromso2010', 'kp_old', 'Cusp 12', 167.355269, 'Mercury/Moon/Saturn/Rahu'],
  ['tromso2010', 'kp_new', 'Cusp 12', 167.335145, 'Mercury/Moon/Saturn/Rahu'],
];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const ARCSEC = 3600;

function wrapDeg(d: number): number {
  let x = d % 360;
  if (x > 180) x -= 360;
  if (x <= -180) x += 360;
  return x;
}

/** Tolerance in arcseconds for a Swiss Ephemeris point (see the file header). */
function toleranceArcsec(point: string): number {
  if (point.startsWith('Cusp')) return 0.5;
  if (point === 'Sun') return 2;
  if (point === 'Moon') return 6;
  if (point.startsWith('Rahu') || point.startsWith('Ketu')) return 1; // mean node
  return 12; // Mars, Mercury, Jupiter, Venus, Saturn
}

/** The chart's value for an Appendix A point name. */
function pointOf(chart: FullChartCalculationResult, point: string) {
  const cusp = /^Cusp (\d+)$/.exec(point);
  if (cusp) return chart.cusps[Number(cusp[1]) - 1];
  const name = point.replace(' (mean)', '');
  const planet = chart.planets.find((p) => p.name === name);
  if (!planet) throw new Error(`no planet ${name} in chart`);
  return planet;
}

function lordString(p: { signLord: string; starLord: string; subLord: string; subSubLord: string }): string {
  return [p.signLord, p.starLord, p.subLord, p.subSubLord].join('/');
}

/** Distance in arcsec from the SE longitude to the nearest sub-sub edge (every sub and star edge is one). */
function seDistanceToBoundaryArcsec(seLon: number): number {
  const b = getPositionLords(seLon, { nearBoundaryThresholdArcsec: 0 });
  return Math.min(b.distanceFromSubSubStartArcsec, b.distanceToSubSubEndArcsec);
}

function rowKey(row: (typeof APPENDIX_A)[number]): string {
  return `${row[0]} ${row[1]} ${row[2]}`;
}

/** Rows within tolerance of a sub-sub edge: the audit's three exceptions (section 3.2 #8). */
const EXEMPT_ROWS = ['chn1950 kp_old Saturn', 'pj2026 kp_old Mars', 'tromso2010 kp_old Jupiter'];

// ---------------------------------------------------------------------------
// positions and lords
// ---------------------------------------------------------------------------

describe('calculateChart vs Swiss Ephemeris: positions and lords (5 cases x 2 ayanamsas)', () => {
  it('has the 210 Appendix A rows (5 cases x 2 ayanamsas x 21 points)', () => {
    expect(APPENDIX_A).toHaveLength(210);
  });

  it.each(APPENDIX_A)('%s %s %s @ %f is %s', (id, mode, point, seLon, lords) => {
    const got = pointOf(chartFor(id, mode), point);
    const tol = toleranceArcsec(point);

    const errArcsec = Math.abs(wrapDeg(got.longitude - seLon)) * ARCSEC;
    expect(errArcsec).toBeLessThanOrEqual(tol);

    // Lords are exact unless SE puts the point closer to a sub-sub edge than the tolerance:
    // there the position error alone can legitimately flip a lord (see the exceptions test below).
    if (seDistanceToBoundaryArcsec(seLon) > tol) {
      expect(lordString(got)).toBe(lords);
    }
  });

  it('only these points sit within tolerance of a boundary and are exempt from the lord check', () => {
    const exempt = APPENDIX_A.filter((row) => seDistanceToBoundaryArcsec(row[3]) <= toleranceArcsec(row[2])).map(rowKey);
    expect(exempt).toEqual(EXEMPT_ROWS);
  });

  it('exempt points: Chennai 1950 Saturn and PJ 2026 Mars (KP Old) are flagged as near a sub-sub edge', () => {
    // SE distances to the sub-sub edge: 5.2 arcsec and 11.1 arcsec (audit section 3.2 #8).
    const saturn = chartFor('chn1950', 'kp_old').planets.find((p) => p.name === 'Saturn')!;
    const mars = chartFor('pj2026', 'kp_old').planets.find((p) => p.name === 'Mars')!;
    expect(seDistanceToBoundaryArcsec(140.3495955)).toBeCloseTo(5.2, 0);
    expect(seDistanceToBoundaryArcsec(123.8271669)).toBeCloseTo(11.1, 0);
    expect(saturn.isNearSubSubBoundary).toBe(true);
    expect(mars.isNearSubSubBoundary).toBe(true);
  });

  it('exempt point: Tromso 2010 Jupiter (KP Old, 6.7 arcsec from a sub edge) is flagged as near a sub edge', () => {
    const jupiter = chartFor('tromso2010', 'kp_old').planets.find((p) => p.name === 'Jupiter')!;
    expect(seDistanceToBoundaryArcsec(331.3314708)).toBeCloseTo(6.7, 0);
    expect(jupiter.isNearSubBoundary).toBe(true);
  });

  it('ARMC is within 0.5 arcsec of Appendix A', () => {
    for (const id of ['kl1992', 'gw2000', 'chn1950', 'pj2026'] as const) {
      const chart = chartFor(id, 'kp_old');
      expect(Math.abs(wrapDeg(chart.armc - CASES[id].armc!)) * ARCSEC, id).toBeLessThanOrEqual(0.5);
    }
  });
});

// ---------------------------------------------------------------------------
// houses, ascendant, consistency
// ---------------------------------------------------------------------------

describe('calculateChart: cusps, houses and consistency', () => {
  const ids: CaseId[] = ['kl1992', 'gw2000', 'chn1950', 'pj2026', 'tromso2010'];

  it.each(ids)('%s: ascendant is cusp 1, midheaven is cusp 10 within 0.5 arcsec of Appendix A, 12 cusps', (id) => {
    const chart = chartFor(id, 'kp_old');
    expect(chart.cusps).toHaveLength(12);
    expect(chart.ascendant).toBeCloseTo(chart.cusps[0].longitude, 9);
    // Tromso is Porphyry: its MC is cusp 10 too.
    expect(chart.midheaven).toBeCloseTo(chart.cusps[9].longitude, 9);
  });

  it.each(ids)('%s: every planet is in the house of the cusp it has passed, not its sign', (id) => {
    const chart = chartFor(id, 'kp_old');
    const cusps = chart.cusps.map((c) => c.longitude);
    for (const p of chart.planets) {
      let expectedHouse = 0;
      for (let h = 0; h < 12; h++) {
        const start = cusps[h];
        const end = cusps[(h + 1) % 12];
        const passed = (((p.longitude - start) % 360) + 360) % 360;
        const span = (((end - start) % 360) + 360) % 360;
        if (passed < span) expectedHouse = h + 1;
      }
      expect(p.house, `${id} ${p.name}`).toBe(expectedHouse);
      expect(p.distancePassedCusp).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(ids)('%s: planetPositions mirror planets (Stack B record, same house, same lords)', (id) => {
    const chart = chartFor(id, 'kp_old');
    expect(chart.planetPositions).toHaveLength(chart.planets.length);
    chart.planetPositions.forEach((pp, i) => {
      const p = chart.planets[i];
      expect(pp.name).toBe(p.name);
      expect(pp.siderealLongitude).toBe(p.longitude);
      expect(pp.house).toBe(p.house);
      expect(pp.nakshatraNumber).toBe(p.starNumber);
      expect(lordString(pp)).toBe(lordString(p));
      // sidereal = tropical - true ayanamsa
      expect(Math.abs(wrapDeg(pp.tropicalLongitude - chart.ayanamsaValue - pp.siderealLongitude))).toBeLessThan(1e-9);
    });
  });

  it('retrograde flags: mean Rahu and Ketu are retrograde, the Sun and Moon are not', () => {
    const chart = chartFor('kl1992', 'kp_old');
    const byName = (n: string) => chart.planets.find((p) => p.name === n)!;
    expect(byName('Rahu').isRetrograde).toBe(true);
    expect(byName('Ketu').isRetrograde).toBe(true);
    expect(byName('Sun').isRetrograde).toBe(false);
    expect(byName('Moon').isRetrograde).toBe(false);
  });

  it('the Julian Day follows the civil offset: Chennai 23:59:30 +05:30 is 18:29:30 UTC (A.3 JD 2433448.270486111)', () => {
    expect(chartFor('chn1950', 'kp_old').julianDateUT).toBeCloseTo(2433448.270486111, 8);
    expect(chartFor('kl1992', 'kp_old').julianDateUT).toBeCloseTo(2448692.426388889, 8);
  });

  it('KP New minus KP Old ayanamsa is 72.44 to 72.46 arcsec; both modes are labelled', () => {
    for (const id of ids) {
      const diff = (chartFor(id, 'kp_new').ayanamsaValue - chartFor(id, 'kp_old').ayanamsaValue) * ARCSEC;
      expect(diff).toBeGreaterThan(72.4);
      expect(diff).toBeLessThan(72.5);
      expect(chartFor(id, 'kp_old').ayanamsaName).toContain('KP Old');
      expect(chartFor(id, 'kp_new').ayanamsaName).toContain('KP New');
      expect(chartFor(id, 'kp_old').ayanamsaType).toBe('kp_old');
    }
  });

  it('66.5 N is Placidus, not clamped or treated as polar (#35), even with polarHandling "refuse"', () => {
    const chart = calculateChart(
      { ...CASES.kl1992.input, latitude: 66.5 },
      { ...OPTIONS('kp_old'), polarHandling: 'refuse' }
    );
    expect(chart.isPolarFallback).toBe(false);
    expect(chart.warnings.filter((w) => w.code === 'polar_fallback')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// polar latitude
// ---------------------------------------------------------------------------

describe('calculateChart: polar latitude (#29 Q7)', () => {
  it('Tromso 69.65 N returns Porphyry cusps with isPolarFallback and a polar_fallback warning', () => {
    for (const mode of ['kp_old', 'kp_new'] as const) {
      const chart = chartFor('tromso2010', mode);
      expect(chart.isPolarFallback).toBe(true);
      const polar = chart.warnings.filter((w) => w.code === 'polar_fallback');
      expect(polar).toHaveLength(1);
      expect(polar[0].message).toMatch(/Porphyry/);
    }
  });

  it('a non-polar chart has isPolarFallback false and no polar warning', () => {
    for (const id of ['kl1992', 'gw2000', 'chn1950', 'pj2026'] as const) {
      const chart = chartFor(id, 'kp_old');
      expect(chart.isPolarFallback).toBe(false);
      expect(chart.warnings.some((w) => w.code === 'polar_fallback')).toBe(false);
    }
  });

  it("'refuse' throws PolarLatitudeError at Tromso", () => {
    expect(() =>
      calculateChart(CASES.tromso2010.input, { ...OPTIONS('kp_old'), polarHandling: 'refuse' })
    ).toThrow(PolarLatitudeError);
  });

  it('an unknown polarHandling throws even at a non-polar latitude (no silent default)', () => {
    expect(() =>
      calculateChart(CASES.kl1992.input, {
        ...OPTIONS('kp_old'),
        // @ts-expect-error not a PolarHandling
        polarHandling: 'clamp',
      })
    ).toThrow(/polarHandling/);
  });
});

// ---------------------------------------------------------------------------
// ruling planets and dasha
// ---------------------------------------------------------------------------

describe('calculateChart: ruling planets (#36) and dasha (#37)', () => {
  const ids: CaseId[] = ['kl1992', 'gw2000', 'chn1950', 'pj2026', 'tromso2010'];

  it('KL 1992 06:14 +08:00 is before sunrise: the day lord is Mars, not Mercury (#36)', () => {
    const rp = chartFor('kl1992', 'kp_old').rulingPlanets;
    expect(rp.dayLord).toBe('Mars');
    expect(rp.sunriseStatus).toBe('ok');
    // A.7: most recent sunrise 1992-03-09 23:20:59 UTC (within 60 s).
    const sunrise = Date.parse(rp.sunriseUtc!);
    expect(Math.abs(sunrise - Date.parse('1992-03-09T23:20:59Z'))).toBeLessThan(60_000);
  });

  it.each(ids)('%s: day lord is the A.7 value', (id) => {
    expect(chartFor(id, 'kp_old').rulingPlanets.dayLord).toBe(CASES[id].dayLord);
  });

  it.each(ids)('%s: ruling planets are built from the chart ascendant and Moon', (id) => {
    const chart = chartFor(id, 'kp_old');
    const moon = chart.planets.find((p) => p.name === 'Moon')!;
    const rp = chart.rulingPlanets;
    expect(rp.ascendantSignLord).toBe(chart.cusps[0].signLord);
    expect(rp.ascendantStarLord).toBe(chart.cusps[0].starLord);
    expect(rp.moonSignLord).toBe(moon.signLord);
    expect(rp.moonStarLord).toBe(moon.starLord);
    const head = [rp.ascendantStarLord, rp.ascendantSignLord, rp.moonStarLord, rp.moonSignLord];
    expect(rp.rulingPlanetsList).toEqual(rp.dayLord === null ? head : [...head, rp.dayLord]);
  });

  it('Tromso 2010-12-21 has no sunrise: no day lord, a 4-entry list and a no_sunrise warning', () => {
    const chart = chartFor('tromso2010', 'kp_old');
    expect(chart.rulingPlanets.dayLord).toBeNull();
    expect(chart.rulingPlanets.sunriseUtc).toBeNull();
    expect(chart.rulingPlanets.sunriseStatus).toBe('no_sunrise_polar_night');
    expect(chart.rulingPlanets.rulingPlanetsList).toHaveLength(4);
    const w = chart.warnings.filter((x) => x.code === 'no_sunrise');
    expect(w).toHaveLength(1);
    // and the other cases have no such warning
    for (const id of ['kl1992', 'gw2000', 'chn1950', 'pj2026'] as const) {
      expect(chartFor(id, 'kp_old').warnings.some((x) => x.code === 'no_sunrise')).toBe(false);
    }
  });

  // The Moon is within 6 arcsec of SE, and the balance of the Moon's nakshatra moves the dasha
  // balance by dasha-years / 48000 arcsec per arcsec, so this is the accuracy the dasha can have.
  const moonTolYears = (dashaYears: number) => (6 / 48000) * dashaYears + 1e-6;
  const DASHA_YEARS: Record<string, number> = { Moon: 10, Rahu: 18, Mars: 7, Saturn: 19 };

  it.each(ids)('%s: dasha lord, balance and running bhukti equal A.7 (KP Old)', (id) => {
    const ref = CASES[id];
    const chart = chartFor(id, 'kp_old');
    const moon = chart.planets.find((p) => p.name === 'Moon')!;
    expect(chart.dashaBalance.dashaLord).toBe(ref.dashaLord);

    const birth = getDashaAtBirth(moon.longitude);
    const tol = moonTolYears(DASHA_YEARS[ref.dashaLord]);
    expect(Math.abs(birth.balanceYears - ref.balanceYears)).toBeLessThanOrEqual(tol);
    expect(birth.running.bhukti.lord).toBe(ref.bhukti);
    expect(Math.abs(birth.running.bhukti.yearsLeft - ref.bhuktiYearsLeft)).toBeLessThanOrEqual(tol);

    // The timeline in the chart starts at the running bhukti (#37), not at the dasha lord's own.
    const first = chart.dashaBalance.dashaTimeline[0];
    expect(first.lord).toBe(ref.dashaLord);
    expect(first.subPeriods![0].lord).toBe(ref.bhukti);
    expect(first.subPeriods![0].durationDays).toBe(Math.round(birth.running.bhukti.yearsLeft * 365.2425));
  });

  it('KL 1992: running bhukti is Rahu with 1.394536 y left; the Moon dasha lists 7 bhuktis, not 9 (#37)', () => {
    const chart = chartFor('kl1992', 'kp_old');
    const moon = chart.planets.find((p) => p.name === 'Moon')!;
    const birth = getDashaAtBirth(moon.longitude);
    expect(birth.running.bhukti.lord).toBe('Rahu');
    expect(birth.running.bhukti.yearsLeft).toBeCloseTo(1.394536, 2);
    const first = chart.dashaBalance.dashaTimeline[0];
    expect(first.subPeriods!.map((b) => b.lord)).toEqual([
      'Rahu', 'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus', 'Sun',
    ]);
  });

  it('dasha months follow dashaYearDays / 12, not a hidden 30.4375 (#29 Q17)', () => {
    const moonLon = chartFor('kl1992', 'kp_old').planets.find((p) => p.name === 'Moon')!.longitude;
    const birth = getDashaAtBirth(moonLon);
    const whole = Math.floor(birth.balanceYears);
    const months = (birth.balanceYears - whole) * 12;
    const wholeMonths = Math.floor(months);
    const frac = months - wholeMonths;
    const at = new Date('1992-03-10T22:14:00Z');
    for (const yearDays of [360, 365.25, 365.2425, 720]) {
      const d = calculateVimshottariDasha(moonLon, at, { dashaYearDays: yearDays });
      expect(d.balanceYears).toBe(whole);
      expect(d.balanceMonths).toBe(wholeMonths);
      expect(d.balanceDays).toBe(Math.round(frac * (yearDays / 12)));
    }
  });

  it('the chart passes dashaYearDays through to the timeline dates', () => {
    const input = CASES.kl1992.input;
    const a = calculateChart(input, { ...OPTIONS('kp_old'), dashaYearDays: 360 });
    const b = calculateChart(input, { ...OPTIONS('kp_old'), dashaYearDays: 365.25 });
    const lastA = a.dashaBalance.dashaTimeline.at(-1)!.endDate;
    const lastB = b.dashaBalance.dashaTimeline.at(-1)!.endDate;
    expect(lastA < lastB).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// significators
// ---------------------------------------------------------------------------

describe('calculateChart: significators', () => {
  const ids: CaseId[] = ['kl1992', 'gw2000', 'chn1950', 'pj2026', 'tromso2010'];

  it.each(ids)('%s: the Stack B layout has the same members as the four house levels of Stack A', (id) => {
    const chart = chartFor(id, 'kp_old');
    for (const hw of chart.significators.houseWise) {
      const b = chart.nodeAgentSignificators.houseWise[hw.house];
      expect(b.level1).toEqual(hw.level1);
      expect(b.level2).toEqual(hw.level2);
      expect(b.level3).toEqual(hw.level3);
      expect(b.level4).toEqual(hw.level4);
    }
  });

  it('planet names come from PlanetName, so asPlanetNames drops nothing (also with the outer planets)', () => {
    // asPlanetNames is private to significators.ts. A name it dropped would be missing from the
    // Stack B layout but present in Stack A's lists, so compare every level, with and without
    // Uranus, Neptune and Pluto in the planets passed in.
    const chart = calculateChart(CASES.kl1992.input, { ...OPTIONS('kp_old'), includeOuterPlanets: true });
    const outerNames = ['Uranus', 'Neptune', 'Pluto'];
    expect(chart.planets.map((p) => p.name)).toEqual(
      expect.arrayContaining(outerNames)
    );
    for (const set of ['none', 'sign_lord_star_lord_same_sign'] as const) {
      const a = calculateSignificators(chart.cusps, chart.planets);
      const b = calculateFourLevelSignificators(chart.cusps, chart.planets, set);
      for (const hw of a.houseWise) {
        expect(b.houseWise[hw.house].level1).toEqual(hw.level1);
        expect(b.houseWise[hw.house].level2).toEqual(hw.level2);
        expect(b.houseWise[hw.house].level3).toEqual(hw.level3);
        expect(b.houseWise[hw.house].level4).toEqual(hw.level4);
      }
    }
    // every name in a chart is a PlanetName
    for (const p of chart.planetPositions) {
      expect(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', ...outerNames]).toContain(p.name);
    }
  });

  it('KL 1992 Rahu and Ketu agents follow the chosen rule set (TODO(#23)), and "none" lists none', () => {
    const sl = chartFor('kl1992', 'kp_old').nodeAgentSignificators;
    expect(sl.planetWise.Rahu.agentsFor).toEqual(['Jupiter', 'Ketu']);
    expect(sl.planetWise.Ketu.agentsFor).toEqual(['Mercury', 'Rahu']);
    const none = calculateChart(CASES.kl1992.input, { ...OPTIONS('kp_old'), nodeAgentRuleSet: 'none' });
    expect(none.nodeAgentSignificators.planetWise.Rahu.agentsFor).toEqual([]);
    expect(none.nodeAgentSignificators.planetWise.Ketu.agentsFor).toEqual([]);
    // the four house levels do not depend on the rule set
    expect(none.significators).toEqual(chartFor('kl1992', 'kp_old').significators);
  });

  it('the outer planets, when included, are listed and drawn but are not significators (#29 Q12)', () => {
    const without = chartFor('kl1992', 'kp_old');
    const withOuter = calculateChart(CASES.kl1992.input, { ...OPTIONS('kp_old'), includeOuterPlanets: true });
    expect(without.planets).toHaveLength(9);
    expect(withOuter.planets).toHaveLength(12);
    expect(withOuter.planetPositions).toHaveLength(12);
    expect(withOuter.significators).toEqual(without.significators);
    expect(withOuter.nodeAgentSignificators).toEqual(without.nodeAgentSignificators);
    // the first nine planets are unchanged by including them
    expect(withOuter.planets.slice(0, 9)).toEqual(without.planets);
    const drawn = withOuter.chartWheels.northIndian.flatMap((h) => h.planets.map((p) => p.name));
    expect(drawn).toEqual(expect.arrayContaining(['Uranus', 'Neptune', 'Pluto']));
  });

  it('KL 1992 house 12 level 1 has Mercury, Jupiter and Venus (A.1 cusps, Stack A order)', () => {
    const chart = chartFor('kl1992', 'kp_old');
    expect([...chart.significators.houseWise[11].level1].sort()).toEqual(['Jupiter', 'Mercury', 'Venus']);
  });
});

// ---------------------------------------------------------------------------
// warnings
// ---------------------------------------------------------------------------

describe('calculateChart: near_sub_boundary warnings (#29 Q10, Q16)', () => {
  it('Chennai 1950 Saturn (sub-sub edge) and Tromso 2010 Jupiter (sub edge) are warned about', () => {
    const chn = chartFor('chn1950', 'kp_old').warnings.filter((w) => w.code === 'near_sub_boundary');
    expect(chn.map((w) => w.subject)).toContain('Saturn');
    const saturn = chn.find((w) => w.subject === 'Saturn')!;
    expect(saturn.message).toMatch(/sub-sub/);
    const tro = chartFor('tromso2010', 'kp_old').warnings.filter((w) => w.code === 'near_sub_boundary');
    expect(tro.map((w) => w.subject)).toContain('Jupiter');
  });

  it('the warning is raised when EITHER the sub or the sub-sub flag is true (TODO(#29 Q16))', () => {
    const chart = chartFor('chn1950', 'kp_old');
    const flagged = [
      ...chart.cusps.map((c) => ({ subject: `cusp ${c.house}`, p: c })),
      ...chart.planets.map((p) => ({ subject: p.name, p })),
    ].filter((x) => x.p.isNearSubBoundary || x.p.isNearSubSubBoundary).map((x) => x.subject);
    const warned = chart.warnings.filter((w) => w.code === 'near_sub_boundary').map((w) => w.subject);
    expect(warned).toEqual(flagged);
    // Saturn is near a sub-sub edge only: that alone must raise it.
    const saturn = chart.planets.find((p) => p.name === 'Saturn')!;
    expect(saturn.isNearSubBoundary).toBe(false);
    expect(saturn.isNearSubSubBoundary).toBe(true);
  });

  it('threshold 0 raises no near-boundary warning; a huge threshold flags every point', () => {
    const none = calculateChart(CASES.chn1950.input, { ...OPTIONS('kp_old'), nearBoundaryThresholdArcsec: 0 });
    expect(none.warnings.some((w) => w.code === 'near_sub_boundary')).toBe(false);
    const all = calculateChart(CASES.chn1950.input, { ...OPTIONS('kp_old'), nearBoundaryThresholdArcsec: 1e6 });
    expect(all.warnings.filter((w) => w.code === 'near_sub_boundary')).toHaveLength(12 + 9);
  });

  it('the polar fallback warning comes first and is never dropped when other warnings exist', () => {
    const chart = chartFor('tromso2010', 'kp_old');
    expect(chart.warnings[0].code).toBe('polar_fallback');
    expect(chart.warnings.map((w) => w.code)).toContain('no_sunrise');
  });
});

// ---------------------------------------------------------------------------
// required options
// ---------------------------------------------------------------------------

const ALL_OPTION_KEYS = [
  'ayanamsa',
  'nodeMode',
  'nodeAgentRuleSet',
  'rulingPlanetSet',
  'dashaYearDays',
  'polarHandling',
  'sunriseDefinition',
  'nearBoundaryThresholdArcsec',
  'includeOuterPlanets',
] as const satisfies ReadonlyArray<keyof ChartCalculationOptions>;

describe('calculateChart: every option is required, none has a default', () => {
  it('type level: calculateChart takes the full options and returns a chart with every field', () => {
    expectTypeOf(calculateChart).parameter(0).toEqualTypeOf<DateTimeLocation>();
    expectTypeOf(calculateChart).parameter(1).toEqualTypeOf<ChartCalculationOptions>();
    expectTypeOf(calculateChart).returns.toEqualTypeOf<FullChartCalculationResult>();
    expectTypeOf<FullChartCalculationResult>().toMatchTypeOf<ChartCalculationResult>();
    // no optional member in the options type
    expectTypeOf<ChartCalculationOptions>().toEqualTypeOf<Required<ChartCalculationOptions>>();
    expectTypeOf<keyof ChartCalculationOptions>().toEqualTypeOf<(typeof ALL_OPTION_KEYS)[number]>();
  });

  it.each(ALL_OPTION_KEYS)('omitting %s is a type error and throws', (key) => {
    const { [key]: _omitted, ...rest } = OPTIONS('kp_old');
    expect(() =>
      // @ts-expect-error a required option is missing
      calculateChart(CASES.kl1992.input, rest)
    ).toThrow(new RegExp(key));
  });

  it('calling without options at all is a type error and throws', () => {
    // @ts-expect-error options are required
    expect(() => calculateChart(CASES.kl1992.input)).toThrow(/options/);
  });

  it('there is no Lahiri fallback: an unknown ayanamsa throws (#22)', () => {
    for (const bad of ['lahiri', 'KP_OLD', 'default', '']) {
      expect(() =>
        // @ts-expect-error not an AyanamsaMode
        calculateChart(CASES.kl1992.input, { ...OPTIONS('kp_old'), ayanamsa: bad })
      ).toThrow(/ayanamsa/i);
    }
  });

  it.each([
    ['nodeMode', 'MEDIAN'],
    ['nodeAgentRuleSet', 'aspects'],
    ['rulingPlanetSet', 'with_nodes'],
    ['sunriseDefinition', 'astronomical'],
  ] as const)('an unknown %s (%s) throws and is never mapped to another value', (key, bad) => {
    expect(() => calculateChart(CASES.kl1992.input, { ...OPTIONS('kp_old'), [key]: bad } as never)).toThrow();
  });

  it.each([0, -365, NaN, Infinity])('dashaYearDays %s is rejected', (days) => {
    expect(() => calculateChart(CASES.kl1992.input, { ...OPTIONS('kp_old'), dashaYearDays: days })).toThrow();
  });

  it.each([-1, NaN])('nearBoundaryThresholdArcsec %s is rejected', (t) => {
    expect(() => calculateChart(CASES.kl1992.input, { ...OPTIONS('kp_old'), nearBoundaryThresholdArcsec: t })).toThrow();
  });

  it('a missing UTC offset is an error, not UTC', () => {
    const { utcOffsetHours: _tz, ...noOffset } = CASES.kl1992.input;
    expect(() => calculateChart(noOffset, OPTIONS('kp_old'))).toThrow(/utcOffsetHours/);
  });

  it('rejects impossible dates, times and places', () => {
    const base = CASES.kl1992.input;
    expect(() => calculateChart({ ...base, month: 2, day: 30 }, OPTIONS('kp_old'))).toThrow(/calendar date/);
    expect(() => calculateChart({ ...base, hour: 24 }, OPTIONS('kp_old'))).toThrow(/clock time/);
    expect(() => calculateChart({ ...base, latitude: 91 }, OPTIONS('kp_old'))).toThrow(/latitude/);
    expect(() => calculateChart({ ...base, longitude: 181 }, OPTIONS('kp_old'))).toThrow(/longitude/);
    expect(() => calculateChart({ ...base, year: NaN }, OPTIONS('kp_old'))).toThrow(/year/);
  });

  it('the node mode is passed through: TRUE and MEAN Rahu differ (KL 1992: about +0.45 deg)', () => {
    const mean = chartFor('kl1992', 'kp_old').planets.find((p) => p.name === 'Rahu')!;
    const trueNode = calculateChart(CASES.kl1992.input, { ...OPTIONS('kp_old'), nodeMode: 'TRUE' });
    const rahu = trueNode.planets.find((p) => p.name === 'Rahu')!;
    expect(trueNode.nodeMode).toBe('TRUE');
    expect(chartFor('kl1992', 'kp_old').nodeMode).toBe('MEAN');
    expect(rahu.longitude - mean.longitude).toBeGreaterThan(0.4);
    expect(rahu.longitude - mean.longitude).toBeLessThan(0.5);
  });
});
