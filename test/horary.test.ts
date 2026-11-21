import test from 'node:test';
import assert from 'node:assert';
import { getHoraryEntry, getHoraryTable } from '../dist/kp/horary-table.js';
import { calculateHoraryChart } from '../dist/kp/horary.js';

test('KP 1–249 Horary table has exactly 249 entries', () => {
  const table = getHoraryTable();
  assert.strictEqual(table.length, 249);
  assert.strictEqual(table[0].horaryNumber, 1);
  assert.strictEqual(table[248].horaryNumber, 249);
});

test('Split horary numbers 22 and 23 at 30° Aries/Taurus boundary', () => {
  const entry22 = getHoraryEntry(22);
  const entry23 = getHoraryEntry(23);

  // Both are in Krittika (Star Lord: Sun) and Sub Lord: Rahu
  assert.strictEqual(entry22.nakshatraName, 'Krittika');
  assert.strictEqual(entry22.subLord, 'Rahu');
  assert.strictEqual(entry22.signName, 'Aries');
  assert.strictEqual(entry22.signLord, 'Mars');
  assert.strictEqual(entry22.endLongitude, 30.0);

  assert.strictEqual(entry23.nakshatraName, 'Krittika');
  assert.strictEqual(entry23.subLord, 'Rahu');
  assert.strictEqual(entry23.signName, 'Taurus');
  assert.strictEqual(entry23.signLord, 'Venus');
  assert.strictEqual(entry23.startLongitude, 30.0);
});

test('Split horary numbers 105 and 106 at 150° Leo/Virgo boundary', () => {
  const entry105 = getHoraryEntry(105);
  const entry106 = getHoraryEntry(106);

  assert.strictEqual(entry105.signName, 'Leo');
  assert.strictEqual(entry105.signLord, 'Sun');
  assert.strictEqual(entry105.nakshatraName, 'Uttara Phalguni');
  assert.strictEqual(entry105.subLord, 'Rahu');
  assert.strictEqual(entry105.endLongitude, 150.0);

  assert.strictEqual(entry106.signName, 'Virgo');
  assert.strictEqual(entry106.signLord, 'Mercury');
  assert.strictEqual(entry106.nakshatraName, 'Uttara Phalguni');
  assert.strictEqual(entry106.subLord, 'Rahu');
  assert.strictEqual(entry106.startLongitude, 150.0);
});

test('Horary number 108 gives exactly 3°00\' Virgo (153.0°)', () => {
  const entry108 = getHoraryEntry(108);

  assert.strictEqual(entry108.horaryNumber, 108);
  assert.strictEqual(entry108.signName, 'Virgo');
  assert.strictEqual(entry108.signLord, 'Mercury');
  assert.strictEqual(entry108.nakshatraName, 'Uttara Phalguni');
  assert.strictEqual(entry108.starLord, 'Sun');
  assert.strictEqual(entry108.subLord, 'Saturn');

  // Exact 153° = 3°00' Virgo
  assert.ok(Math.abs(entry108.startLongitude - 153.0) < 1e-10);
});

test('Horary chart calculation sets Lagna at start of sub by default', () => {
  const chart = calculateHoraryChart({
    horaryNumber: 108,
    dateUtc: new Date(Date.UTC(2026, 10, 21, 6, 0, 0)),
    coordinates: { latitude: 13.0827, longitude: 80.2707 },
    ayanamsaMode: 'KP_OLD',
    useSubMidpoint: false,
  });

  // Lagna should be at start of sub (153°)
  assert.strictEqual(chart.useSubMidpoint, false);
  assert.ok(Math.abs(chart.lagnaTargetDeg - 153.0) < 1e-10);
  assert.ok(Math.abs(chart.ascendant.siderealLongitude - 153.0) < 1e-6);
  assert.strictEqual(chart.ascendant.signName, 'Virgo');
  assert.strictEqual(chart.ascendant.starLord, 'Sun');
  assert.strictEqual(chart.ascendant.subLord, 'Saturn');
});

test('Horary chart calculation toggle supports sub midpoint', () => {
  const entry = getHoraryEntry(108);
  const midpoint = (entry.startLongitude + entry.endLongitude) / 2;

  const chart = calculateHoraryChart({
    horaryNumber: 108,
    dateUtc: new Date(Date.UTC(2026, 10, 21, 6, 0, 0)),
    coordinates: { latitude: 13.0827, longitude: 80.2707 },
    ayanamsaMode: 'KP_OLD',
    useSubMidpoint: true,
  });

  assert.strictEqual(chart.useSubMidpoint, true);
  assert.ok(Math.abs(chart.lagnaTargetDeg - midpoint) < 1e-10);
  assert.ok(Math.abs(chart.ascendant.siderealLongitude - midpoint) < 1e-6);
});
