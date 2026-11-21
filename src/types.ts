/**
 * Core type definitions for KP-Web astrology engine.
 */

export type AyanamsaMode = 'KP_OLD' | 'KP_NEW';

export type NodeMode = 'MEAN' | 'TRUE';

export type PlanetName =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn'
  | 'Rahu'
  | 'Ketu'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto';

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

export interface DateTimeInput {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  timezoneOffsetHours: number; // e.g. +5.5 for IST, +8.0 for Malaysia/MYT
}

export interface KpLords {
  signIndex: number; // 0-11 (Aries to Pisces)
  signName: string;
  signLord: KPPlanetLord;
  nakshatraIndex: number; // 0-26 (Ashwini to Revati)
  nakshatraName: string;
  nakshatraNumber: number; // 1-27
  starLord: KPPlanetLord;
  subLord: KPPlanetLord;
  subSubLord: KPPlanetLord;
  subSpanStart: number; // degrees in zodiac (0-360)
  subSpanEnd: number; // degrees in zodiac (0-360)
  distanceFromSubStartArcsec: number;
  distanceToSubEndArcsec: number;
  isNearSubBoundary: boolean; // within boundary threshold
}

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

export interface RulingPlanets {
  ascendantSignLord: KPPlanetLord;
  ascendantStarLord: KPPlanetLord;
  moonSignLord: KPPlanetLord;
  moonStarLord: KPPlanetLord;
  dayLord: KPPlanetLord;
  sunriseUtc: string;
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

export interface ChartCalculationResult {
  engine: string;
  ayanamsaMode: AyanamsaMode;
  ayanamsaValueDeg: number;
  ayanamsaDms: string;
  julianDayUt: number;
  localSiderealTimeDeg: number;
  ramcDeg: number;
  obliquityDeg: number;
  planets: PlanetaryPosition[];
  houses: HouseCusp[];
  ascendant: HouseCusp;
  mc: HouseCusp;
  significators: FourLevelSignificators;
  rulingPlanets: RulingPlanets;
  dashaBalance: {
    birthStar: string;
    dashaLord: KPPlanetLord;
    balanceYears: number;
    balanceMonths: number;
    balanceDays: number;
    dashaTimeline: DashaPeriod[];
  };
  warnings: string[];
}

export interface HoraryCalculationResult extends ChartCalculationResult {
  horaryNumber: number; // 1-249
  horarySubStartDeg: number;
  horarySubEndDeg: number;
  lagnaTargetDeg: number;
  useSubMidpoint: boolean;
  invertedRamcDeg: number;
}
