import {
  DateTimeLocation,
  AyanamsaType,
  PlanetInput,
  ChartCalculationOptions,
  ChartCalculationResult,
  ChartWarning,
  FullChartCalculationResult,
  KPCusp,
  PlanetaryPosition,
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
import { calculateSignificators, calculateFourLevelSignificators } from './significators.js';
import { buildChartWheels } from './chart-wheels.js';
import { calculateEphemeris } from './ephemeris.js';
import { calculateVimshottariDasha } from './dasha.js';
import { calculateRulingPlanets } from './ruling-planets.js';

export * from './types.js';
export * from './astronomy.js';
export * from './placidus.js';
export * from './house-assignment.js';
export * from './kp-lords.js';
export * from './significators.js';
export * from './chart-wheels.js';
export * from './ephemeris.js';
export * from './dasha.js';
export * from './ruling-planets.js';

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

// ---------------------------------------------------------------------------
// calculateChart: the unified chart function (work package `port-chart`, #54)
// ---------------------------------------------------------------------------

/** Not KP significators. TODO(#29 Q12): whether they appear in chart output at all is undecided. */
const OUTER_PLANETS: ReadonlySet<string> = new Set(['Uranus', 'Neptune', 'Pluto']);

function assertFiniteNumber(name: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number, got ${String(value)}`);
  }
}

/**
 * Every option is an open owner decision, so none has a default: a missing one is an error, not
 * a silent fallback. Values are validated again by the module that consumes them (ayanamsa,
 * node mode, node-agent rule set, ruling-planet set, dasha year, sunrise definition and the
 * boundary threshold all throw on an unknown value); the checks here cover what no other module
 * would catch, such as `polarHandling` at a non-polar latitude.
 */
function assertChartOptions(options: ChartCalculationOptions): void {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('calculateChart requires an options object; every option is required');
  }
  const required: Array<keyof ChartCalculationOptions> = [
    'ayanamsa', // TODO(#22)
    'nodeMode', // TODO(#29 Q6)
    'nodeAgentRuleSet', // TODO(#23)
    'rulingPlanetSet', // TODO(#24)
    'dashaYearDays', // TODO(#29 Q9)
    'polarHandling', // TODO(#29 Q7)
    'sunriseDefinition', // TODO(#29 Q8)
    'nearBoundaryThresholdArcsec', // TODO(#29 Q10)
    'includeOuterPlanets', // TODO(#29 Q12)
  ];
  const missing = required.filter((k) => options[k] === undefined || options[k] === null);
  if (missing.length > 0) {
    throw new TypeError(`calculateChart: missing required option(s): ${missing.join(', ')}`);
  }
  if (options.polarHandling !== 'porphyry_fallback' && options.polarHandling !== 'refuse') {
    throw new RangeError(`Unknown polarHandling: ${String(options.polarHandling)}`);
  }
  if (typeof options.includeOuterPlanets !== 'boolean') {
    throw new TypeError('includeOuterPlanets must be a boolean');
  }
}

/**
 * The UTC instant of the chart. The civil UTC offset is required: silently treating a missing
 * offset as UTC would put the chart hours away from the real moment.
 */
function chartInstantUtc(input: DateTimeLocation): Date {
  const { year, month, day, hour, minute, second, utcOffsetHours, latitude, longitude } = input;
  assertFiniteNumber('year', year);
  assertFiniteNumber('month', month);
  assertFiniteNumber('day', day);
  assertFiniteNumber('hour', hour);
  assertFiniteNumber('minute', minute);
  assertFiniteNumber('second', second);
  assertFiniteNumber('latitude', latitude);
  assertFiniteNumber('longitude', longitude);
  if (utcOffsetHours === undefined) {
    throw new RangeError('utcOffsetHours is required: a missing offset is not treated as UTC');
  }
  assertFiniteNumber('utcOffsetHours', utcOffsetHours);
  if (latitude < -90 || latitude > 90) {
    throw new RangeError(`latitude must be between -90 and 90, got ${latitude}`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new RangeError(`longitude must be between -180 and 180, got ${longitude}`);
  }

  // The calendar date must exist (no Feb 30), and the clock time must be a real one.
  const dayStart = new Date(0);
  dayStart.setUTCFullYear(year, month - 1, day);
  dayStart.setUTCHours(0, 0, 0, 0);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    dayStart.getUTCFullYear() !== year ||
    dayStart.getUTCMonth() !== month - 1 ||
    dayStart.getUTCDate() !== day
  ) {
    throw new RangeError(`Not a calendar date: ${year}-${month}-${day}`);
  }
  if (hour < 0 || hour >= 24 || minute < 0 || minute >= 60 || second < 0 || second >= 60) {
    throw new RangeError(`Not a clock time: ${hour}:${minute}:${second}`);
  }

  const localMs = ((hour * 60 + minute) * 60 + second) * 1000;
  return new Date(Math.round(dayStart.getTime() + localMs - utcOffsetHours * 3_600_000));
}

/**
 * The one chart function. Every owner decision is an explicit, required option with no default.
 *
 * - Planets come from `calculateEphemeris` (astronomy-engine), in the chosen ayanamsa and node mode
 *   (TODO(#22), TODO(#29 Q6), TODO(#29 Q12)).
 * - Placidus cusps use the same true ayanamsa and nutation as the planets. At polar latitudes
 *   `options.polarHandling` decides between Porphyry plus a warning and an error (TODO(#29 Q7)).
 * - Sign, star, sub and sub-sub lords come from `getPositionLords` with the near-boundary threshold
 *   (TODO(#29 Q10)). A planet's house is the house of the cusp it has passed.
 * - The four house levels are Stack A's (`significators`); `nodeAgentSignificators` adds the Rahu and
 *   Ketu agents under `options.nodeAgentRuleSet` (TODO(#23)). Uranus, Neptune and Pluto, when
 *   included, are listed with the planets and drawn on the wheels but are NOT significators
 *   (TODO(#29 Q12)).
 * - Dasha uses `options.dashaYearDays` (TODO(#29 Q9), Q17); ruling planets use the day lord at the
 *   most recent sunrise (TODO(#24), TODO(#29 Q8)).
 * - `warnings` carries `polar_fallback` (never dropped), `near_sub_boundary` and `no_sunrise`.
 *
 * `input.utcOffsetHours` is required here (unlike `calculateKPChart`, which treats it as 0).
 * The legacy `calculateKPChart` is unchanged and still used by `src/index.ts` until `entrypoint`.
 */
export function calculateChart(
  input: DateTimeLocation,
  options: ChartCalculationOptions
): FullChartCalculationResult {
  assertChartOptions(options);
  const birthUtc = chartInstantUtc(input);
  const coordinates = { latitude: input.latitude, longitude: input.longitude };
  const threshold = { nearBoundaryThresholdArcsec: options.nearBoundaryThresholdArcsec };

  // Planets, with the ayanamsa and the nutation that go with them.
  const ephemeris = calculateEphemeris(birthUtc, {
    ayanamsa: options.ayanamsa,
    nodeMode: options.nodeMode,
    includeOuterPlanets: options.includeOuterPlanets,
  });
  const jdUT = ephemeris.julianDayUt;

  // Sidereal time and cusps, from the same nutation as the planets.
  const nutInLon = ephemeris.nutationInLongitudeDeg;
  const nutInObl = ephemeris.nutationInObliquityDeg;
  const obl = calculateObliquity(jdUT, nutInObl);
  const st = calculateSiderealTime(jdUT, input.longitude, nutInLon, obl.trueObliquity);
  const aya = calculateAyanamsa(jdUT, options.ayanamsa, nutInLon);

  const placidus = calculatePlacidusCusps(
    st.armc,
    input.latitude,
    obl.trueObliquity,
    ephemeris.trueAyanamsaDeg,
    options.polarHandling
  );

  const cusps: KPCusp[] = [];
  for (let i = 0; i < 12; i++) {
    const nextCuspLon = placidus.siderealCusps[(i + 1) % 12];
    cusps.push(buildKPCusp(i + 1, placidus.siderealCusps[i], nextCuspLon, threshold));
  }
  const cuspLongitudes = cusps.map((c) => c.longitude);

  // Planets: house from the cusps, lords from the longitude.
  const planetInputs: PlanetInput[] = ephemeris.planets.map((p) => ({
    name: p.name,
    longitude: p.siderealLongitude,
    speed: p.speedLongitudeDegPerDay,
    latitude: p.latitude,
  }));
  const planets = assignPlanetsToHouses(planetInputs, cuspLongitudes, threshold);

  const planetPositions: PlanetaryPosition[] = planets.map((a, i) => {
    const e = ephemeris.planets[i];
    return {
      name: e.name,
      tropicalLongitude: e.tropicalLongitude,
      siderealLongitude: a.longitude,
      latitude: e.latitude,
      distanceAu: e.distanceAu,
      speedLongitudeDegPerDay: e.speedLongitudeDegPerDay,
      isRetrograde: e.isRetrograde,
      house: a.house,
      signIndex: a.signIndex,
      signName: a.signName,
      signLord: a.signLord,
      nakshatraIndex: a.starIndex,
      nakshatraName: a.starName,
      nakshatraNumber: a.starNumber,
      starLord: a.starLord,
      subLord: a.subLord,
      subSubLord: a.subSubLord,
      subSpanStart: a.subSpanStart,
      subSpanEnd: a.subSpanEnd,
      distanceFromSubStartArcsec: a.distanceFromSubStartArcsec,
      distanceToSubEndArcsec: a.distanceToSubEndArcsec,
      isNearSubBoundary: a.isNearSubBoundary,
      distanceFromSubSubStartArcsec: a.distanceFromSubSubStartArcsec,
      distanceToSubSubEndArcsec: a.distanceToSubSubEndArcsec,
      isNearSubSubBoundary: a.isNearSubSubBoundary,
    };
  });

  // Significators: the nine KP bodies only (TODO(#29 Q12)).
  const classical = planets.filter((p) => !OUTER_PLANETS.has(p.name));
  const significators = calculateSignificators(cusps, classical);
  const nodeAgentSignificators = calculateFourLevelSignificators(
    cusps,
    classical,
    options.nodeAgentRuleSet
  );
  const chartWheels = buildChartWheels(cusps, planets);

  // Dasha from the Moon, ruling planets from the ascendant and the Moon.
  const moon = planets.find((p) => p.name === 'Moon');
  if (!moon) {
    throw new Error('Ephemeris returned no Moon'); // cannot happen: the Moon is always computed
  }
  const dashaBalance = calculateVimshottariDasha(moon.longitude, birthUtc, {
    dashaYearDays: options.dashaYearDays,
  });
  const rulingPlanets = calculateRulingPlanets(cusps[0], moon, birthUtc, coordinates, {
    rulingPlanetSet: options.rulingPlanetSet,
    sunriseDefinition: options.sunriseDefinition,
  });

  // Warnings. The polar fallback is never dropped.
  const warnings: ChartWarning[] = [...placidus.chartWarnings];
  const nearEdge = (
    subject: string,
    lon: number,
    p: {
      isNearSubBoundary?: boolean;
      isNearSubSubBoundary?: boolean;
    }
  ): void => {
    // TODO(#29 Q16): the owner has not said whether the warning is about the sub edge, the
    // sub-sub edge or both. It is raised when EITHER flag is true.
    if (p.isNearSubBoundary || p.isNearSubSubBoundary) {
      const which = [
        p.isNearSubBoundary ? 'sub' : null,
        p.isNearSubSubBoundary ? 'sub-sub' : null,
      ].filter((x) => x !== null).join(' and ');
      warnings.push({
        code: 'near_sub_boundary',
        subject,
        message:
          `${subject} (${lon.toFixed(6)} deg) is within ${options.nearBoundaryThresholdArcsec} arcsec ` +
          `of a ${which} boundary; a small error in the position could change the ${which} lord.`,
      });
    }
  };
  for (const c of cusps) nearEdge(`cusp ${c.house}`, c.longitude, c);
  for (const p of planets) nearEdge(p.name, p.longitude, p);
  if (rulingPlanets.dayLord === null) {
    warnings.push({
      code: 'no_sunrise',
      subject: 'day lord',
      message:
        `No sunrise in the 48 hours before the chart moment (${rulingPlanets.sunriseStatus}); ` +
        'there is no day lord and the ruling planets list has only the ascendant and Moon entries.',
    });
  }

  return {
    input,
    ayanamsaType: options.ayanamsa,
    ayanamsaName: aya.name,
    ayanamsaValue: ephemeris.trueAyanamsaDeg,
    julianDateUT: jdUT,
    greenwichMeanSiderealTime: st.gmstHours,
    greenwichApparentSiderealTime: st.gastHours,
    localSiderealTimeHours: st.lstHours,
    localSiderealTimeDegrees: st.lstDegrees,
    armc: st.armc,
    obliquityMean: obl.meanObliquity,
    obliquityTrue: obl.trueObliquity,
    nutationInLongitude: nutInLon,
    nutationInObliquity: nutInObl,
    ascendant: placidus.ascendantSidereal,
    midheaven: placidus.midheavenSidereal,
    cusps,
    planets,
    significators,
    chartWheels,
    nodeMode: options.nodeMode,
    planetPositions,
    rulingPlanets,
    dashaBalance,
    nodeAgentSignificators,
    isPolarFallback: placidus.isPolarFallback,
    warnings,
  };
}
