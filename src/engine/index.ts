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
  normalizeDegrees,
  cosd,
  SiderealTimeResult,
} from './astronomy.js';
import { calculatePlacidusCusps, PolarLatitudeError } from './placidus.js';
import { NEAR_BOUNDARY_THRESHOLD_ARCSEC } from './conventions.js';
import { buildKPCusp } from './kp-lords.js';
import { assignPlanetsToHouses } from './house-assignment.js';
import { calculateSignificators, calculateFourLevelSignificators } from './significators.js';
import { buildChartWheels } from './chart-wheels.js';
import { calculateEphemeris } from './ephemeris.js';
import { calculateVimshottariDasha } from './dasha.js';
import { calculateRulingPlanets } from './ruling-planets.js';

export * from './types.js';
export * from './conventions.js';
export * from './astronomy.js';
export * from './placidus.js';
export * from './house-assignment.js';
export * from './kp-lords.js';
export * from './significators.js';
export * from './chart-wheels.js';
export * from './ephemeris.js';
export * from './dasha.js';
export * from './ruling-planets.js';
export * from './horary.js';

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
  ayanamsaType: AyanamsaType,
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
  // Polar latitudes: Porphyry cusps plus a visible warning (#29 (owner, 2026-11-21)).
  const warnings: ChartWarning[] = [...placidusResult.chartWarnings];

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
    isPolarFallback: placidusResult.isPolarFallback,
    warnings,
  };
}

/**
 * Computes Placidus house cusps directly from ARMC (Right Ascension of Midheaven / Sidereal Time),
 * geographic latitude, obliquity, and ayanamsa.
 * Useful for Horary (Prashna) where Ascendant is fixed at sub start and ARMC is inverted.
 *
 * Throws `PolarLatitudeError` where Placidus is undefined: this returns bare cusps and cannot carry
 * the `polar_fallback` warning, so it never substitutes Porphyry silently.
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
  if (result.isPolarFallback) {
    throw new PolarLatitudeError(
      `Placidus houses cannot be computed at latitude ${latitude}: ${result.warnings?.join(' ') ?? ''}`,
      latitude,
      obliquityDegrees
    );
  }

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

function assertFiniteNumber(name: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number, got ${String(value)}`);
  }
}

/**
 * The three options (ayanamsa, node-agent rule set, ruling-planet set) have no default (#22 decided: no API default):
 * a missing one is an error, not a silent fallback. Values are validated again by the module that
 * consumes them, which throws on an unknown value.
 */
function assertChartOptions(options: ChartCalculationOptions): void {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('calculateChart requires an options object; every option is required');
  }
  const required: Array<keyof ChartCalculationOptions> = [
    'ayanamsa', // #22 decided: no API default
    'nodeAgentRuleSet', // TODO(#23)
    'rulingPlanetSet', // TODO(#24)
  ];
  const missing = required.filter((k) => options[k] === undefined || options[k] === null);
  if (missing.length > 0) {
    throw new TypeError(`calculateChart: missing required option(s): ${missing.join(', ')}`);
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
 * The one chart function. The conventions in `conventions.ts` are fixed (#29 (owner, 2026-11-21));
 * only three options remain, each required with no default: `ayanamsa` (#22 decided: no API
 * default; KP New is the UI's default selection), `nodeAgentRuleSet` (TODO(#23)) and
 * `rulingPlanetSet` (TODO(#24)).
 *
 * - Planets (Sun to Saturn, mean Rahu and Ketu) come from `calculateEphemeris` (astronomy-engine).
 * - Placidus cusps use the same true ayanamsa and nutation as the planets. At polar latitudes the
 *   cusps are Porphyry, `isPolarFallback` is true and a `polar_fallback` warning is returned.
 * - Sign, star, sub and sub-sub lords come from `getPositionLords` with
 *   `NEAR_BOUNDARY_THRESHOLD_ARCSEC`. A planet's house is the house of the cusp it has passed.
 * - The four house levels are Stack A's (`significators`); `nodeAgentSignificators` adds the Rahu and
 *   Ketu agents under `options.nodeAgentRuleSet` (TODO(#23)).
 * - Dasha uses `DASHA_YEAR_DAYS`; ruling planets use the day lord at the most recent sunrise
 *   (upper limb, standard refraction; TODO(#24) for the set).
 * - `warnings` carries `polar_fallback` (never dropped), `near_sub_boundary` and `no_sunrise`.
 *
 * `input.utcOffsetHours` is required here (unlike `calculateKPChart`, which treats it as 0).
 * The legacy `calculateKPChart` is still used by the `/api/chart/*` routes in `src/index.ts`. Its only change
 * is at polar latitudes, where it now returns Porphyry cusps plus a `polar_fallback` warning instead of
 * throwing. Its `ayanamsaType` argument is required: there is no default (#22 decided).
 */
export function calculateChart(
  input: DateTimeLocation,
  options: ChartCalculationOptions
): FullChartCalculationResult {
  return calculateChartWithArmc(input, options);
}

/**
 * Sidereal time fields for a given ARMC (used when the ARMC is derived, not read from the clock):
 * GAST = ARMC - longitude, GMST = GAST - equation of the equinoxes.
 */
function siderealTimeForArmc(
  armc: number,
  longitudeDeg: number,
  dPsiDeg: number,
  trueObliquityDeg: number
): SiderealTimeResult {
  assertFiniteNumber('ARMC', armc);
  const armcNorm = normalizeDegrees(armc);
  const eqEquinoxesDeg = dPsiDeg * cosd(trueObliquityDeg);
  const gastDegrees = normalizeDegrees(armcNorm - longitudeDeg);
  const gmstDegrees = normalizeDegrees(gastDegrees - eqEquinoxesDeg);
  return {
    gmstHours: gmstDegrees / 15.0,
    gmstDegrees,
    gastHours: gastDegrees / 15.0,
    gastDegrees,
    lstHours: armcNorm / 15.0,
    lstDegrees: armcNorm,
    armc: armcNorm,
  };
}

/**
 * What `calculateChartWithArmc` tells its ARMC resolver: the sidereal time of the clock instant
 * and the true ayanamsa and obliquity that the cusps will use.
 */
export interface ArmcContext {
  /** ARMC of the input instant and place (what `calculateChart` uses), degrees. */
  clockArmc: number;
  /** Mean ayanamsa + dPsi, degrees: the value subtracted from tropical longitudes. */
  trueAyanamsaDeg: number;
  /** True obliquity of date, degrees. */
  trueObliquityDeg: number;
}

/**
 * Internal "chart from ARMC" helper shared by `calculateChart` and `calculateHoraryChart`.
 * Not part of the public API surface that `src/index.ts` should use; prefer the two callers.
 *
 * It does everything `calculateChart` documents. The only difference is where the ARMC comes
 * from. Without `resolveArmc` the ARMC is the sidereal time at `input` (a natal or event chart).
 * With it, the planets, dasha and ruling planets are still computed for the instant `input`, but
 * the houses are built from the ARMC the resolver returns (a KP horary chart, where the Ascendant
 * is fixed by the querent's number and the ARMC is derived from it). In that case the sidereal
 * time fields of the result (`armc`, `localSiderealTime*`, `greenwichApparentSiderealTime`,
 * `greenwichMeanSiderealTime`) describe the ARMC the houses were built from, so that they agree
 * with the cusps; the planets stay at the question instant.
 */
export function calculateChartWithArmc(
  input: DateTimeLocation,
  options: ChartCalculationOptions,
  resolveArmc?: (context: ArmcContext) => number
): FullChartCalculationResult {
  assertChartOptions(options);
  const birthUtc = chartInstantUtc(input);
  const coordinates = { latitude: input.latitude, longitude: input.longitude };
  const threshold = { nearBoundaryThresholdArcsec: NEAR_BOUNDARY_THRESHOLD_ARCSEC };

  // Planets, with the ayanamsa and the nutation that go with them.
  const ephemeris = calculateEphemeris(birthUtc, {
    ayanamsa: options.ayanamsa,
  });
  const jdUT = ephemeris.julianDayUt;

  // Sidereal time and cusps, from the same nutation as the planets.
  const nutInLon = ephemeris.nutationInLongitudeDeg;
  const nutInObl = ephemeris.nutationInObliquityDeg;
  const obl = calculateObliquity(jdUT, nutInObl);
  const clockSt = calculateSiderealTime(jdUT, input.longitude, nutInLon, obl.trueObliquity);
  const aya = calculateAyanamsa(jdUT, options.ayanamsa, nutInLon);
  const st = resolveArmc
    ? siderealTimeForArmc(
        resolveArmc({
          clockArmc: clockSt.armc,
          trueAyanamsaDeg: ephemeris.trueAyanamsaDeg,
          trueObliquityDeg: obl.trueObliquity,
        }),
        input.longitude,
        nutInLon,
        obl.trueObliquity
      )
    : clockSt;

  const placidus = calculatePlacidusCusps(
    st.armc,
    input.latitude,
    obl.trueObliquity,
    ephemeris.trueAyanamsaDeg
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

  // Significators: the nine KP bodies.
  const significators = calculateSignificators(cusps, planets);
  const nodeAgentSignificators = calculateFourLevelSignificators(
    cusps,
    planets,
    options.nodeAgentRuleSet
  );
  const chartWheels = buildChartWheels(cusps, planets);

  // Dasha from the Moon, ruling planets from the ascendant and the Moon.
  const moon = planets.find((p) => p.name === 'Moon');
  if (!moon) {
    throw new Error('Ephemeris returned no Moon'); // cannot happen: the Moon is always computed
  }
  const dashaBalance = calculateVimshottariDasha(moon.longitude, birthUtc);
  const rulingPlanets = calculateRulingPlanets(cusps[0], moon, birthUtc, coordinates, {
    rulingPlanetSet: options.rulingPlanetSet,
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
    // TODO(#29 Q16): which flag the UI shows is open. The warning is raised when EITHER is true.
    if (p.isNearSubBoundary || p.isNearSubSubBoundary) {
      const which = [
        p.isNearSubBoundary ? 'sub' : null,
        p.isNearSubSubBoundary ? 'sub-sub' : null,
      ].filter((x) => x !== null).join(' and ');
      warnings.push({
        code: 'near_sub_boundary',
        subject,
        message:
          `${subject} (${lon.toFixed(6)} deg) is within ${NEAR_BOUNDARY_THRESHOLD_ARCSEC} arcsec ` +
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
    planetPositions,
    rulingPlanets,
    dashaBalance,
    nodeAgentSignificators,
    isPolarFallback: placidus.isPolarFallback,
    warnings,
  };
}
