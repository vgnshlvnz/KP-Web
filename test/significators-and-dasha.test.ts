import test from 'node:test';
import assert from 'node:assert';
import { calculateNatalChart } from '../dist/kp/engine.js';

test('Calculates full Natal Chart with 4-level significators, ruling planets, and dasha', () => {
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
  assert.strictEqual(chart.planets.length, 12);
  assert.strictEqual(chart.houses.length, 12);
  assert.strictEqual(chart.ayanamsaMode, 'KP_OLD');
  assert.ok(chart.ayanamsaValueDeg > 23.6 && chart.ayanamsaValueDeg < 23.7);

  // Ascendant verification
  assert.ok(chart.ascendant.siderealLongitude > 0);
  assert.ok(chart.ascendant.signLord);
  assert.ok(chart.ascendant.starLord);
  assert.ok(chart.ascendant.subLord);

  // Four-level significators structure
  for (let h = 1; h <= 12; h++) {
    const houseSig = chart.significators.houseWise[h];
    assert.ok(houseSig, `House ${h} significators missing`);
    assert.ok(Array.isArray(houseSig.level1));
    assert.ok(Array.isArray(houseSig.level2));
    assert.ok(Array.isArray(houseSig.level3));
    assert.ok(Array.isArray(houseSig.level4));
  }

  // Rahu / Ketu rules documented
  assert.ok(chart.significators.rahuKetuRules.includes('Standard KP School'));

  // Ruling planets
  assert.ok(chart.rulingPlanets.ascendantSignLord);
  assert.ok(chart.rulingPlanets.ascendantStarLord);
  assert.ok(chart.rulingPlanets.moonSignLord);
  assert.ok(chart.rulingPlanets.moonStarLord);
  assert.ok(chart.rulingPlanets.dayLord);
  assert.strictEqual(chart.rulingPlanets.rulingPlanetsList.length, 5);

  // Vimshottari Dasha
  assert.ok(chart.dashaBalance.birthStar);
  assert.ok(chart.dashaBalance.dashaLord);
  assert.ok(chart.dashaBalance.balanceYears >= 0);
  assert.strictEqual(chart.dashaBalance.dashaTimeline.length, 9);

  // Check first dasha period has bhuktis and antaras
  const firstDasha = chart.dashaBalance.dashaTimeline[0];
  assert.ok(firstDasha.subPeriods && firstDasha.subPeriods.length === 9);
  const firstBhukti = firstDasha.subPeriods![0];
  assert.ok(firstBhukti.subPeriods && firstBhukti.subPeriods.length === 9);
});
