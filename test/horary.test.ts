import { describe, it, expect } from 'vitest';
import { getHoraryEntry, getHoraryTable } from '../src/kp/horary-table.js';
import { calculateHoraryChart } from '../src/kp/horary.js';

describe('KP horary', () => {
  it('KP 1–249 Horary table has exactly 249 entries', () => {
    const table = getHoraryTable();
    expect(table.length).toBe(249);
    expect(table[0].horaryNumber).toBe(1);
    expect(table[248].horaryNumber).toBe(249);
  });

  it('Split horary numbers 22 and 23 at 30° Aries/Taurus boundary', () => {
    const entry22 = getHoraryEntry(22);
    const entry23 = getHoraryEntry(23);

    // Both are in Krittika (Star Lord: Sun) and Sub Lord: Rahu
    expect(entry22.nakshatraName).toBe('Krittika');
    expect(entry22.subLord).toBe('Rahu');
    expect(entry22.signName).toBe('Aries');
    expect(entry22.signLord).toBe('Mars');
    expect(entry22.endLongitude).toBe(30.0);

    expect(entry23.nakshatraName).toBe('Krittika');
    expect(entry23.subLord).toBe('Rahu');
    expect(entry23.signName).toBe('Taurus');
    expect(entry23.signLord).toBe('Venus');
    expect(entry23.startLongitude).toBe(30.0);
  });

  it('Split horary numbers 105 and 106 at 150° Leo/Virgo boundary', () => {
    const entry105 = getHoraryEntry(105);
    const entry106 = getHoraryEntry(106);

    expect(entry105.signName).toBe('Leo');
    expect(entry105.signLord).toBe('Sun');
    expect(entry105.nakshatraName).toBe('Uttara Phalguni');
    expect(entry105.subLord).toBe('Rahu');
    expect(entry105.endLongitude).toBe(150.0);

    expect(entry106.signName).toBe('Virgo');
    expect(entry106.signLord).toBe('Mercury');
    expect(entry106.nakshatraName).toBe('Uttara Phalguni');
    expect(entry106.subLord).toBe('Rahu');
    expect(entry106.startLongitude).toBe(150.0);
  });

  it('Horary number 108 gives exactly 3°00\' Virgo (153.0°)', () => {
    const entry108 = getHoraryEntry(108);

    expect(entry108.horaryNumber).toBe(108);
    expect(entry108.signName).toBe('Virgo');
    expect(entry108.signLord).toBe('Mercury');
    expect(entry108.nakshatraName).toBe('Uttara Phalguni');
    expect(entry108.starLord).toBe('Sun');
    expect(entry108.subLord).toBe('Saturn');

    // Exact 153° = 3°00' Virgo
    expect(Math.abs(entry108.startLongitude - 153.0) < 1e-10).toBe(true);
  });

  it('Horary chart calculation sets Lagna at start of sub by default', () => {
    const chart = calculateHoraryChart({
      horaryNumber: 108,
      dateUtc: new Date(Date.UTC(2026, 10, 21, 6, 0, 0)),
      coordinates: { latitude: 13.0827, longitude: 80.2707 },
      ayanamsaMode: 'KP_OLD',
      useSubMidpoint: false,
    });

    // Lagna should be at start of sub (153°)
    expect(chart.useSubMidpoint).toBe(false);
    expect(Math.abs(chart.lagnaTargetDeg - 153.0) < 1e-10).toBe(true);
    expect(Math.abs(chart.ascendant.siderealLongitude - 153.0) < 1e-6).toBe(true);
    expect(chart.ascendant.signName).toBe('Virgo');
    expect(chart.ascendant.starLord).toBe('Sun');
    expect(chart.ascendant.subLord).toBe('Saturn');
  });

  it('Horary chart calculation toggle supports sub midpoint', () => {
    const entry = getHoraryEntry(108);
    const midpoint = (entry.startLongitude + entry.endLongitude) / 2;

    const chart = calculateHoraryChart({
      horaryNumber: 108,
      dateUtc: new Date(Date.UTC(2026, 10, 21, 6, 0, 0)),
      coordinates: { latitude: 13.0827, longitude: 80.2707 },
      ayanamsaMode: 'KP_OLD',
      useSubMidpoint: true,
    });

    expect(chart.useSubMidpoint).toBe(true);
    expect(Math.abs(chart.lagnaTargetDeg - midpoint) < 1e-10).toBe(true);
    expect(Math.abs(chart.ascendant.siderealLongitude - midpoint) < 1e-6).toBe(true);
  });
});
