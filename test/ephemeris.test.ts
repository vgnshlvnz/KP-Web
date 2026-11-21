import { describe, it, expect } from 'vitest';
import {
  calculateMeanLunarNode,
  calculatePlanetaryPositions,
} from '../src/ephemeris/jpl-ephemeris.js';

describe('JPL ephemeris (astronomy-engine)', () => {
  it('Planetary positions computed via NASA JPL Ephemeris match reference within arcseconds', () => {
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

    expect(planets.length).toBe(12);

    for (const [body, refLon] of Object.entries(refTropical)) {
      const p = planets.find((item) => item.name === body);
      expect(p, `Missing body: ${body}`).toBeTruthy();

      // Diff in arcseconds
      let diff = Math.abs(p!.tropicalLongitude - refLon);
      if (diff > 180) diff = 360 - diff;
      const diffArcsec = diff * 3600;

      expect(
        diffArcsec < 3.0,
        `Body ${body} difference ${diffArcsec.toFixed(2)}" exceeds 3 arcsec tolerance`
      ).toBe(true);

      // Verify sidereal position matches tropical - ayanamsa
      const expectedSidereal = ((p!.tropicalLongitude - ayanamsaDeg) % 360 + 360) % 360;
      expect(p!.siderealLongitude.toFixed(5)).toBe(expectedSidereal.toFixed(5));
    }
  });

  it('Retrograde detection and speeds for planets', () => {
    const testDate = new Date(Date.UTC(1990, 4, 15, 14, 30, 0));
    const { planets } = calculatePlanetaryPositions(testDate, 'KP_OLD', 'MEAN');

    const mercury = planets.find((p) => p.name === 'Mercury')!;
    const saturn = planets.find((p) => p.name === 'Saturn')!;
    const sun = planets.find((p) => p.name === 'Sun')!;

    // On 1990-05-15, Mercury and Saturn are retrograde
    expect(mercury.isRetrograde).toBe(true);
    expect(mercury.speedLongitudeDegPerDay < 0).toBe(true);

    expect(saturn.isRetrograde).toBe(true);
    expect(saturn.speedLongitudeDegPerDay < 0).toBe(true);

    // Sun is always direct (~1 degree/day)
    expect(sun.isRetrograde).toBe(false);
    expect(sun.speedLongitudeDegPerDay > 0.9 && sun.speedLongitudeDegPerDay < 1.1).toBe(true);
  });

  it('Rahu and Ketu are always exactly 180 degrees opposite', () => {
    const testDate = new Date(Date.UTC(2026, 10, 21, 6, 0, 0));
    const { planets } = calculatePlanetaryPositions(testDate, 'KP_OLD', 'MEAN');

    const rahu = planets.find((p) => p.name === 'Rahu')!;
    const ketu = planets.find((p) => p.name === 'Ketu')!;

    const diff = Math.abs(rahu.siderealLongitude - ketu.siderealLongitude);
    expect(
      Math.abs(diff - 180) < 1e-10,
      `Rahu (${rahu.siderealLongitude}) and Ketu (${ketu.siderealLongitude}) must be 180° apart`
    ).toBe(true);

    // Mean Rahu/Ketu are always retrograde in tropical/sidereal motion
    expect(rahu.isRetrograde).toBe(true);
    expect(ketu.isRetrograde).toBe(true);
  });

  it('Supports both KP Old and KP New ayanamsas without silent fallback', () => {
    const testDate = new Date(Date.UTC(2026, 10, 21, 6, 0, 0));
    const resOld = calculatePlanetaryPositions(testDate, 'KP_OLD', 'MEAN');
    const resNew = calculatePlanetaryPositions(testDate, 'KP_NEW', 'MEAN');

    // KP New has slightly higher ayanamsa than KP Old (~72 arcseconds)
    expect(resNew.ayanamsaDeg > resOld.ayanamsaDeg).toBe(true);
    const diffArcsec = (resNew.ayanamsaDeg - resOld.ayanamsaDeg) * 3600;
    expect(Math.abs(diffArcsec - 72.44) < 0.1).toBe(true);

    // Sidereal positions in KP New are slightly lower than KP Old by ~72 arcseconds
    const sunOld = resOld.planets.find((p) => p.name === 'Sun')!;
    const sunNew = resNew.planets.find((p) => p.name === 'Sun')!;

    const sunDiffArcsec = (sunOld.siderealLongitude - sunNew.siderealLongitude) * 3600;
    expect(Math.abs(sunDiffArcsec - 72.44) < 0.1).toBe(true);
  });
});
