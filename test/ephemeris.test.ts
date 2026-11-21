import { describe, it, expect } from 'vitest';
import { calculateEphemeris, calculateMeanLunarNode } from '../src/engine/ephemeris.js';
import type { AyanamsaMode, NodeMode } from '../src/engine/types.js';

/**
 * Re-pointed from Stack B's `calculatePlanetaryPositions(date, 'KP_OLD', 'MEAN')` to the unified
 * `calculateEphemeris` (port-ephemeris, #41). Reference values and tolerances are unchanged.
 * Two things differ by design: the options are explicit (no default for ayanamsa, node mode or outer
 * planets), and sidereal = tropical - (mean ayanamsa + nutation), so the sidereal identity below uses
 * `trueAyanamsaDeg` (issue #33).
 */
function calculatePlanetaryPositions(
  date: Date,
  ayanamsa: AyanamsaMode,
  nodeMode: NodeMode,
  includeOuterPlanets = true
) {
  const r = calculateEphemeris(date, { ayanamsa, nodeMode, includeOuterPlanets });
  return { planets: r.planets, ayanamsaDeg: r.trueAyanamsaDeg, meanAyanamsaDeg: r.meanAyanamsaDeg };
}

describe('Ephemeris (astronomy-engine)', () => {
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
      'kp_old',
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
    const { planets } = calculatePlanetaryPositions(testDate, 'kp_old', 'MEAN');

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
    const { planets } = calculatePlanetaryPositions(testDate, 'kp_old', 'MEAN');

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
    const resOld = calculatePlanetaryPositions(testDate, 'kp_old', 'MEAN');
    const resNew = calculatePlanetaryPositions(testDate, 'kp_new', 'MEAN');

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

  it('returns Uranus, Neptune and Pluto only when includeOuterPlanets is true (TODO(#29 Q12))', () => {
    const testDate = new Date(Date.UTC(1990, 4, 15, 14, 30, 0));
    const without = calculateEphemeris(testDate, {
      ayanamsa: 'kp_old',
      nodeMode: 'MEAN',
      includeOuterPlanets: false,
    });
    const withOuter = calculateEphemeris(testDate, {
      ayanamsa: 'kp_old',
      nodeMode: 'MEAN',
      includeOuterPlanets: true,
    });
    expect(without.planets.map((p) => p.name)).toEqual([
      'Sun',
      'Moon',
      'Mars',
      'Mercury',
      'Jupiter',
      'Venus',
      'Saturn',
      'Rahu',
      'Ketu',
    ]);
    expect(withOuter.planets.map((p) => p.name).slice(9)).toEqual(['Uranus', 'Neptune', 'Pluto']);
    // The classical nine are identical either way.
    expect(withOuter.planets.slice(0, 9)).toEqual(without.planets);
  });

  it('rejects an unknown ayanamsa or node mode instead of falling back (TODO(#22), TODO(#29 Q6))', () => {
    const testDate = new Date(Date.UTC(1990, 4, 15, 14, 30, 0));
    const base = { ayanamsa: 'kp_old', nodeMode: 'MEAN', includeOuterPlanets: false } as const;
    expect(() => calculateEphemeris(testDate, { ...base, ayanamsa: 'lahiri' as never })).toThrow(/ayanamsa/i);
    expect(() => calculateEphemeris(testDate, { ...base, ayanamsa: 'KP_OLD' as never })).toThrow(/ayanamsa/i);
    expect(() => calculateEphemeris(testDate, { ...base, ayanamsa: undefined as never })).toThrow(/ayanamsa/i);
    expect(() => calculateEphemeris(testDate, { ...base, nodeMode: undefined as never })).toThrow(/node/i);
  });

  it('mean and true node modes give different but close Rahu, and Ketu stays opposite', () => {
    const testDate = new Date(Date.UTC(1990, 4, 15, 14, 30, 0));
    const mean = calculatePlanetaryPositions(testDate, 'kp_old', 'MEAN').planets.find((p) => p.name === 'Rahu')!;
    const trueNode = calculatePlanetaryPositions(testDate, 'kp_old', 'TRUE').planets.find((p) => p.name === 'Rahu')!;
    const delta = Math.abs(((trueNode.siderealLongitude - mean.siderealLongitude + 540) % 360) - 180);
    // True node oscillates within about 1.5 degrees of the mean node.
    expect(delta).toBeGreaterThan(0.001);
    expect(delta).toBeLessThan(2);
    // Ketu stays exactly opposite in true mode too.
    const ketu = calculatePlanetaryPositions(testDate, 'kp_old', 'TRUE').planets.find((p) => p.name === 'Ketu')!;
    expect(Math.abs(((ketu.siderealLongitude - trueNode.siderealLongitude + 360) % 360) - 180)).toBeLessThan(1e-10);
  });

  it('mean node polynomial gives the IAU value at J2000.0 (125.04455501 deg)', () => {
    expect(calculateMeanLunarNode(2451545.0)).toBeCloseTo(125.04455501, 8);
  });

  it('reports the nutation and obliquity used, from the same model as the planets', () => {
    const r = calculateEphemeris(new Date(Date.UTC(1992, 2, 10, 22, 14, 0)), {
      ayanamsa: 'kp_old',
      nodeMode: 'MEAN',
      includeOuterPlanets: false,
    });
    // Appendix A.1: dPsi 17.4325 arcsec, true obliquity 23.4407206 deg.
    expect(Math.abs(r.nutationInLongitudeDeg * 3600 - 17.4325)).toBeLessThan(0.2);
    expect(Math.abs(r.trueObliquityDeg - 23.4407206) * 3600).toBeLessThan(0.1);
    expect(r.trueObliquityDeg - r.meanObliquityDeg).toBeCloseTo(r.nutationInObliquityDeg, 12);
  });
});
