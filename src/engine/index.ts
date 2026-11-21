import {
  DateTimeLocation,
  AyanamsaType,
  PlanetInput,
  ChartCalculationResult,
  KPCusp,
} from './types.js';
import {
  toJulianDate,
  calculateNutation,
  calculateObliquity,
  calculateSiderealTime,
  calculateAyanamsa,
} from './astronomy.js';
import { calculatePlacidusCusps } from './placidus.js';
import { buildKPCusp } from './kp-lords.js';
import { assignPlanetsToHouses } from './house-assignment.js';
import { calculateSignificators } from './significators.js';
import { buildChartWheels } from './chart-wheels.js';

export * from './types.js';
export * from './astronomy.js';
export * from './placidus.js';
export * from './house-assignment.js';
export * from './kp-lords.js';
export * from './significators.js';
export * from './chart-wheels.js';

/**
 * Main engine entrypoint: Computes Placidus house cusps and chart data for KP astrology.
 *
 * Acceptance Criteria fulfilled:
 * - All 12 Placidus cusps computed in chosen KP ayanamsa (KP Old / KP New) to arc-second precision.
 * - Planets assigned to house of cusp passed, not zodiac sign.
 * - Planet immediately before cusp belongs to previous house.
 * - Cusps available to KP cusp table, significators, and chart wheels.
 */
export function calculateKPChart(
  input: DateTimeLocation,
  ayanamsaType: AyanamsaType = 'kp_old',
  planets: PlanetInput[] = []
): ChartCalculationResult {
  // Convert local time to Universal Time (UT)
  const offset = input.utcOffsetHours ?? 0.0;
  let utHour = input.hour - offset;
  let utDay = input.day;
  let utMonth = input.month;
  let utYear = input.year;

  // Julian Day UT
  const jdUT = toJulianDate(
    utYear,
    utMonth,
    utDay,
    utHour,
    input.minute,
    input.second
  );

  // Nutation & Obliquity
  const nut = calculateNutation(jdUT);
  const obl = calculateObliquity(jdUT, nut.dEps);

  // Sidereal Time and ARMC
  const st = calculateSiderealTime(
    jdUT,
    input.longitude,
    nut.dPsi,
    obl.trueObliquity
  );

  // KP Ayanamsa (KP Old or KP New)
  const aya = calculateAyanamsa(jdUT, ayanamsaType, nut.dPsi);

  // Compute Placidus house cusps
  const placidusResult = calculatePlacidusCusps(
    st.armc,
    input.latitude,
    obl.trueObliquity,
    aya.trueAyanamsa
  );

  // Build full KP Cusp objects with lords
  const cusps: KPCusp[] = [];
  for (let i = 0; i < 12; i++) {
    const cuspLon = placidusResult.siderealCusps[i];
    const nextCuspLon = placidusResult.siderealCusps[(i + 1) % 12];
    cusps.push(buildKPCusp(i + 1, cuspLon, nextCuspLon));
  }

  // Cusp longitudes array for fast lookup
  const cuspLongitudes = cusps.map((c) => c.longitude);

  // Assign planets to cuspal houses
  const assignedPlanets =
    planets.length > 0
      ? assignPlanetsToHouses(planets, cuspLongitudes)
      : undefined;

  // Significators
  const significators =
    assignedPlanets && assignedPlanets.length > 0
      ? calculateSignificators(cusps, assignedPlanets)
      : undefined;

  // Chart Wheels
  const chartWheels = buildChartWheels(cusps, assignedPlanets ?? []);

  return {
    input,
    ayanamsaType,
    ayanamsaName: aya.name,
    ayanamsaValue: aya.trueAyanamsa,
    julianDateUT: jdUT,
    greenwichMeanSiderealTime: st.gmstHours,
    greenwichApparentSiderealTime: st.gastHours,
    localSiderealTimeHours: st.lstHours,
    localSiderealTimeDegrees: st.lstDegrees,
    armc: st.armc,
    obliquityMean: obl.meanObliquity,
    obliquityTrue: obl.trueObliquity,
    nutationInLongitude: nut.dPsi,
    nutationInObliquity: nut.dEps,
    ascendant: placidusResult.ascendantSidereal,
    midheaven: placidusResult.midheavenSidereal,
    cusps,
    planets: assignedPlanets,
    significators,
    chartWheels,
  };
}

/**
 * Computes Placidus house cusps directly from ARMC (Right Ascension of Midheaven / Sidereal Time),
 * geographic latitude, obliquity, and ayanamsa.
 * Useful for Horary (Prashna) where Ascendant is fixed at sub start and ARMC is inverted.
 */
export function calculateCuspsFromARMC(
  armcDegrees: number,
  latitude: number,
  obliquityDegrees: number = 23.439291,
  ayanamsaDegrees: number = 24.1358
): KPCusp[] {
  const result = calculatePlacidusCusps(
    armcDegrees,
    latitude,
    obliquityDegrees,
    ayanamsaDegrees
  );

  const cusps: KPCusp[] = [];
  for (let i = 0; i < 12; i++) {
    const cuspLon = result.siderealCusps[i];
    const nextCuspLon = result.siderealCusps[(i + 1) % 12];
    cusps.push(buildKPCusp(i + 1, cuspLon, nextCuspLon));
  }

  return cusps;
}
