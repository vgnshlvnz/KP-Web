import { describe, it, expect } from 'vitest';
import { getHoraryEntry, getHorary249Table } from '../src/engine/kp-lords.js';
import { calculateHoraryChart } from '../src/engine/horary.js';
import type { ChartCalculationOptions } from '../src/engine/types.js';

/**
 * Re-pointed from `src/kp/horary` and `src/kp/horary-table` to `src/engine` (work package
 * `port-horary`, #56). Every expected value and tolerance is the one the Stack B test had.
 *
 * Renames forced by the unified shapes (values unchanged):
 *   getHoraryTable() -> getHorary249Table()
 *   entry.horaryNumber -> entry.number, entry.nakshatraName -> entry.starName
 *   calculateHoraryChart({ dateUtc, coordinates, ayanamsaMode: 'KP_OLD' }, ) ->
 *     calculateHoraryChart({ questionTime: { ...civil fields, utcOffsetHours: 0, lat/lon } }, options)
 *   chart.ascendant.siderealLongitude -> chart.ascendant (a number, sidereal degrees)
 *   chart.ascendant.signName / starLord / subLord -> chart.cusps[0].signName / starLord / subLord
 *
 * The engine options below are a TEST FIXTURE, not defaults: each one is an open owner decision
 * (#22, #23, #24) and `calculateHoraryChart` has no default for any of them. Everything else is a
 * fixed convention (`src/engine/conventions.ts`).
 */
const OPTIONS: ChartCalculationOptions = {
  ayanamsa: 'kp_old', // TODO(#22): fixture, not a default
  nodeAgentRuleSet: 'sign_lord_star_lord_same_sign', // TODO(#23): fixture
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord', // TODO(#24): fixture
};

const QUESTION_TIME = {
  year: 2026,
  month: 11,
  day: 21,
  hour: 6,
  minute: 0,
  second: 0,
  utcOffsetHours: 0,
  latitude: 13.0827,
  longitude: 80.2707,
};

describe('KP horary', () => {
  it('KP 1–249 Horary table has exactly 249 entries', () => {
    const table = getHorary249Table();
    expect(table.length).toBe(249);
    expect(table[0].number).toBe(1);
    expect(table[248].number).toBe(249);
  });

  it('Split horary numbers 22 and 23 at 30° Aries/Taurus boundary', () => {
    const entry22 = getHoraryEntry(22);
    const entry23 = getHoraryEntry(23);

    // Both are in Krittika (Star Lord: Sun) and Sub Lord: Rahu
    expect(entry22.starName).toBe('Krittika');
    expect(entry22.subLord).toBe('Rahu');
    expect(entry22.signName).toBe('Aries');
    expect(entry22.signLord).toBe('Mars');
    expect(entry22.endLongitude).toBe(30.0);

    expect(entry23.starName).toBe('Krittika');
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
    expect(entry105.starName).toBe('Uttara Phalguni');
    expect(entry105.subLord).toBe('Rahu');
    expect(entry105.endLongitude).toBe(150.0);

    expect(entry106.signName).toBe('Virgo');
    expect(entry106.signLord).toBe('Mercury');
    expect(entry106.starName).toBe('Uttara Phalguni');
    expect(entry106.subLord).toBe('Rahu');
    expect(entry106.startLongitude).toBe(150.0);
  });

  it('Horary number 108 gives exactly 3°00\' Virgo (153.0°)', () => {
    const entry108 = getHoraryEntry(108);

    expect(entry108.number).toBe(108);
    expect(entry108.signName).toBe('Virgo');
    expect(entry108.signLord).toBe('Mercury');
    expect(entry108.starName).toBe('Uttara Phalguni');
    expect(entry108.starLord).toBe('Sun');
    expect(entry108.subLord).toBe('Saturn');

    // Exact 153° = 3°00' Virgo
    expect(Math.abs(entry108.startLongitude - 153.0) < 1e-10).toBe(true);
  });

  it('Horary chart calculation sets Lagna at start of sub by default', () => {
    const chart = calculateHoraryChart(
      { questionTime: QUESTION_TIME, horaryNumber: 108, useSubMidpoint: false },
      OPTIONS
    );

    // Lagna should be at start of sub (153°)
    expect(chart.useSubMidpoint).toBe(false);
    expect(Math.abs(chart.lagnaTargetDeg - 153.0) < 1e-10).toBe(true);
    expect(Math.abs(chart.ascendant - 153.0) < 1e-6).toBe(true);
    expect(chart.cusps[0].signName).toBe('Virgo');
    expect(chart.cusps[0].starLord).toBe('Sun');
    expect(chart.cusps[0].subLord).toBe('Saturn');
  });

  it('Horary chart calculation toggle supports sub midpoint', () => {
    const entry = getHoraryEntry(108);
    const midpoint = (entry.startLongitude + entry.endLongitude) / 2;

    const chart = calculateHoraryChart(
      { questionTime: QUESTION_TIME, horaryNumber: 108, useSubMidpoint: true },
      OPTIONS
    );

    expect(chart.useSubMidpoint).toBe(true);
    expect(Math.abs(chart.lagnaTargetDeg - midpoint) < 1e-10).toBe(true);
    expect(Math.abs(chart.ascendant - midpoint) < 1e-6).toBe(true);
  });

  it('Omitting useSubMidpoint means the start of the sub (the KP rule, not a decision)', () => {
    const chart = calculateHoraryChart({ questionTime: QUESTION_TIME, horaryNumber: 108 }, OPTIONS);
    expect(chart.useSubMidpoint).toBe(false);
    expect(chart.lagnaTargetDeg).toBe(getHoraryEntry(108).startLongitude);
  });
});
