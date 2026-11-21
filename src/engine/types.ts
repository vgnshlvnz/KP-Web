export type AyanamsaType = 'kp_old' | 'kp_new';

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

export interface KPPositionLords {
  longitude: number;
  signIndex: number;       // 0 = Aries, 11 = Pisces
  signName: string;
  signLord: string;
  degreeInSign: number;
  formatted: string;       // e.g., "03°40'12\" Tau"
  degrees: number;
  minutes: number;
  seconds: number;
  starIndex: number;       // 0 to 26
  starNumber: number;      // 1 to 27
  starName: string;
  starLord: string;
  subLord: string;
  subSubLord: string;
  horary249Number: number; // 1 to 249
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
}
