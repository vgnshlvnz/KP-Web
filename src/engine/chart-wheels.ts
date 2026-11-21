import {
  KPCusp,
  PlanetHouseAssignment,
  ChartWheels,
  SouthIndianBox,
  NorthIndianHouse,
} from './types.js';
import { ZODIAC_SIGNS } from './kp-lords.js';

/**
 * Builds data structures for South Indian and North Indian chart wheels.
 * - South Indian Chart: Fixed zodiac sign boxes, placing cusps and planets into their signs.
 * - North Indian Chart: Fixed house diamonds (House 1 at top), placing sign numbers and planets into houses.
 */
export function buildChartWheels(
  cusps: KPCusp[],
  planets: PlanetHouseAssignment[] = []
): ChartWheels {
  // South Indian Chart: 12 boxes for 12 signs (0 = Aries to 11 = Pisces)
  const southIndian: SouthIndianBox[] = ZODIAC_SIGNS.map((sign, signIdx) => {
    const boxCusps = cusps
      .filter((c) => c.signIndex === signIdx)
      .map((c) => ({
        house: c.house,
        formatted: c.formatted,
        longitude: c.longitude,
      }));

    const boxPlanets = planets
      .filter((p) => p.signIndex === signIdx)
      .map((p) => ({
        name: p.name,
        formatted: p.formatted,
        longitude: p.longitude,
        house: p.house,
      }));

    return {
      signIndex: signIdx,
      signName: sign.name,
      signLord: sign.lord,
      cusps: boxCusps,
      planets: boxPlanets,
    };
  });

  // North Indian Chart: 12 houses (House 1 to 12)
  const northIndian: NorthIndianHouse[] = cusps.map((c) => {
    const housePlanets = planets
      .filter((p) => p.house === c.house)
      .map((p) => ({
        name: p.name,
        formatted: p.formatted,
        longitude: p.longitude,
      }));

    return {
      house: c.house,
      signIndex: c.signIndex,
      signName: c.signName,
      signLord: c.signLord,
      cuspLongitude: c.longitude,
      cuspFormatted: c.formatted,
      planets: housePlanets,
    };
  });

  return {
    southIndian,
    northIndian,
  };
}
