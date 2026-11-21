import { describe, it, expect } from 'vitest';
import {
  getPositionLords,
  getHorary249Table,
  buildKPCusp,
  formatDMS,
} from '../src/engine/kp-lords.js';

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
