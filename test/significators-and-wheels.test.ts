import { describe, it, expect } from 'vitest';
import { calculateKPChart } from '../src/engine/index.js';
import { calculateSignificators } from '../src/engine/significators.js';
import { buildChartWheels } from '../src/engine/chart-wheels.js';

describe('Significators and Chart Wheels', () => {
  const sampleData = {
    year: 1947,
    month: 8,
    day: 14,
    hour: 18,
    minute: 30,
    second: 0,
    latitude: 28.6139,
    longitude: 77.209,
  };

  const samplePlanets = [
    { name: 'Sun', longitude: 118.0 },    // Cancer
    { name: 'Moon', longitude: 84.0 },    // Gemini
    { name: 'Mars', longitude: 67.0 },    // Gemini
    { name: 'Mercury', longitude: 114.0 }, // Cancer
    { name: 'Jupiter', longitude: 211.0 }, // Libra
    { name: 'Venus', longitude: 105.0 },  // Cancer
    { name: 'Saturn', longitude: 110.0 }, // Cancer
    { name: 'Rahu', longitude: 35.0 },    // Taurus
    { name: 'Ketu', longitude: 215.0 },   // Scorpio
  ];

  it('computes 4-level significators for all 12 houses', () => {
    const chart = calculateKPChart(sampleData, 'kp_old', samplePlanets);

    expect(chart.significators).toBeDefined();
    expect(chart.significators!.houseWise).toHaveLength(12);
    expect(chart.significators!.planetWise).toHaveLength(samplePlanets.length);

    // Each house must have level 1..4 arrays defined
    for (const hw of chart.significators!.houseWise) {
      expect(hw.house).toBeGreaterThanOrEqual(1);
      expect(hw.house).toBeLessThanOrEqual(12);
      expect(Array.isArray(hw.level1)).toBe(true);
      expect(Array.isArray(hw.level2)).toBe(true);
      expect(Array.isArray(hw.level3)).toBe(true);
      expect(Array.isArray(hw.level4)).toBe(true);
      // Level 4 is always the cusp sign lord (non-empty)
      expect(hw.level4.length).toBeGreaterThan(0);
    }
  });

  it('builds South Indian and North Indian chart wheel models', () => {
    const chart = calculateKPChart(sampleData, 'kp_old', samplePlanets);

    expect(chart.chartWheels).toBeDefined();
    // South Indian has 12 boxes (one per zodiac sign)
    expect(chart.chartWheels!.southIndian).toHaveLength(12);
    // North Indian has 12 houses (one per house)
    expect(chart.chartWheels!.northIndian).toHaveLength(12);

    // Verify all 12 cusps are accounted for in South Indian chart
    const totalCuspsInSouthIndian = chart.chartWheels!.southIndian.reduce(
      (sum, box) => sum + box.cusps.length,
      0
    );
    expect(totalCuspsInSouthIndian).toBe(12);

    // Verify all planets are accounted for in North Indian chart
    const totalPlanetsInNorthIndian = chart.chartWheels!.northIndian.reduce(
      (sum, house) => sum + house.planets.length,
      0
    );
    expect(totalPlanetsInNorthIndian).toBe(samplePlanets.length);
  });
});
