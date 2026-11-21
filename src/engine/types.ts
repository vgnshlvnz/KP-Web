/**
 * Unified domain types for the KP-Web engine (work package `unify-types`, #39).
 *
 * This is the single type module. It is the superset of Stack A's original types and Stack B's
 * `src/types.ts`. Everything here is additive: existing Stack A code compiles unchanged.
 *
 * Owner decisions that are still open are typed as explicit options with NO default. Nothing in
 * this file picks a value for them. Code that needs one must take it as a parameter.
 */

// ---------------------------------------------------------------------------
// Ayanamsa
// ---------------------------------------------------------------------------

/**
 * KP Old or KP New only. There is deliberately no 'lahiri' member and no 'default' member:
 * an unknown value must be rejected, never mapped to a fallback.
 *
 * Wire value is lowercase (`'kp_old' | 'kp_new'`), as sent by the live UI and checked by
 * `core/validation.ts`. Stack B's `'KP_OLD' | 'KP_NEW'` stays local to `src/types.ts` until `entrypoint`.
 * TODO(#29 Q13): owner to confirm the lowercase wire value.
 *
 * TODO(#22): the default mode is an owner decision. This type carries no default; any
 * `= 'kp_old'` parameter default elsewhere in the code is the silent default #22 refers to.
 */
export type AyanamsaMode = 'kp_old' | 'kp_new';

/** Stack A's original name for `AyanamsaMode`. Same type. */
export type AyanamsaType = AyanamsaMode;

/**
 * Lunar node model. Wire values match Stack B.
 * TODO(#29 Q6): mean vs true node default is undecided. Both stacks default to 'MEAN' silently
 * today; this type has no default.
 */
export type NodeMode = 'MEAN' | 'TRUE';

// ---------------------------------------------------------------------------
// Bodies and lords
// ---------------------------------------------------------------------------

/** Sun to Saturn plus the two nodes: the nine KP / Vimshottari bodies. */
export type ClassicalPlanetName =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn'
  | 'Rahu'
  | 'Ketu';

/**
 * Uranus, Neptune and Pluto are not KP significators.
 * TODO(#29 Q12): owner to decide whether they stay in chart output. Typed separately so that
 * callers can opt in or out; `PlanetName` still includes them so Stack B keeps compiling.
 */
export type OuterPlanetName = 'Uranus' | 'Neptune' | 'Pluto';

export type PlanetName = ClassicalPlanetName | OuterPlanetName;

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
 * TODO(#29 Q10): the near-boundary threshold is undecided (Stack B uses 60 arcsec). It is an
 * explicit input to whatever computes `isNearSubBoundary`; there is no default here.
 */
export interface SubBoundaryInfo {
  subSpanStart: number; // degrees in zodiac (0-360)
  subSpanEnd: number; // degrees in zodiac (0-360)
  distanceFromSubStartArcsec: number;
  distanceToSubEndArcsec: number;
  isNearSubBoundary: boolean; // within the caller-supplied threshold
}

/**
 * Stack A's lords record, plus the optional boundary fields. `getPositionLords` fills the boundary
 * fields only when the caller passes the near-boundary threshold (TODO(#29 Q10)). The four lord
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
 * TODO(#29 Q8): `sunriseUtc` is the sunrise that fixed the day lord. How it is defined, and what
 * is reported when the sun does not rise, is undecided; `sunriseStatus` is the explicit flag
 * for that case.
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
 * What to do when Placidus is undefined (|lat| above about 66.56 degrees).
 * TODO(#29 Q7): undecided. Stack A today does 'porphyry_fallback' (matches Swiss Ephemeris) plus a
 * warning; Stack B clamps the latitude silently (#35), which is not an option here.
 */
export type PolarHandling = 'porphyry_fallback' | 'refuse';

/**
 * Sunrise convention for the day lord.
 * TODO(#29 Q8): undecided. 'upper_limb_refraction' is astronomy-engine's and Swiss Ephemeris's
 * default; 'disc_center' is the alternative. The day lord changes at sunrise, not midnight, in
 * either case (CLAUDE.md).
 * Also TODO(#29 Q8), still unanswered: what to report when the sun does not rise or set. No
 * handling option is typed for it; `RulingPlanets.sunriseStatus` can flag the case, and the
 * silent 06:00-local value Stack B uses is excluded (audit).
 */
export type SunriseDefinition = 'upper_limb_refraction' | 'disc_center';

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
 * Explicit engine options. Every field is REQUIRED: no field has a default, because every one of
 * them is an open owner decision. Packages that only need some of them take a `Pick<...>`.
 */
export interface ChartCalculationOptions {
  /** TODO(#22): default KP ayanamsa is the owner's decision. */
  ayanamsa: AyanamsaMode;
  /** TODO(#29 Q6): mean vs true node. */
  nodeMode: NodeMode;
  /** TODO(#23): Rahu/Ketu agent rules. */
  nodeAgentRuleSet: NodeAgentRuleSet;
  /** TODO(#24): ruling-planet membership. */
  rulingPlanetSet: RulingPlanetSet;
  /** TODO(#29 Q9): days per dasha year (365.25, 365.2425, 360, ...). Stack B uses 365.2425. */
  dashaYearDays: number;
  /** TODO(#29 Q7): polar latitudes. */
  polarHandling: PolarHandling;
  /** TODO(#29 Q8): sunrise convention. */
  sunriseDefinition: SunriseDefinition;
  /** TODO(#29 Q10): near-sub-boundary warning threshold in arcseconds (Stack B uses 60). */
  nearBoundaryThresholdArcsec: number;
  /** TODO(#29 Q12): include Uranus, Neptune, Pluto in the chart output. */
  includeOuterPlanets: boolean;
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

  // --- additive fields (unify-types, #39). All optional until `port-chart` fills them in. ---

  /** Node model used for Rahu/Ketu. TODO(#29 Q6): no default. */
  nodeMode?: NodeMode;
  /** Computed planets with tropical/sidereal longitude, speed and lords (Stack B record). */
  planetPositions?: PlanetaryPosition[];
  /** TODO(#24): membership depends on the chosen `RulingPlanetSet`. */
  rulingPlanets?: RulingPlanets;
  /** TODO(#29 Q9): timeline depends on the chosen dasha year length. */
  dashaBalance?: DashaBalance;
  /** Four-level significators with node agents. TODO(#23). */
  nodeAgentSignificators?: FourLevelSignificators;
  /**
   * True when the cusps are Porphyry because Placidus is undefined at this latitude.
   * Must always reach the API response. TODO(#29 Q7).
   */
  isPolarFallback?: boolean;
  /** Polar fallback, near-sub-boundary and no-sunrise warnings. */
  warnings?: ChartWarning[];
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

export interface HoraryCalculationResult extends ChartCalculationResult, HoraryDetails {}
