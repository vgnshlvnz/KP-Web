/**
 * Unified domain types for the KP-Web engine (work package `unify-types`, #39).
 *
 * This is the single type module. It is the superset of the original Stack A types and the Stack B
 * `src/types.ts` (deleted in `entrypoint`, #66). Everything here was added without breaking the Stack A code.
 *
 * Owner decisions that are still open are typed as explicit options with NO default. Nothing in
 * this file picks a value for them. Code that needs one must take it as a parameter.
 */

// ---------------------------------------------------------------------------
// Ayanamsa
// ---------------------------------------------------------------------------

/**
 * The supported ayanamsa modes (owner decision on #29, 2026-11-21, answer A): KP Old, KP New,
 * Lahiri, Raman, Fagan-Bradley, Yukteshwar, J.N. Bhasin, Usha-Shashi and Nil (tropical).
 * The SE-defined ones are Swiss Ephemeris `SE_SIDM_*` modes taken by name; see
 * `src/engine/ayanamsa-defs.ts`. `'nil'` is the tropical zodiac: ayanamsa 0 and no nutation term,
 * so sidereal longitude = tropical longitude.
 *
 * Every mode is an explicit choice. There is no 'default' member, and an unknown value must be
 * rejected, never mapped to a fallback.
 *
 * Wire value is the lowercase id below, as sent by the live UI and checked by `core/validation.ts`.
 * Stack B's `'KP_OLD' | 'KP_NEW'` (uppercase) was local to its `src/types.ts` and went away with it.
 * TODO(#29 Q13): owner to confirm the lowercase wire value.
 *
 * TODO(#22): the default mode is an owner decision. This type carries no default; any
 * `= 'kp_old'` parameter default is the silent default #22 refers to; the last one, in
 * `calculateKPChart`, was removed in `final-cleanup` (#69).
 */
export type AyanamsaMode =
  | 'kp_old'
  | 'kp_new'
  | 'lahiri'
  | 'raman'
  | 'fagan_bradley'
  | 'yukteshwar'
  | 'jn_bhasin'
  | 'usha_shashi'
  | 'nil';

/** Stack A's original name for `AyanamsaMode`. Same type. */
export type AyanamsaType = AyanamsaMode;

// ---------------------------------------------------------------------------
// Bodies and lords
// ---------------------------------------------------------------------------

/**
 * Sun to Saturn plus the two nodes (mean node only): the nine KP / Vimshottari bodies.
 * No Uranus, Neptune or Pluto: #29 (owner, 2026-11-21).
 */
export type PlanetName =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn'
  | 'Rahu'
  | 'Ketu';

/** The nine Vimshottari / KP lords. */
export type KPPlanetLord =
  | 'Ketu'
  | 'Venus'
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Rahu'
  | 'Jupiter'
  | 'Saturn'
  | 'Mercury';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Stack B's civil-time input (explicit UTC offset). */
export interface DateTimeInput {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  timezoneOffsetHours: number; // e.g. +5.5 for IST, +8.0 for Malaysia/MYT
}

export interface DateTimeLocation {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  utcOffsetHours?: number; // e.g., +5.5 for IST (India)
  latitude: number;        // in degrees, positive North
  longitude: number;       // in degrees, positive East
}

/**
 * Distance of a longitude from the edges of its KP sub span (Stack B's boundary fields).
 * The near-boundary threshold is the constant `NEAR_BOUNDARY_THRESHOLD_ARCSEC` (60, `conventions.ts`),
 * #29 (owner, 2026-11-21).
 */
export interface SubBoundaryInfo extends Partial<SubSubBoundaryInfo> {
  subSpanStart: number; // degrees in zodiac (0-360)
  subSpanEnd: number; // degrees in zodiac (0-360)
  distanceFromSubStartArcsec: number;
  distanceToSubEndArcsec: number;
  isNearSubBoundary: boolean; // within the threshold
}

/**
 * Distance of a longitude from the edges of its KP sub-sub span (`port-chart`, #54). A sub-sub span
 * is as small as 120 arcsec, so this is the boundary that a few arcseconds of ephemeris error
 * flips first. Optional on `SubBoundaryInfo` so the `KpLords` record (Stack B's shape, which has no
 * such fields) keeps compiling; `getPositionLords(lon, options)` always fills all three.
 * TODO(#29 Q16): whether the near-boundary warning follows the sub edge, the sub-sub edge or
 * either is undecided. `calculateChart` warns when either flag is true.
 */
export interface SubSubBoundaryInfo {
  distanceFromSubSubStartArcsec: number;
  distanceToSubSubEndArcsec: number;
  isNearSubSubBoundary: boolean; // within the threshold
}

/**
 * Stack A's lords record, plus the optional boundary fields. `getPositionLords` fills the boundary
 * fields only when the caller passes a threshold (`calculateChart` passes
 * `NEAR_BOUNDARY_THRESHOLD_ARCSEC`). The four lord
 * fields are `KPPlanetLord` (narrowed by `port-lords`, #43).
 */
export interface KPPositionLords extends Partial<SubBoundaryInfo> {
  longitude: number;
  signIndex: number;       // 0 = Aries, 11 = Pisces
  signName: string;
  signLord: KPPlanetLord;
  degreeInSign: number;
  formatted: string;       // e.g., "03°40'12\" Tau"
  degrees: number;
  minutes: number;
  seconds: number;
  starIndex: number;       // 0 to 26
  starNumber: number;      // 1 to 27
  starName: string;
  starLord: KPPlanetLord;
  subLord: KPPlanetLord;
  subSubLord: KPPlanetLord;
  horary249Number: number; // 1 to 249
}

/** Stack B's lords record: nakshatra naming, boundary fields always present. */
export interface KpLords extends SubBoundaryInfo {
  signIndex: number; // 0-11 (Aries to Pisces)
  signName: string;
  signLord: KPPlanetLord;
  nakshatraIndex: number; // 0-26 (Ashwini to Revati)
  nakshatraName: string;
  nakshatraNumber: number; // 1-27
  starLord: KPPlanetLord;
  subLord: KPPlanetLord;
  subSubLord: KPPlanetLord;
}

export interface KPCusp extends KPPositionLords {
  house: number;           // 1 to 12
  nextCuspLongitude: number;
  houseSpan: number;       // in degrees
}

export interface PlanetInput {
  name: string;
  longitude: number;       // sidereal longitude 0-360
  speed?: number;          // degrees per day (optional)
  latitude?: number;       // ecliptic latitude (optional)
}

export interface PlanetHouseAssignment extends KPPositionLords {
  name: string;
  house: number;           // 1 to 12
  distancePassedCusp: number; // degrees passed cusp
  distanceToNextCusp: number; // degrees until next cusp
  isRetrograde?: boolean;
}

export interface HouseSignificator {
  house: number;
  level1: string[]; // Planets in the star of occupants
  level2: string[]; // Occupants of the house
  level3: string[]; // Planets in the star of cusp sign lord
  level4: string[]; // Cusp sign lord
  allSignificators: string[]; // Combined unique significators
}

export interface PlanetSignificator {
  planet: string;
  signifiesHouses: {
    level1: number[];
    level2: number[];
    level3: number[];
    level4: number[];
    all: number[];
  };
}

export interface SignificatorsResult {
  houseWise: HouseSignificator[];
  planetWise: PlanetSignificator[];
}

export interface SouthIndianBox {
  signIndex: number;
  signName: string;
  signLord: string;
  cusps: Array<{ house: number; formatted: string; longitude: number }>;
  planets: Array<{ name: string; formatted: string; longitude: number; house: number }>;
}

export interface NorthIndianHouse {
  house: number;
  signIndex: number;
  signName: string;
  signLord: string;
  cuspLongitude: number;
  cuspFormatted: string;
  planets: Array<{ name: string; formatted: string; longitude: number }>;
}

export interface ChartWheels {
  southIndian: SouthIndianBox[];
  northIndian: NorthIndianHouse[];
}

// ---------------------------------------------------------------------------
// Stack B record types (planets, cusps, horary table, significators, ruling planets, dasha)
// ---------------------------------------------------------------------------

/** Planet with tropical and sidereal longitude, motion, lords and Placidus house. */
export interface PlanetaryPosition extends KpLords {
  name: PlanetName;
  tropicalLongitude: number; // degrees 0-360
  siderealLongitude: number; // degrees 0-360
  latitude: number; // degrees
  distanceAu: number;
  speedLongitudeDegPerDay: number;
  isRetrograde: boolean;
  house: number; // 1-12 (Placidus cuspal house)
}

/** Placidus cusp (or Porphyry cusp when `ChartWarning` code is 'polar_fallback') with lords. */
export interface HouseCusp extends KpLords {
  houseNumber: number; // 1-12
  siderealLongitude: number; // degrees 0-360
  tropicalLongitude: number; // degrees 0-360
}

export interface HoraryTableEntry {
  horaryNumber: number; // 1-249
  signName: string;
  signLord: KPPlanetLord;
  nakshatraNumber: number; // 1-27
  nakshatraName: string;
  starLord: KPPlanetLord;
  subLord: KPPlanetLord;
  startLongitude: number; // degrees 0-360
  endLongitude: number; // degrees 0-360
  startDms: string; // e.g. "00°00'00\""
  endDms: string;
}

/**
 * Four-level significators, Stack B layout.
 * TODO(#23): `agentsFor` and `rahuKetuRules` hold the Rahu/Ketu agent rule set, which is an owner
 * decision. The four house levels do not depend on it (identical in Stack A and Stack B).
 */
export interface FourLevelSignificators {
  houseWise: Record<
    number,
    {
      level1: PlanetName[]; // Planets in star of occupants
      level2: PlanetName[]; // Occupants
      level3: PlanetName[]; // Planets in star of cusp lord
      level4: PlanetName[]; // Cusp lord
    }
  >;
  planetWise: Record<
    PlanetName,
    {
      level1Houses: number[];
      level2Houses: number[];
      level3Houses: number[];
      level4Houses: number[];
      agentsFor: PlanetName[]; // for Rahu/Ketu: planets they represent
    }
  >;
  rahuKetuRules: string;
}

/**
 * Ruling planets.
 * TODO(#24): membership (which entries, duplicates, nodes) is an owner decision; see
 * `RulingPlanetSet`. `rulingPlanetsList` is whatever the chosen set produces.
 * `sunriseUtc` is the sunrise that fixed the day lord: upper limb, standard refraction
 * (`SUNRISE_DEFINITION`, #29 (owner, 2026-11-21)). When the sun does not rise, `sunriseStatus` is
 * the explicit flag for that case and stays as it is.
 */
export interface RulingPlanets {
  ascendantSignLord: KPPlanetLord;
  ascendantStarLord: KPPlanetLord;
  moonSignLord: KPPlanetLord;
  moonStarLord: KPPlanetLord;
  dayLord: KPPlanetLord;
  sunriseUtc: string;
  sunriseStatus?: 'ok' | 'no_sunrise_polar_night' | 'no_sunrise_polar_day';
  rulingPlanetsList: KPPlanetLord[];
}

/**
 * Ruling planets when there is no sunrise at the place (polar night or polar day), as returned by
 * `calculateChart`. There is no day lord, so `dayLord` and `sunriseUtc` are `null` and
 * `rulingPlanetsList` holds only the ascendant and Moon entries.
 * TODO(#29 Q8): how a chart reports this case, beyond this flag and a `no_sunrise` warning, is
 * undecided. Structurally identical to `RulingPlanetsNoSunrise` in `ruling-planets.ts`.
 */
export interface RulingPlanetsWithoutSunrise
  extends Omit<RulingPlanets, 'dayLord' | 'sunriseUtc' | 'sunriseStatus'> {
  dayLord: null;
  sunriseUtc: null;
  sunriseStatus: 'no_sunrise_polar_night' | 'no_sunrise_polar_day';
}

export interface DashaPeriod {
  lord: KPPlanetLord;
  level: 'dasha' | 'bhukti' | 'antara';
  startDate: string;
  endDate: string;
  durationDays: number;
  subPeriods?: DashaPeriod[];
}

export interface DashaBalance {
  birthStar: string;
  dashaLord: KPPlanetLord;
  balanceYears: number;
  balanceMonths: number;
  balanceDays: number;
  dashaTimeline: DashaPeriod[];
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export type ChartWarningCode =
  | 'polar_fallback' // Placidus undefined at this latitude; cusps are Porphyry
  | 'near_sub_boundary' // a body or cusp is within the near-boundary threshold of a sub edge
  | 'no_sunrise'; // no sunrise found for the day lord

export interface ChartWarning {
  code: ChartWarningCode;
  message: string;
  /** What the warning is about, e.g. 'cusp 3', 'Moon'. */
  subject?: string;
}

// ---------------------------------------------------------------------------
// Owner-decision options: typed, no defaults
// ---------------------------------------------------------------------------

/**
 * Rahu/Ketu agent rule set.
 * TODO(#23): undecided. 'none' is Stack A (no agent rules). 'sign_lord_star_lord_same_sign' is
 * Stack B's `agentsFor` (sign lord, star lord, planets in the same sign; its doc string also
 * claims aspects, which are not implemented).
 */
export type NodeAgentRuleSet = 'none' | 'sign_lord_star_lord_same_sign';

/**
 * Ruling-planet membership.
 * TODO(#24): undecided. 'asc_star_sign_moon_star_sign_day_lord' is Stack B's fixed 5-entry list
 * (duplicates kept, no nodes). Further named sets are added only when the owner decides.
 */
export type RulingPlanetSet = 'asc_star_sign_moon_star_sign_day_lord';

/**
 * Explicit engine options: the three decisions that are still open. Every field is REQUIRED and has
 * no default. Everything else is a fixed convention in `conventions.ts` (#29 (owner, 2026-11-21)).
 */
export interface ChartCalculationOptions {
  /** TODO(#22): default KP ayanamsa is the owner's decision. */
  ayanamsa: AyanamsaMode;
  /** TODO(#23): Rahu/Ketu agent rules. */
  nodeAgentRuleSet: NodeAgentRuleSet;
  /** TODO(#24): ruling-planet membership. */
  rulingPlanetSet: RulingPlanetSet;
}

// ---------------------------------------------------------------------------
// Chart results
// ---------------------------------------------------------------------------

export interface ChartCalculationResult {
  input: DateTimeLocation;
  ayanamsaType: AyanamsaType;
  ayanamsaName: string;
  ayanamsaValue: number;         // in degrees
  julianDateUT: number;
  greenwichMeanSiderealTime: number; // hours
  greenwichApparentSiderealTime: number; // hours
  localSiderealTimeHours: number;    // hours
  localSiderealTimeDegrees: number;  // degrees
  armc: number;                  // degrees (0-360)
  obliquityMean: number;         // degrees
  obliquityTrue: number;         // degrees
  nutationInLongitude: number;   // degrees
  nutationInObliquity: number;   // degrees
  ascendant: number;             // degrees (sidereal)
  midheaven: number;             // degrees (sidereal)
  cusps: KPCusp[];
  planets?: PlanetHouseAssignment[];
  significators?: SignificatorsResult;
  chartWheels?: ChartWheels;

  // --- additive fields (unify-types, #39). Optional here because the legacy `calculateKPChart`
  // does not fill them; `calculateChart` always does (`FullChartCalculationResult`). ---

  /** Computed planets with tropical/sidereal longitude, speed and lords (Stack B record). */
  planetPositions?: PlanetaryPosition[];
  /**
   * TODO(#24): membership depends on the chosen `RulingPlanetSet`.
   * The second member is the no-sunrise variant (TODO(#29 Q8)).
   */
  rulingPlanets?: RulingPlanets | RulingPlanetsWithoutSunrise;
  /** Timeline uses `DASHA_YEAR_DAYS` (365.2425). */
  dashaBalance?: DashaBalance;
  /** Four-level significators with node agents. TODO(#23). */
  nodeAgentSignificators?: FourLevelSignificators;
  /**
   * True when the cusps are Porphyry because Placidus is undefined at this latitude.
   * Must always reach the API response (#29 (owner, 2026-11-21)).
   */
  isPolarFallback?: boolean;
  /** Polar fallback, near-sub-boundary and no-sunrise warnings. */
  warnings?: ChartWarning[];
}

/**
 * What `calculateChart` returns: a `ChartCalculationResult` in which every additive field is
 * present. Assignable to `ChartCalculationResult`.
 */
export interface FullChartCalculationResult extends ChartCalculationResult {
  planets: PlanetHouseAssignment[];
  planetPositions: PlanetaryPosition[];
  significators: SignificatorsResult;
  chartWheels: ChartWheels;
  rulingPlanets: RulingPlanets | RulingPlanetsWithoutSunrise;
  dashaBalance: DashaBalance;
  nodeAgentSignificators: FourLevelSignificators;
  isPolarFallback: boolean;
  warnings: ChartWarning[];
}

/** Horary-specific fields. Asc is the START of the chosen sub unless `useSubMidpoint` is true. */
export interface HoraryDetails {
  horaryNumber: number; // 1-249
  horarySubStartDeg: number;
  horarySubEndDeg: number;
  lagnaTargetDeg: number;
  /** Explicit toggle. false means lagna = sub start (CLAUDE.md); midpoint only when true. */
  useSubMidpoint: boolean;
  invertedRamcDeg: number;
}

/**
 * A horary chart: every additive chart field is present (as in `FullChartCalculationResult`),
 * plus the horary fields. Assignable to `ChartCalculationResult`.
 */
export interface HoraryCalculationResult extends FullChartCalculationResult, HoraryDetails {}
