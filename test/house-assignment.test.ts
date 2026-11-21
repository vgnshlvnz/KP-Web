import { describe, it, expect } from 'vitest';
import {
  getHouseForLongitude,
  isInHouse,
  assignPlanetsToHouses,
} from '../src/engine/house-assignment.js';

describe('KP Cuspal House Assignment Rules', () => {
  // Test cusps with unequal Placidus houses
  // House 1: 35° to 65° (spans Taurus 5° to Gemini 5°)
  // House 2: 65° to 92°
  // House 3: 92° to 118°
  // House 4: 118° to 145°
  // House 5: 145° to 175°
  // House 6: 175° to 215°
  // House 7: 215° to 245°
  // House 8: 245° to 272°
  // House 9: 272° to 298°
  // House 10: 298° to 325°
  // House 11: 325° to 355°
  // House 12: 355° to 35° (crosses 0°/360° Aries boundary!)
  const testCusps = [
    35.0,  // Cusp 1
    65.0,  // Cusp 2
    92.0,  // Cusp 3
    118.0, // Cusp 4
    145.0, // Cusp 5
    175.0, // Cusp 6
    215.0, // Cusp 7
    245.0, // Cusp 8
    272.0, // Cusp 9
    298.0, // Cusp 10
    325.0, // Cusp 11
    355.0, // Cusp 12
  ];

  it('assigns a planet immediately before a cusp to the PREVIOUS house', () => {
    // Cusp 1 is at 35°. A planet at 34.999° is immediately before Cusp 1.
    // It must belong to House 12 (the previous house).
    expect(getHouseForLongitude(34.999, testCusps)).toBe(12);

    // Cusp 2 is at 65°. A planet at 64.999° is immediately before Cusp 2.
    // It must belong to House 1.
    expect(getHouseForLongitude(64.999, testCusps)).toBe(1);

    // Cusp 3 is at 92°. A planet at 91.999° is immediately before Cusp 3.
    // It must belong to House 2.
    expect(getHouseForLongitude(91.999, testCusps)).toBe(2);

    // Cusp 10 is at 298°. A planet at 297.999° is immediately before Cusp 10.
    // It must belong to House 9.
    expect(getHouseForLongitude(297.999, testCusps)).toBe(9);
  });

  it('assigns a planet to the house of the cusp it has PASSED', () => {
    // Cusp 1 is at 35°. A planet at 35.001° has passed Cusp 1 -> House 1.
    expect(getHouseForLongitude(35.001, testCusps)).toBe(1);

    // Cusp 2 is at 65°. A planet at 65.001° has passed Cusp 2 -> House 2.
    expect(getHouseForLongitude(65.001, testCusps)).toBe(2);

    // Exactly at Cusp 1 (35°) -> House 1.
    expect(getHouseForLongitude(35.0, testCusps)).toBe(1);

    // Exactly at Cusp 2 (65°) -> House 2.
    expect(getHouseForLongitude(65.0, testCusps)).toBe(2);
  });

  it('assigns house based on CUSPS, NOT zodiac sign', () => {
    // Zodiac signs:
    // Aries: 0° - 30°
    // Taurus: 30° - 60°
    // Gemini: 60° - 90°

    // A planet at 32° is in Taurus (zodiac sign).
    // But Cusp 1 is at 35° (Taurus 5°).
    // The planet at 32° has NOT passed Cusp 1 yet, so it is in HOUSE 12!
    expect(getHouseForLongitude(32.0, testCusps)).toBe(12);

    // A planet at 62° is in Gemini (zodiac sign).
    // But Cusp 2 is at 65° (Gemini 5°).
    // The planet at 62° has passed Cusp 1 (35°), but NOT Cusp 2 (65°).
    // So it is in HOUSE 1, despite being in Gemini!
    expect(getHouseForLongitude(62.0, testCusps)).toBe(1);

    // A planet at 66° is in Gemini and has passed Cusp 2 (65°) -> House 2.
    expect(getHouseForLongitude(66.0, testCusps)).toBe(2);
  });

  it('handles 0°/360° Aries wrap-around correctly (House 12: 355° to 35°)', () => {
    // Planet at 358° (Pisces 28°) -> House 12
    expect(getHouseForLongitude(358.0, testCusps)).toBe(12);

    // Planet at 0.5° (Aries 0°30') -> House 12
    expect(getHouseForLongitude(0.5, testCusps)).toBe(12);

    // Planet at 15° (Aries 15°) -> House 12
    expect(getHouseForLongitude(15.0, testCusps)).toBe(12);

    // Planet at 34.99° (Aries 4°59') -> House 12
    expect(getHouseForLongitude(34.99, testCusps)).toBe(12);

    // Planet at 35.01° (Taurus 5°01') -> House 1
    expect(getHouseForLongitude(35.01, testCusps)).toBe(1);
  });

  it('assigns multiple planets to houses with accurate distance metrics', () => {
    const planets = [
      { name: 'Sun', longitude: 32.0 },   // in Taurus, before Cusp 1 -> House 12
      { name: 'Moon', longitude: 36.0 },  // in Taurus, after Cusp 1 -> House 1
      { name: 'Mars', longitude: 63.0 },  // in Gemini, before Cusp 2 -> House 1
      { name: 'Jupiter', longitude: 68.0 }, // in Gemini, after Cusp 2 -> House 2
      { name: 'Saturn', longitude: 10.0 }, // in Aries, before Cusp 1 -> House 12
    ];

    const result = assignPlanetsToHouses(planets, testCusps);

    expect(result).toHaveLength(5);

    const sun = result.find((p) => p.name === 'Sun')!;
    expect(sun.house).toBe(12);
    // In House 12 (355° to 35°): distance passed 355° is (32 - 355 + 360) = 37°
    expect(sun.distancePassedCusp).toBeCloseTo(37.0, 4);
    // Distance to next cusp (35°): 35 - 32 = 3°
    expect(sun.distanceToNextCusp).toBeCloseTo(3.0, 4);

    const moon = result.find((p) => p.name === 'Moon')!;
    expect(moon.house).toBe(1);
    expect(moon.distancePassedCusp).toBeCloseTo(1.0, 4); // 36 - 35 = 1°
    expect(moon.distanceToNextCusp).toBeCloseTo(29.0, 4); // 65 - 36 = 29°

    const mars = result.find((p) => p.name === 'Mars')!;
    expect(mars.house).toBe(1);
    expect(mars.distancePassedCusp).toBeCloseTo(28.0, 4); // 63 - 35 = 28°
    expect(mars.distanceToNextCusp).toBeCloseTo(2.0, 4);  // 65 - 63 = 2°

    const jupiter = result.find((p) => p.name === 'Jupiter')!;
    expect(jupiter.house).toBe(2);
    expect(jupiter.distancePassedCusp).toBeCloseTo(3.0, 4); // 68 - 65 = 3°

    const saturn = result.find((p) => p.name === 'Saturn')!;
    expect(saturn.house).toBe(12);
  });
});

describe('assignPlanetsToHouses boundary options (port-chart, #54)', () => {
  const cusps = [35, 65, 92, 118, 145, 175, 215, 245, 272, 298, 325, 355];
  const planets = [
    { name: 'Sun', longitude: 32.0 },
    { name: 'Moon', longitude: 42.0295069, speed: 13.2 },
    { name: 'Rahu', longitude: 252.4479023, speed: -0.05 },
  ];

  it('without options the result has no boundary fields (unchanged)', () => {
    for (const p of assignPlanetsToHouses(planets, cusps)) {
      expect('isNearSubBoundary' in p).toBe(false);
      expect('isNearSubSubBoundary' in p).toBe(false);
    }
  });

  it('with options every planet carries the sub and sub-sub boundary fields, and the same house and lords', () => {
    const plain = assignPlanetsToHouses(planets, cusps);
    const withOptions = assignPlanetsToHouses(planets, cusps, { nearBoundaryThresholdArcsec: 60 });
    expect(withOptions).toHaveLength(3);
    withOptions.forEach((p, i) => {
      expect(p.house).toBe(plain[i].house);
      expect(p.subLord).toBe(plain[i].subLord);
      expect(p.subSubLord).toBe(plain[i].subSubLord);
      expect(p.distancePassedCusp).toBe(plain[i].distancePassedCusp);
      expect(typeof p.isNearSubBoundary).toBe('boolean');
      expect(typeof p.isNearSubSubBoundary).toBe('boolean');
      expect(p.distanceFromSubSubStartArcsec).toBeGreaterThanOrEqual(0);
    });
    expect(withOptions[2].isRetrograde).toBe(true);
  });

  it('rejects an invalid threshold instead of defaulting', () => {
    expect(() => assignPlanetsToHouses(planets, cusps, { nearBoundaryThresholdArcsec: -1 })).toThrow(RangeError);
  });
});
