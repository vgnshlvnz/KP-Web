import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  getPositionLords,
  getHorary249Table,
  getHoraryEntry,
  buildKPCusp,
  formatDMS,
  VIMSHOTTARI_LORDS,
  DASHA_YEARS,
  NAKSHATRAS,
  NAKSHATRA_SPAN_DEG,
  ZODIAC_SIGNS,
  TOTAL_DASHA_YEARS,
} from '../src/engine/kp-lords.js';
import type { KPPlanetLord, KPPositionLords, SubBoundaryInfo } from '../src/engine/types.js';

describe('KP Lords and 1-249 Sub Table', () => {
  it('generates exactly 249 horary numbers in the table', () => {
    const table = getHorary249Table();
    expect(table).toHaveLength(249);
    expect(table[0].number).toBe(1);
    expect(table[248].number).toBe(249);
  });

  it('verifies sub 108 is at 3°00′ Virgo with star Sun and sub Saturn', () => {
    // From docs/research.md:
    // "For example, 108 gives 3°00′ Virgo"
    const table = getHorary249Table();
    const sub108 = table[107]; // 0-indexed

    expect(sub108.number).toBe(108);
    expect(sub108.signName).toBe('Virgo');
    expect(sub108.starLord).toBe('Sun');    // Uttara Phalguni (Sun)
    expect(sub108.subLord).toBe('Saturn');

    // 3°00' Virgo corresponds to longitude 150° + 3° = 153°
    expect(sub108.startLongitude).toBeCloseTo(153.0, 4);
  });

  it('correctly formats degrees, minutes, and seconds', () => {
    const dms = formatDMS(3.67); // 3° + 0.67*60' = 3° 40' 12"
    expect(dms.degrees).toBe(3);
    expect(dms.minutes).toBe(40);
    expect(dms.seconds).toBe(12);
    expect(dms.formatted).toBe('03°40\'12"');
  });

  it('derives sign, star, sub, and sub-sub lords for arbitrary longitude', () => {
    // Test 37.829122° (Taurus 7°49'45")
    const lords = getPositionLords(37.829122);

    expect(lords.signName).toBe('Taurus');
    expect(lords.signLord).toBe('Venus');
    // Krittika nakshatra spans 26°40' Aries to 10°00' Taurus (26.666° to 40.0°)
    expect(lords.starName).toBe('Krittika');
    expect(lords.starLord).toBe('Sun');
    expect(lords.subLord).toBeDefined();
    expect(lords.subSubLord).toBeDefined();
    expect(lords.horary249Number).toBeGreaterThanOrEqual(1);
    expect(lords.horary249Number).toBeLessThanOrEqual(249);
  });

  it('builds a complete KPCusp object with house span', () => {
    const cusp = buildKPCusp(1, 37.829122, 63.438101);
    expect(cusp.house).toBe(1);
    expect(cusp.longitude).toBe(37.829122);
    expect(cusp.nextCuspLongitude).toBe(63.438101);
    // Span = 63.438101 - 37.829122 = 25.608979°
    expect(cusp.houseSpan).toBeCloseTo(25.608979, 4);
    expect(cusp.signLord).toBe('Venus');
  });
});

describe('exported constants stay stable (imported by dasha and ruling-planets)', () => {
  it('keeps names and values', () => {
    expect([...VIMSHOTTARI_LORDS]).toEqual([
      'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
    ]);
    expect(DASHA_YEARS).toEqual({
      Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
    });
    expect(TOTAL_DASHA_YEARS).toBe(120);
    expect(NAKSHATRA_SPAN_DEG).toBeCloseTo(360 / 27, 12);
    expect(NAKSHATRAS).toHaveLength(27);
    expect(NAKSHATRAS[0]).toEqual({ number: 1, name: 'Ashwini', lord: 'Ketu' });
    expect(NAKSHATRAS[26]).toEqual({ number: 27, name: 'Revati', lord: 'Mercury' });
    expect(ZODIAC_SIGNS).toHaveLength(12);
    expect(ZODIAC_SIGNS[0]).toEqual({ name: 'Aries', abbrev: 'Ari', lord: 'Mars' });
    expect(ZODIAC_SIGNS[11]).toEqual({ name: 'Pisces', abbrev: 'Pis', lord: 'Jupiter' });
  });
});

describe('lord fields are KPPlanetLord', () => {
  it('KPPositionLords lord fields are narrowed from string', () => {
    expectTypeOf<KPPositionLords['signLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<KPPositionLords['starLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<KPPositionLords['subLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<KPPositionLords['subSubLord']>().toEqualTypeOf<KPPlanetLord>();
  });
});

// Swiss Ephemeris 2.10.03 sidereal longitudes and independently computed lords.
// Source: docs/build-fix/audit.md Appendix A.1 to A.5. [case, ayanamsa, point, longitude, sign/star/sub/sub-sub]
const APPENDIX_A: Array<[string, 'kp_old' | 'kp_new', string, number, string]> = [
  ['kl1992', 'kp_old', 'Sun', 326.9440666, 'Saturn/Jupiter/Venus/Sun'],
  ['kl1992', 'kp_old', 'Moon', 42.0295069, 'Venus/Moon/Rahu/Rahu'],
  ['kl1992', 'kp_old', 'Mars', 293.0611426, 'Saturn/Moon/Sun/Saturn'],
  ['kl1992', 'kp_old', 'Mercury', 345.0414661, 'Jupiter/Saturn/Jupiter/Jupiter'],
  ['kl1992', 'kp_old', 'Jupiter', 134.6139223, 'Sun/Venus/Venus/Jupiter'],
  ['kl1992', 'kp_old', 'Venus', 302.5516451, 'Saturn/Mars/Ketu/Saturn'],
  ['kl1992', 'kp_old', 'Saturn', 290.2731592, 'Saturn/Moon/Ketu/Saturn'],
  ['kl1992', 'kp_old', 'Rahu (mean)', 252.4479023, 'Jupiter/Ketu/Mercury/Mars'],
  ['kl1992', 'kp_old', 'Ketu (mean)', 72.4479023, 'Mercury/Rahu/Saturn/Jupiter'],
  ['kl1992', 'kp_old', 'Rahu (true)', 252.9012358, 'Jupiter/Ketu/Mercury/Jupiter'],
  ['kl1992', 'kp_old', 'Ketu (true)', 72.9012358, 'Mercury/Rahu/Mercury/Ketu'],
  ['kl1992', 'kp_old', 'Cusp 1', 307.7290202, 'Saturn/Rahu/Rahu/Mercury'],
  ['kl1992', 'kp_old', 'Cusp 2', 340.7950541, 'Jupiter/Saturn/Sun/Mercury'],
  ['kl1992', 'kp_old', 'Cusp 3', 12.9507306, 'Mars/Ketu/Mercury/Jupiter'],
  ['kl1992', 'kp_old', 'Cusp 4', 42.2556138, 'Venus/Moon/Rahu/Jupiter'],
  ['kl1992', 'kp_old', 'Cusp 5', 69.6173188, 'Mercury/Rahu/Jupiter/Venus'],
  ['kl1992', 'kp_old', 'Cusp 6', 97.3822020, 'Moon/Saturn/Ketu/Venus'],
  ['kl1992', 'kp_old', 'Cusp 7', 127.7290202, 'Sun/Ketu/Jupiter/Jupiter'],
  ['kl1992', 'kp_old', 'Cusp 8', 160.7950541, 'Mercury/Moon/Moon/Mercury'],
  ['kl1992', 'kp_old', 'Cusp 9', 192.9507306, 'Venus/Rahu/Mercury/Venus'],
  ['kl1992', 'kp_old', 'Cusp 10', 222.2556138, 'Mars/Saturn/Mars/Rahu'],
  ['kl1992', 'kp_old', 'Cusp 11', 249.6173188, 'Jupiter/Ketu/Saturn/Saturn'],
  ['kl1992', 'kp_old', 'Cusp 12', 277.3822020, 'Saturn/Sun/Ketu/Rahu'],
  ['kl1992', 'kp_new', 'Sun', 326.9239411, 'Saturn/Jupiter/Venus/Venus'],
  ['kl1992', 'kp_new', 'Moon', 42.0093815, 'Venus/Moon/Rahu/Rahu'],
  ['kl1992', 'kp_new', 'Mars', 293.0410172, 'Saturn/Moon/Sun/Saturn'],
  ['kl1992', 'kp_new', 'Mercury', 345.0213406, 'Jupiter/Saturn/Jupiter/Jupiter'],
  ['kl1992', 'kp_new', 'Jupiter', 134.5937968, 'Sun/Venus/Venus/Jupiter'],
  ['kl1992', 'kp_new', 'Venus', 302.5315197, 'Saturn/Mars/Ketu/Saturn'],
  ['kl1992', 'kp_new', 'Saturn', 290.2530337, 'Saturn/Moon/Ketu/Saturn'],
  ['kl1992', 'kp_new', 'Rahu (mean)', 252.4277768, 'Jupiter/Ketu/Mercury/Mars'],
  ['kl1992', 'kp_new', 'Ketu (mean)', 72.4277768, 'Mercury/Rahu/Saturn/Jupiter'],
  ['kl1992', 'kp_new', 'Rahu (true)', 252.8811104, 'Jupiter/Ketu/Mercury/Jupiter'],
  ['kl1992', 'kp_new', 'Ketu (true)', 72.8811104, 'Mercury/Rahu/Mercury/Ketu'],
  ['kl1992', 'kp_new', 'Cusp 1', 307.7088948, 'Saturn/Rahu/Rahu/Mercury'],
  ['kl1992', 'kp_new', 'Cusp 2', 340.7749286, 'Jupiter/Saturn/Sun/Mercury'],
  ['kl1992', 'kp_new', 'Cusp 3', 12.9306051, 'Mars/Ketu/Mercury/Jupiter'],
  ['kl1992', 'kp_new', 'Cusp 4', 42.2354883, 'Venus/Moon/Rahu/Jupiter'],
  ['kl1992', 'kp_new', 'Cusp 5', 69.5971933, 'Mercury/Rahu/Jupiter/Venus'],
  ['kl1992', 'kp_new', 'Cusp 6', 97.3620765, 'Moon/Saturn/Ketu/Ketu'],
  ['kl1992', 'kp_new', 'Cusp 7', 127.7088948, 'Sun/Ketu/Jupiter/Jupiter'],
  ['kl1992', 'kp_new', 'Cusp 8', 160.7749286, 'Mercury/Moon/Moon/Mercury'],
  ['kl1992', 'kp_new', 'Cusp 9', 192.9306051, 'Venus/Rahu/Mercury/Ketu'],
  ['kl1992', 'kp_new', 'Cusp 10', 222.2354883, 'Mars/Saturn/Mars/Rahu'],
  ['kl1992', 'kp_new', 'Cusp 11', 249.5971933, 'Jupiter/Ketu/Saturn/Saturn'],
  ['kl1992', 'kp_new', 'Cusp 12', 277.3620765, 'Saturn/Sun/Ketu/Rahu'],
  ['gw2000', 'kp_old', 'Sun', 256.6125485, 'Jupiter/Venus/Moon/Jupiter'],
  ['gw2000', 'kp_old', 'Moon', 199.5673813, 'Venus/Rahu/Mars/Saturn'],
  ['gw2000', 'kp_old', 'Mars', 304.2069324, 'Saturn/Mars/Venus/Saturn'],
  ['gw2000', 'kp_old', 'Mercury', 248.1329069, 'Jupiter/Ketu/Jupiter/Mercury'],
  ['gw2000', 'kp_old', 'Jupiter', 1.4967170, 'Mars/Ketu/Venus/Mars'],
  ['gw2000', 'kp_old', 'Venus', 217.8094182, 'Mars/Saturn/Ketu/Jupiter'],
  ['gw2000', 'kp_old', 'Saturn', 16.6392933, 'Mars/Venus/Moon/Jupiter'],
  ['gw2000', 'kp_old', 'Rahu (mean)', 101.2842759, 'Moon/Saturn/Moon/Rahu'],
  ['gw2000', 'kp_old', 'Ketu (mean)', 281.2842759, 'Saturn/Moon/Mars/Jupiter'],
  ['gw2000', 'kp_old', 'Rahu (true)', 100.1976527, 'Moon/Saturn/Venus/Mercury'],
  ['gw2000', 'kp_old', 'Ketu (true)', 280.1976527, 'Saturn/Moon/Moon/Rahu'],
  ['gw2000', 'kp_old', 'Cusp 1', 0.5065415, 'Mars/Ketu/Ketu/Jupiter'],
  ['gw2000', 'kp_old', 'Cusp 2', 37.3842096, 'Venus/Sun/Ketu/Rahu'],
  ['gw2000', 'kp_old', 'Cusp 3', 58.2630165, 'Venus/Mars/Saturn/Mercury'],
  ['gw2000', 'kp_old', 'Cusp 4', 75.8533342, 'Mercury/Rahu/Venus/Moon'],
  ['gw2000', 'kp_old', 'Cusp 5', 95.3039310, 'Moon/Saturn/Saturn/Jupiter'],
  ['gw2000', 'kp_old', 'Cusp 6', 123.9419690, 'Sun/Ketu/Moon/Rahu'],
  ['gw2000', 'kp_old', 'Cusp 7', 180.5065415, 'Venus/Mars/Mercury/Venus'],
  ['gw2000', 'kp_old', 'Cusp 8', 217.3842096, 'Mars/Saturn/Ketu/Venus'],
  ['gw2000', 'kp_old', 'Cusp 9', 238.2630165, 'Mars/Mercury/Saturn/Mercury'],
  ['gw2000', 'kp_old', 'Cusp 10', 255.8533342, 'Jupiter/Venus/Sun/Jupiter'],
  ['gw2000', 'kp_old', 'Cusp 11', 275.3039310, 'Saturn/Sun/Mercury/Mercury'],
  ['gw2000', 'kp_old', 'Cusp 12', 303.9419690, 'Saturn/Mars/Venus/Jupiter'],
  ['gw2000', 'kp_new', 'Sun', 256.5924236, 'Jupiter/Venus/Moon/Jupiter'],
  ['gw2000', 'kp_new', 'Moon', 199.5472563, 'Venus/Rahu/Mars/Saturn'],
  ['gw2000', 'kp_new', 'Mars', 304.1868074, 'Saturn/Mars/Venus/Saturn'],
  ['gw2000', 'kp_new', 'Mercury', 248.1127819, 'Jupiter/Ketu/Jupiter/Mercury'],
  ['gw2000', 'kp_new', 'Jupiter', 1.4765921, 'Mars/Ketu/Venus/Mars'],
  ['gw2000', 'kp_new', 'Venus', 217.7892933, 'Mars/Saturn/Ketu/Jupiter'],
  ['gw2000', 'kp_new', 'Saturn', 16.6191684, 'Mars/Venus/Moon/Jupiter'],
  ['gw2000', 'kp_new', 'Rahu (mean)', 101.2641509, 'Moon/Saturn/Moon/Rahu'],
  ['gw2000', 'kp_new', 'Ketu (mean)', 281.2641509, 'Saturn/Moon/Mars/Rahu'],
  ['gw2000', 'kp_new', 'Rahu (true)', 100.1775277, 'Moon/Saturn/Venus/Mercury'],
  ['gw2000', 'kp_new', 'Ketu (true)', 280.1775277, 'Saturn/Moon/Moon/Rahu'],
  ['gw2000', 'kp_new', 'Cusp 1', 0.4864166, 'Mars/Ketu/Ketu/Jupiter'],
  ['gw2000', 'kp_new', 'Cusp 2', 37.3640847, 'Venus/Sun/Ketu/Rahu'],
  ['gw2000', 'kp_new', 'Cusp 3', 58.2428916, 'Venus/Mars/Saturn/Mercury'],
  ['gw2000', 'kp_new', 'Cusp 4', 75.8332092, 'Mercury/Rahu/Venus/Moon'],
  ['gw2000', 'kp_new', 'Cusp 5', 95.2838061, 'Moon/Saturn/Saturn/Jupiter'],
  ['gw2000', 'kp_new', 'Cusp 6', 123.9218440, 'Sun/Ketu/Moon/Rahu'],
  ['gw2000', 'kp_new', 'Cusp 7', 180.4864166, 'Venus/Mars/Mercury/Venus'],
  ['gw2000', 'kp_new', 'Cusp 8', 217.3640847, 'Mars/Saturn/Ketu/Ketu'],
  ['gw2000', 'kp_new', 'Cusp 9', 238.2428916, 'Mars/Mercury/Saturn/Mercury'],
  ['gw2000', 'kp_new', 'Cusp 10', 255.8332092, 'Jupiter/Venus/Sun/Jupiter'],
  ['gw2000', 'kp_new', 'Cusp 11', 275.2838061, 'Saturn/Sun/Mercury/Mercury'],
  ['gw2000', 'kp_new', 'Cusp 12', 303.9218440, 'Saturn/Mars/Venus/Jupiter'],
  ['chn1950', 'kp_old', 'Sun', 61.0003560, 'Mercury/Mars/Mercury/Mars'],
  ['chn1950', 'kp_old', 'Moon', 62.2216636, 'Mercury/Mars/Ketu/Rahu'],
  ['chn1950', 'kp_old', 'Mars', 158.4111041, 'Mercury/Sun/Venus/Moon'],
  ['chn1950', 'kp_old', 'Mercury', 38.3696970, 'Venus/Sun/Venus/Moon'],
  ['chn1950', 'kp_old', 'Jupiter', 314.1821124, 'Saturn/Rahu/Mercury/Saturn'],
  ['chn1950', 'kp_old', 'Venus', 23.2874832, 'Mars/Venus/Saturn/Mars'],
  ['chn1950', 'kp_old', 'Saturn', 140.3495955, 'Sun/Venus/Jupiter/Saturn'],
  ['chn1950', 'kp_old', 'Rahu (mean)', 340.2668205, 'Jupiter/Saturn/Venus/Ketu'],
  ['chn1950', 'kp_old', 'Ketu (mean)', 160.2668205, 'Mercury/Moon/Moon/Rahu'],
  ['chn1950', 'kp_old', 'Rahu (true)', 340.7874864, 'Jupiter/Saturn/Sun/Mercury'],
  ['chn1950', 'kp_old', 'Ketu (true)', 160.7874864, 'Mercury/Moon/Moon/Mercury'],
  ['chn1950', 'kp_old', 'Cusp 1', 326.1843669, 'Saturn/Jupiter/Ketu/Rahu'],
  ['chn1950', 'kp_old', 'Cusp 2', 1.3285613, 'Mars/Ketu/Venus/Moon'],
  ['chn1950', 'kp_old', 'Cusp 3', 31.9285406, 'Venus/Sun/Jupiter/Mercury'],
  ['chn1950', 'kp_old', 'Cusp 4', 58.7680931, 'Venus/Mars/Saturn/Venus'],
  ['chn1950', 'kp_old', 'Cusp 5', 84.7362630, 'Mercury/Jupiter/Mercury/Moon'],
  ['chn1950', 'kp_old', 'Cusp 6', 113.0344105, 'Moon/Mercury/Moon/Ketu'],
  ['chn1950', 'kp_old', 'Cusp 7', 146.1843669, 'Sun/Venus/Ketu/Mars'],
  ['chn1950', 'kp_old', 'Cusp 8', 181.3285613, 'Venus/Mars/Mercury/Rahu'],
  ['chn1950', 'kp_old', 'Cusp 9', 211.9285406, 'Mars/Jupiter/Rahu/Saturn'],
  ['chn1950', 'kp_old', 'Cusp 10', 238.7680931, 'Mars/Mercury/Saturn/Venus'],
  ['chn1950', 'kp_old', 'Cusp 11', 264.7362630, 'Jupiter/Venus/Mercury/Sun'],
  ['chn1950', 'kp_old', 'Cusp 12', 293.0344105, 'Saturn/Moon/Sun/Saturn'],
  ['chn1950', 'kp_new', 'Sun', 60.9802281, 'Mercury/Mars/Mercury/Mars'],
  ['chn1950', 'kp_new', 'Moon', 62.2015357, 'Mercury/Mars/Ketu/Mars'],
  ['chn1950', 'kp_new', 'Mars', 158.3909762, 'Mercury/Sun/Venus/Moon'],
  ['chn1950', 'kp_new', 'Mercury', 38.3495691, 'Venus/Sun/Venus/Moon'],
  ['chn1950', 'kp_new', 'Jupiter', 314.1619845, 'Saturn/Rahu/Mercury/Saturn'],
  ['chn1950', 'kp_new', 'Venus', 23.2673553, 'Mars/Venus/Saturn/Moon'],
  ['chn1950', 'kp_new', 'Saturn', 140.3294676, 'Sun/Venus/Jupiter/Jupiter'],
  ['chn1950', 'kp_new', 'Rahu (mean)', 340.2466926, 'Jupiter/Saturn/Venus/Ketu'],
  ['chn1950', 'kp_new', 'Ketu (mean)', 160.2466926, 'Mercury/Moon/Moon/Rahu'],
  ['chn1950', 'kp_new', 'Rahu (true)', 340.7673585, 'Jupiter/Saturn/Sun/Mercury'],
  ['chn1950', 'kp_new', 'Ketu (true)', 160.7673585, 'Mercury/Moon/Moon/Mercury'],
  ['chn1950', 'kp_new', 'Cusp 1', 326.1642390, 'Saturn/Jupiter/Ketu/Rahu'],
  ['chn1950', 'kp_new', 'Cusp 2', 1.3084334, 'Mars/Ketu/Venus/Moon'],
  ['chn1950', 'kp_new', 'Cusp 3', 31.9084127, 'Venus/Sun/Jupiter/Mercury'],
  ['chn1950', 'kp_new', 'Cusp 4', 58.7479652, 'Venus/Mars/Saturn/Venus'],
  ['chn1950', 'kp_new', 'Cusp 5', 84.7161351, 'Mercury/Jupiter/Mercury/Moon'],
  ['chn1950', 'kp_new', 'Cusp 6', 113.0142826, 'Moon/Mercury/Moon/Mercury'],
  ['chn1950', 'kp_new', 'Cusp 7', 146.1642390, 'Sun/Venus/Ketu/Moon'],
  ['chn1950', 'kp_new', 'Cusp 8', 181.3084334, 'Venus/Mars/Mercury/Rahu'],
  ['chn1950', 'kp_new', 'Cusp 9', 211.9084127, 'Mars/Jupiter/Rahu/Saturn'],
  ['chn1950', 'kp_new', 'Cusp 10', 238.7479652, 'Mars/Mercury/Saturn/Venus'],
  ['chn1950', 'kp_new', 'Cusp 11', 264.7161351, 'Jupiter/Venus/Mercury/Sun'],
  ['chn1950', 'kp_new', 'Cusp 12', 293.0142826, 'Saturn/Moon/Sun/Saturn'],
  ['pj2026', 'kp_old', 'Sun', 214.5836556, 'Mars/Saturn/Saturn/Moon'],
  ['pj2026', 'kp_old', 'Moon', 346.5658552, 'Jupiter/Saturn/Jupiter/Rahu'],
  ['pj2026', 'kp_old', 'Mars', 123.8271669, 'Sun/Ketu/Moon/Rahu'],
  ['pj2026', 'kp_old', 'Mercury', 195.0995922, 'Venus/Rahu/Ketu/Saturn'],
  ['pj2026', 'kp_old', 'Jupiter', 122.1122500, 'Sun/Ketu/Venus/Jupiter'],
  ['pj2026', 'kp_old', 'Venus', 179.6770784, 'Mercury/Mars/Saturn/Rahu'],
  ['pj2026', 'kp_old', 'Saturn', 344.1487878, 'Jupiter/Saturn/Rahu/Ketu'],
  ['pj2026', 'kp_old', 'Rahu (mean)', 300.8741479, 'Saturn/Mars/Mercury/Moon'],
  ['pj2026', 'kp_old', 'Ketu (mean)', 120.8741479, 'Sun/Ketu/Venus/Venus'],
  ['pj2026', 'kp_old', 'Rahu (true)', 300.8698384, 'Saturn/Mars/Mercury/Moon'],
  ['pj2026', 'kp_old', 'Ketu (true)', 120.8698384, 'Sun/Ketu/Venus/Venus'],
  ['pj2026', 'kp_old', 'Cusp 1', 241.5632163, 'Jupiter/Ketu/Venus/Mars'],
  ['pj2026', 'kp_old', 'Cusp 2', 269.8293738, 'Jupiter/Sun/Rahu/Saturn'],
  ['pj2026', 'kp_old', 'Cusp 3', 299.9639939, 'Saturn/Mars/Saturn/Jupiter'],
  ['pj2026', 'kp_old', 'Cusp 4', 332.2227810, 'Jupiter/Jupiter/Rahu/Mercury'],
  ['pj2026', 'kp_old', 'Cusp 5', 4.3404748, 'Mars/Ketu/Moon/Mercury'],
  ['pj2026', 'kp_old', 'Cusp 6', 34.0291221, 'Venus/Sun/Saturn/Venus'],
  ['pj2026', 'kp_old', 'Cusp 7', 61.5632163, 'Mercury/Mars/Mercury/Jupiter'],
  ['pj2026', 'kp_old', 'Cusp 8', 89.8293738, 'Mercury/Jupiter/Moon/Jupiter'],
  ['pj2026', 'kp_old', 'Cusp 9', 119.9639939, 'Moon/Mercury/Saturn/Jupiter'],
  ['pj2026', 'kp_old', 'Cusp 10', 152.2227810, 'Mercury/Sun/Jupiter/Venus'],
  ['pj2026', 'kp_old', 'Cusp 11', 184.3404748, 'Venus/Mars/Venus/Saturn'],
  ['pj2026', 'kp_old', 'Cusp 12', 214.0291221, 'Mars/Saturn/Saturn/Ketu'],
  ['pj2026', 'kp_new', 'Sun', 214.5635325, 'Mars/Saturn/Saturn/Moon'],
  ['pj2026', 'kp_new', 'Moon', 346.5457320, 'Jupiter/Saturn/Jupiter/Rahu'],
  ['pj2026', 'kp_new', 'Mars', 123.8070438, 'Sun/Ketu/Moon/Mars'],
  ['pj2026', 'kp_new', 'Mercury', 195.0794691, 'Venus/Rahu/Ketu/Saturn'],
  ['pj2026', 'kp_new', 'Jupiter', 122.0921268, 'Sun/Ketu/Venus/Jupiter'],
  ['pj2026', 'kp_new', 'Venus', 179.6569553, 'Mercury/Mars/Saturn/Rahu'],
  ['pj2026', 'kp_new', 'Saturn', 344.1286646, 'Jupiter/Saturn/Rahu/Ketu'],
  ['pj2026', 'kp_new', 'Rahu (mean)', 300.8540247, 'Saturn/Mars/Mercury/Moon'],
  ['pj2026', 'kp_new', 'Ketu (mean)', 120.8540247, 'Sun/Ketu/Venus/Venus'],
  ['pj2026', 'kp_new', 'Rahu (true)', 300.8497152, 'Saturn/Mars/Mercury/Moon'],
  ['pj2026', 'kp_new', 'Ketu (true)', 120.8497152, 'Sun/Ketu/Venus/Venus'],
  ['pj2026', 'kp_new', 'Cusp 1', 241.5430932, 'Jupiter/Ketu/Venus/Mars'],
  ['pj2026', 'kp_new', 'Cusp 2', 269.8092507, 'Jupiter/Sun/Rahu/Saturn'],
  ['pj2026', 'kp_new', 'Cusp 3', 299.9438708, 'Saturn/Mars/Saturn/Jupiter'],
  ['pj2026', 'kp_new', 'Cusp 4', 332.2026579, 'Jupiter/Jupiter/Rahu/Saturn'],
  ['pj2026', 'kp_new', 'Cusp 5', 4.3203517, 'Mars/Ketu/Moon/Mercury'],
  ['pj2026', 'kp_new', 'Cusp 6', 34.0089990, 'Venus/Sun/Saturn/Venus'],
  ['pj2026', 'kp_new', 'Cusp 7', 61.5430932, 'Mercury/Mars/Mercury/Jupiter'],
  ['pj2026', 'kp_new', 'Cusp 8', 89.8092507, 'Mercury/Jupiter/Moon/Jupiter'],
  ['pj2026', 'kp_new', 'Cusp 9', 119.9438708, 'Moon/Mercury/Saturn/Jupiter'],
  ['pj2026', 'kp_new', 'Cusp 10', 152.2026579, 'Mercury/Sun/Jupiter/Venus'],
  ['pj2026', 'kp_new', 'Cusp 11', 184.3203517, 'Venus/Mars/Venus/Saturn'],
  ['pj2026', 'kp_new', 'Cusp 12', 214.0089990, 'Mars/Saturn/Saturn/Ketu'],
  ['tromso2010', 'kp_old', 'Sun', 245.2063128, 'Jupiter/Ketu/Mars/Mercury'],
  ['tromso2010', 'kp_old', 'Moon', 62.4477699, 'Mercury/Mars/Ketu/Saturn'],
  ['tromso2010', 'kp_old', 'Mars', 256.0793162, 'Jupiter/Venus/Sun/Ketu'],
  ['tromso2010', 'kp_old', 'Mercury', 242.6503949, 'Jupiter/Ketu/Venus/Mercury'],
  ['tromso2010', 'kp_old', 'Jupiter', 331.3314708, 'Jupiter/Jupiter/Mars/Moon'],
  ['tromso2010', 'kp_old', 'Venus', 199.8073222, 'Venus/Rahu/Mars/Venus'],
  ['tromso2010', 'kp_old', 'Saturn', 172.1654533, 'Mercury/Moon/Venus/Saturn'],
  ['tromso2010', 'kp_old', 'Rahu (mean)', 248.9651793, 'Jupiter/Ketu/Jupiter/Mars'],
  ['tromso2010', 'kp_old', 'Ketu (mean)', 68.9651793, 'Mercury/Rahu/Jupiter/Saturn'],
  ['tromso2010', 'kp_old', 'Rahu (true)', 248.8178986, 'Jupiter/Ketu/Jupiter/Moon'],
  ['tromso2010', 'kp_old', 'Ketu (true)', 68.8178986, 'Mercury/Rahu/Jupiter/Jupiter'],
  ['tromso2010', 'kp_old', 'Cusp 1 (Porphyry)', 187.2314060, 'Venus/Rahu/Rahu/Jupiter'],
  ['tromso2010', 'kp_old', 'Cusp 2 (Porphyry)', 227.3552690, 'Mars/Mercury/Mercury/Venus'],
  ['tromso2010', 'kp_old', 'Cusp 3 (Porphyry)', 267.4791330, 'Jupiter/Sun/Moon/Mars'],
  ['tromso2010', 'kp_old', 'Cusp 4 (Porphyry)', 307.6029960, 'Saturn/Rahu/Rahu/Mercury'],
  ['tromso2010', 'kp_old', 'Cusp 5 (Porphyry)', 327.4791330, 'Saturn/Jupiter/Venus/Rahu'],
  ['tromso2010', 'kp_old', 'Cusp 6 (Porphyry)', 347.3552690, 'Jupiter/Mercury/Mercury/Venus'],
  ['tromso2010', 'kp_old', 'Cusp 7 (Porphyry)', 7.2314060, 'Mars/Ketu/Rahu/Sun'],
  ['tromso2010', 'kp_old', 'Cusp 8 (Porphyry)', 47.3552690, 'Venus/Moon/Saturn/Rahu'],
  ['tromso2010', 'kp_old', 'Cusp 9 (Porphyry)', 87.4791330, 'Mercury/Jupiter/Venus/Rahu'],
  ['tromso2010', 'kp_old', 'Cusp 10 (Porphyry)', 127.6029960, 'Sun/Ketu/Jupiter/Jupiter'],
  ['tromso2010', 'kp_old', 'Cusp 11 (Porphyry)', 147.4791330, 'Sun/Sun/Moon/Mars'],
  ['tromso2010', 'kp_old', 'Cusp 12 (Porphyry)', 167.3552690, 'Mercury/Moon/Saturn/Rahu'],
  ['tromso2010', 'kp_new', 'Sun', 245.1861886, 'Jupiter/Ketu/Mars/Mercury'],
  ['tromso2010', 'kp_new', 'Moon', 62.4276456, 'Mercury/Mars/Ketu/Jupiter'],
  ['tromso2010', 'kp_new', 'Mars', 256.0591920, 'Jupiter/Venus/Sun/Mercury'],
  ['tromso2010', 'kp_new', 'Mercury', 242.6302706, 'Jupiter/Ketu/Venus/Mercury'],
  ['tromso2010', 'kp_new', 'Jupiter', 331.3113466, 'Jupiter/Jupiter/Mars/Moon'],
  ['tromso2010', 'kp_new', 'Venus', 199.7871980, 'Venus/Rahu/Mars/Venus'],
  ['tromso2010', 'kp_new', 'Saturn', 172.1453291, 'Mercury/Moon/Venus/Saturn'],
  ['tromso2010', 'kp_new', 'Rahu (mean)', 248.9450551, 'Jupiter/Ketu/Jupiter/Moon'],
  ['tromso2010', 'kp_new', 'Ketu (mean)', 68.9450551, 'Mercury/Rahu/Jupiter/Saturn'],
  ['tromso2010', 'kp_new', 'Rahu (true)', 248.7977744, 'Jupiter/Ketu/Jupiter/Sun'],
  ['tromso2010', 'kp_new', 'Ketu (true)', 68.7977744, 'Mercury/Rahu/Jupiter/Jupiter'],
  ['tromso2010', 'kp_new', 'Cusp 1 (Porphyry)', 187.2112820, 'Venus/Rahu/Rahu/Jupiter'],
  ['tromso2010', 'kp_new', 'Cusp 2 (Porphyry)', 227.3351450, 'Mars/Mercury/Mercury/Venus'],
  ['tromso2010', 'kp_new', 'Cusp 3 (Porphyry)', 267.4590090, 'Jupiter/Sun/Moon/Mars'],
  ['tromso2010', 'kp_new', 'Cusp 4 (Porphyry)', 307.5828720, 'Saturn/Rahu/Rahu/Mercury'],
  ['tromso2010', 'kp_new', 'Cusp 5 (Porphyry)', 327.4590090, 'Saturn/Jupiter/Venus/Rahu'],
  ['tromso2010', 'kp_new', 'Cusp 6 (Porphyry)', 347.3351450, 'Jupiter/Mercury/Mercury/Venus'],
  ['tromso2010', 'kp_new', 'Cusp 7 (Porphyry)', 7.2112820, 'Mars/Ketu/Rahu/Sun'],
  ['tromso2010', 'kp_new', 'Cusp 8 (Porphyry)', 47.3351450, 'Venus/Moon/Saturn/Rahu'],
  ['tromso2010', 'kp_new', 'Cusp 9 (Porphyry)', 87.4590090, 'Mercury/Jupiter/Venus/Rahu'],
  ['tromso2010', 'kp_new', 'Cusp 10 (Porphyry)', 127.5828720, 'Sun/Ketu/Jupiter/Jupiter'],
  ['tromso2010', 'kp_new', 'Cusp 11 (Porphyry)', 147.4590090, 'Sun/Sun/Moon/Mars'],
  ['tromso2010', 'kp_new', 'Cusp 12 (Porphyry)', 167.3351450, 'Mercury/Moon/Saturn/Rahu'],
];

describe('lords for every Appendix A longitude (Swiss Ephemeris reference)', () => {
  it('has 5 cases x 2 ayanamsas x 23 points', () => {
    expect(APPENDIX_A).toHaveLength(230);
  });

  it.each(APPENDIX_A)('%s %s %s @ %f is %s', (_case, _mode, _point, lon, expected) => {
    const l = getPositionLords(lon);
    expect(`${l.signLord}/${l.starLord}/${l.subLord}/${l.subSubLord}`).toBe(expected);
  });
});

/**
 * Independent oracle: integer arithmetic. The zodiac is 27 x 120 x 120 = 388,800 units of
 * 1/1080 degree. A nakshatra is 14,400 units, a sub is (sub years x 120) units, a sub-sub is
 * (sub years x sub-sub years) units. No floating-point spans are involved.
 */
interface SubSubStart {
  unit: number;
  star: KPPlanetLord;
  sub: KPPlanetLord;
  subSub: KPPlanetLord;
}

function buildSubSubStarts(): SubSubStart[] {
  const out: SubSubStart[] = [];
  for (let n = 0; n < 27; n++) {
    let subUnit = n * 14400;
    for (let i = 0; i < 9; i++) {
      const subIdx = (n + i) % 9;
      const subYears = DASHA_YEARS[VIMSHOTTARI_LORDS[subIdx]];
      let ssUnit = subUnit;
      for (let j = 0; j < 9; j++) {
        const ssIdx = (subIdx + j) % 9;
        out.push({
          unit: ssUnit,
          star: VIMSHOTTARI_LORDS[n % 9],
          sub: VIMSHOTTARI_LORDS[subIdx],
          subSub: VIMSHOTTARI_LORDS[ssIdx],
        });
        ssUnit += subYears * DASHA_YEARS[VIMSHOTTARI_LORDS[ssIdx]];
      }
      subUnit += subYears * 120;
    }
  }
  return out;
}

describe('sub-sub boundaries (+/- 1e-7 degrees at all 2,187 starts)', () => {
  const starts = buildSubSubStarts();
  const EPS = 1e-7;

  it('has 27 x 9 x 9 = 2187 starts, strictly increasing, ending at 388,800 units', () => {
    expect(starts).toHaveLength(2187);
    for (let k = 1; k < starts.length; k++) {
      expect(starts[k].unit).toBeGreaterThan(starts[k - 1].unit);
    }
    expect(starts[0].unit).toBe(0);
  });

  it('just after each start is that sub-sub; just before it is the previous one', () => {
    const bad: string[] = [];
    for (let k = 0; k < starts.length; k++) {
      const cur = starts[k];
      const prev = starts[(k + starts.length - 1) % starts.length];
      const startDeg = cur.unit / 1080;

      const after = getPositionLords(startDeg + EPS);
      if (after.starLord !== cur.star || after.subLord !== cur.sub || after.subSubLord !== cur.subSub) {
        bad.push(`k=${k} after: got ${after.starLord}/${after.subLord}/${after.subSubLord}`);
      }

      const before = getPositionLords(startDeg - EPS);
      if (
        before.starLord !== prev.star ||
        before.subLord !== prev.sub ||
        before.subSubLord !== prev.subSub
      ) {
        bad.push(`k=${k} before: got ${before.starLord}/${before.subLord}/${before.subSubLord}`);
      }

      // Sign is taken from the longitude itself, which the oracle does not depend on.
      expect(after.signIndex).toBe(Math.floor(((cur.unit / 1080 + EPS) % 360) / 30));
    }
    expect(bad).toEqual([]);
  });
});

describe('249-entry horary table', () => {
  it('numbers 1..249 contiguously and covers 0 to 360 degrees without gaps', () => {
    const table = getHorary249Table();
    expect(table).toHaveLength(249);
    expect(table[0].startLongitude).toBe(0);
    expect(table[248].endLongitude).toBeCloseTo(360, 9);
    table.forEach((e, i) => {
      expect(e.number).toBe(i + 1);
      if (i > 0) expect(e.startLongitude).toBeCloseTo(table[i - 1].endLongitude, 9);
    });
  });

  it('entries 22/23 split one sub at 30 degrees (Taurus start)', () => {
    const a = getHoraryEntry(22);
    const b = getHoraryEntry(23);
    expect(a.endLongitude).toBe(30);
    expect(b.startLongitude).toBe(30);
    expect(a.subLord).toBe(b.subLord);
    expect(a.starName).toBe(b.starName);
    expect(a.signName).toBe('Aries');
    expect(b.signName).toBe('Taurus');
  });

  it('entries 105/106 split one sub at 150 degrees (Leo to Virgo)', () => {
    const a = getHoraryEntry(105);
    const b = getHoraryEntry(106);
    expect(a.endLongitude).toBe(150);
    expect(b.startLongitude).toBe(150);
    expect(a.subLord).toBe(b.subLord);
    expect(a.starName).toBe(b.starName);
    expect(a.signName).toBe('Leo');
    expect(b.signName).toBe('Virgo');
  });

  it('exactly 6 subs are split by a sign boundary', () => {
    const table = getHorary249Table();
    let splits = 0;
    for (let i = 1; i < table.length; i++) {
      if (
        table[i].starNumber === table[i - 1].starNumber &&
        table[i].subLord === table[i - 1].subLord &&
        table[i].signIndex !== table[i - 1].signIndex
      ) {
        splits++;
      }
    }
    expect(splits).toBe(6);
  });

  it('adds DMS strings to every entry (same formatter as formatDMS)', () => {
    const table = getHorary249Table();
    expect(table[0].startDms).toBe('00°00\'00"');
    expect(getHoraryEntry(108).startDms).toBe('153°00\'00"');
    expect(getHoraryEntry(22).endDms).toBe('30°00\'00"');
    expect(table[248].endDms).toBe('360°00\'00"');
    for (const e of table) {
      expect(e.startDms).toBe(formatDMS(e.startLongitude).formatted);
      expect(e.endDms).toBe(formatDMS(e.endLongitude).formatted);
    }
  });

  it('getHoraryEntry returns the numbered entry', () => {
    expect(getHoraryEntry(1).number).toBe(1);
    expect(getHoraryEntry(108)).toBe(getHorary249Table()[107]);
    expect(getHoraryEntry(249).number).toBe(249);
  });

  it('getHoraryEntry throws RangeError outside 1..249 and for non-integers', () => {
    expect(() => getHoraryEntry(0)).toThrow(RangeError);
    expect(() => getHoraryEntry(250)).toThrow(RangeError);
    expect(() => getHoraryEntry(-1)).toThrow(RangeError);
    expect(() => getHoraryEntry(1.5)).toThrow(RangeError);
    expect(() => getHoraryEntry(Number.NaN)).toThrow(RangeError);
  });

  it('getPositionLords horary number matches the table for every entry start', () => {
    for (const e of getHorary249Table()) {
      expect(getPositionLords(e.startLongitude + 1e-7).horary249Number).toBe(e.number);
    }
  });
});

describe('sub-boundary fields (opt-in, threshold required)', () => {
  // KL 1992 Moon, KP Old: 42.0295069 deg is in the Rahu sub of Rohini (Moon star).
  // Integer-unit oracle: sub = 3*14400 + (10 + 7)*120 = 45,240 units to +18*120 = 47,400 units.
  const SUB_START = 45240 / 1080; // 41.888888...
  const SUB_END = 47400 / 1080; // 43.888888...

  it('without options the result has no boundary fields (existing callers unchanged)', () => {
    const l = getPositionLords(42.0295069);
    expect('subSpanStart' in l).toBe(false);
    expect('subSpanEnd' in l).toBe(false);
    expect('distanceFromSubStartArcsec' in l).toBe(false);
    expect('distanceToSubEndArcsec' in l).toBe(false);
    expect('isNearSubBoundary' in l).toBe(false);
    const cusp = buildKPCusp(1, 42.0295069, 70);
    expect('isNearSubBoundary' in cusp).toBe(false);
  });

  it('reports sub span and distances in arcseconds', () => {
    const l = getPositionLords(42.0295069, { nearBoundaryThresholdArcsec: 60 });
    expect(l.subLord).toBe('Rahu');
    expect(l.subSpanStart).toBeCloseTo(SUB_START, 9);
    expect(l.subSpanEnd).toBeCloseTo(SUB_END, 9);
    expect(l.distanceFromSubStartArcsec).toBeCloseTo((42.0295069 - SUB_START) * 3600, 4);
    expect(l.distanceToSubEndArcsec).toBeCloseTo((SUB_END - 42.0295069) * 3600, 4);
    expect(l.isNearSubBoundary).toBe(false);
    expectTypeOf(l).toMatchTypeOf<SubBoundaryInfo>();
  });

  it('isNearSubBoundary uses the caller threshold on both edges', () => {
    const nearEnd = SUB_END - 30 / 3600; // 30 arcsec before the end
    expect(getPositionLords(nearEnd, { nearBoundaryThresholdArcsec: 31 }).isNearSubBoundary).toBe(true);
    expect(getPositionLords(nearEnd, { nearBoundaryThresholdArcsec: 29 }).isNearSubBoundary).toBe(false);
    const nearStart = SUB_START + 30 / 3600;
    expect(getPositionLords(nearStart, { nearBoundaryThresholdArcsec: 31 }).isNearSubBoundary).toBe(true);
    expect(getPositionLords(nearStart, { nearBoundaryThresholdArcsec: 29 }).isNearSubBoundary).toBe(false);
    // Threshold 0: nothing is "near".
    expect(getPositionLords(nearStart, { nearBoundaryThresholdArcsec: 0 }).isNearSubBoundary).toBe(false);
  });

  it('distances are never negative and the span edges are consistent at every sub start', () => {
    for (const e of getHorary249Table()) {
      const l = getPositionLords(e.startLongitude + 1e-9, { nearBoundaryThresholdArcsec: 60 });
      expect(l.distanceFromSubStartArcsec).toBeGreaterThanOrEqual(0);
      expect(l.distanceToSubEndArcsec).toBeGreaterThanOrEqual(0);
      expect(l.subSpanEnd).toBeGreaterThan(l.subSpanStart!);
      expect(l.subSpanStart!).toBeLessThanOrEqual(e.startLongitude + 1e-9);
    }
  });

  it('rejects an invalid threshold instead of defaulting', () => {
    expect(() => getPositionLords(10, { nearBoundaryThresholdArcsec: -1 })).toThrow(RangeError);
    expect(() => getPositionLords(10, { nearBoundaryThresholdArcsec: Number.NaN })).toThrow(RangeError);
    expect(() =>
      getPositionLords(10, {} as unknown as { nearBoundaryThresholdArcsec: number })
    ).toThrow(RangeError);
  });

  it('buildKPCusp passes the options through', () => {
    const cusp = buildKPCusp(1, 42.0295069, 70, { nearBoundaryThresholdArcsec: 60 });
    expect(cusp.house).toBe(1);
    expect(cusp.subSpanStart).toBeCloseTo(SUB_START, 9);
    expect(cusp.isNearSubBoundary).toBe(false);
  });
});
