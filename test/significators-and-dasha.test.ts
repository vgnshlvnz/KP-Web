import { describe, it, expect } from 'vitest';
import { calculateNatalChart } from '../src/kp/engine.js';

describe('Natal chart engine', () => {
  it('Calculates full Natal Chart with 4-level significators, ruling planets, and dasha', () => {
    const chart = calculateNatalChart({
      dateTime: {
        year: 1990,
        month: 5,
        day: 15,
        hour: 20,
        minute: 0,
        second: 0,
        timezoneOffsetHours: 5.5, // 20:00:00 IST = 14:30:00 UTC
      },
      coordinates: {
        latitude: 13.0827,
        longitude: 80.2707,
      },
      ayanamsaMode: 'KP_OLD',
    });

    // Verify chart basics
    expect(chart.planets.length).toBe(12);
    expect(chart.houses.length).toBe(12);
    expect(chart.ayanamsaMode).toBe('KP_OLD');
    expect(chart.ayanamsaValueDeg > 23.6 && chart.ayanamsaValueDeg < 23.7).toBe(true);

    // Ascendant verification
    expect(chart.ascendant.siderealLongitude > 0).toBe(true);
    expect(chart.ascendant.signLord).toBeTruthy();
    expect(chart.ascendant.starLord).toBeTruthy();
    expect(chart.ascendant.subLord).toBeTruthy();

    // Four-level significators structure
    for (let h = 1; h <= 12; h++) {
      const houseSig = chart.significators.houseWise[h];
      expect(houseSig, `House ${h} significators missing`).toBeTruthy();
      expect(Array.isArray(houseSig.level1)).toBe(true);
      expect(Array.isArray(houseSig.level2)).toBe(true);
      expect(Array.isArray(houseSig.level3)).toBe(true);
      expect(Array.isArray(houseSig.level4)).toBe(true);
    }

    // Rahu / Ketu rules documented
    expect(chart.significators.rahuKetuRules.includes('Standard KP School')).toBe(true);

    // Ruling planets
    expect(chart.rulingPlanets.ascendantSignLord).toBeTruthy();
    expect(chart.rulingPlanets.ascendantStarLord).toBeTruthy();
    expect(chart.rulingPlanets.moonSignLord).toBeTruthy();
    expect(chart.rulingPlanets.moonStarLord).toBeTruthy();
    expect(chart.rulingPlanets.dayLord).toBeTruthy();
    expect(chart.rulingPlanets.rulingPlanetsList.length).toBe(5);

    // Vimshottari Dasha
    expect(chart.dashaBalance.birthStar).toBeTruthy();
    expect(chart.dashaBalance.dashaLord).toBeTruthy();
    expect(chart.dashaBalance.balanceYears >= 0).toBe(true);
    expect(chart.dashaBalance.dashaTimeline.length).toBe(9);

    // Check first dasha period has bhuktis and antaras
    const firstDasha = chart.dashaBalance.dashaTimeline[0];
    expect(firstDasha.subPeriods && firstDasha.subPeriods.length === 9).toBe(true);
    const firstBhukti = firstDasha.subPeriods![0];
    expect(firstBhukti.subPeriods && firstBhukti.subPeriods.length === 9).toBe(true);
  });
});
