import test from 'node:test';
import assert from 'node:assert';
import {
  calculateMeanLunarNode,
  calculatePlanetaryPositions,
} from '../dist/ephemeris/jpl-ephemeris.js';

test('Planetary positions computed via NASA JPL Ephemeris match reference within arcseconds', () => {
  // Test moment: 1990-05-15 14:30:00 UTC
  const testDate = new Date(Date.UTC(1990, 4, 15, 14, 30, 0));

  // Reference tropical apparent longitudes from Swiss Ephemeris / NASA JPL DE406
  const refTropical: Record<string, number> = {
    Sun: 54.49656,
    Moon: 298.45007,
    Mercury: 38.00034,
    Venus: 12.93714,
    Mars: 348.41122,
    Jupiter: 99.56141,
    Saturn: 295.24767,
  };

  const { planets, ayanamsaDeg } = calculatePlanetaryPositions(
    testDate,
    'KP_OLD',
    'MEAN'
  );

  assert.strictEqual(planets.length, 12);

  for (const [body, refLon] of Object.entries(refTropical)) {
    const p = planets.find((item) => item.name === body);
    assert.ok(p, `Missing body: ${body}`);

    // Diff in arcseconds
    let diff = Math.abs(p.tropicalLongitude - refLon);
    if (diff > 180) diff = 360 - diff;
    const diffArcsec = diff * 3600;

    assert.ok(
      diffArcsec < 3.0,
      `Body ${body} difference ${diffArcsec.toFixed(2)}" exceeds 3 arcsec tolerance`
    );

    // Verify sidereal position matches tropical - ayanamsa
    const expectedSidereal = ((p.tropicalLongitude - ayanamsaDeg) % 360 + 360) % 360;
    assert.strictEqual(
      p.siderealLongitude.toFixed(5),
      expectedSidereal.toFixed(5)
    );
  }
});

test('Retrograde detection and speeds for planets', () => {
  const testDate = new Date(Date.UTC(1990, 4, 15, 14, 30, 0));
  const { planets } = calculatePlanetaryPositions(testDate, 'KP_OLD', 'MEAN');

  const mercury = planets.find((p) => p.name === 'Mercury')!;
  const saturn = planets.find((p) => p.name === 'Saturn')!;
  const sun = planets.find((p) => p.name === 'Sun')!;

  // On 1990-05-15, Mercury and Saturn are retrograde
  assert.strictEqual(mercury.isRetrograde, true);
  assert.ok(mercury.speedLongitudeDegPerDay < 0);

  assert.strictEqual(saturn.isRetrograde, true);
  assert.ok(saturn.speedLongitudeDegPerDay < 0);

  // Sun is always direct (~1 degree/day)
  assert.strictEqual(sun.isRetrograde, false);
  assert.ok(sun.speedLongitudeDegPerDay > 0.9 && sun.speedLongitudeDegPerDay < 1.1);
});

test('Rahu and Ketu are always exactly 180 degrees opposite', () => {
  const testDate = new Date(Date.UTC(2026, 10, 21, 6, 0, 0));
  const { planets } = calculatePlanetaryPositions(testDate, 'KP_OLD', 'MEAN');

  const rahu = planets.find((p) => p.name === 'Rahu')!;
  const ketu = planets.find((p) => p.name === 'Ketu')!;

  const diff = Math.abs(rahu.siderealLongitude - ketu.siderealLongitude);
  assert.ok(
    Math.abs(diff - 180) < 1e-10,
    `Rahu (${rahu.siderealLongitude}) and Ketu (${ketu.siderealLongitude}) must be 180° apart`
  );

  // Mean Rahu/Ketu are always retrograde in tropical/sidereal motion
  assert.strictEqual(rahu.isRetrograde, true);
  assert.strictEqual(ketu.isRetrograde, true);
});

test('Supports both KP Old and KP New ayanamsas without silent fallback', () => {
  const testDate = new Date(Date.UTC(2026, 10, 21, 6, 0, 0));
  const resOld = calculatePlanetaryPositions(testDate, 'KP_OLD', 'MEAN');
  const resNew = calculatePlanetaryPositions(testDate, 'KP_NEW', 'MEAN');

  // KP New has slightly higher ayanamsa than KP Old (~72 arcseconds)
  assert.ok(resNew.ayanamsaDeg > resOld.ayanamsaDeg);
  const diffArcsec = (resNew.ayanamsaDeg - resOld.ayanamsaDeg) * 3600;
  assert.ok(Math.abs(diffArcsec - 72.44) < 0.1);

  // Sidereal positions in KP New are slightly lower than KP Old by ~72 arcseconds
  const sunOld = resOld.planets.find((p) => p.name === 'Sun')!;
  const sunNew = resNew.planets.find((p) => p.name === 'Sun')!;

  const sunDiffArcsec = (sunOld.siderealLongitude - sunNew.siderealLongitude) * 3600;
  assert.ok(Math.abs(sunDiffArcsec - 72.44) < 0.1);
});
