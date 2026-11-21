export type AyanamsaMode = 'kp_old' | 'kp_new';

export interface PlaceResult {
  id: string;
  name: string;
  admin1?: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  source: 'embedded_geonames' | 'open_meteo' | 'manual';
}

export interface TimezoneOffsetResult {
  timezone: string;
  localDateTimeString: string;
  utcDateTimeString: string;
  utcDate: string;
  offsetMinutes: number;
  offsetSeconds: number;
  offsetString: string;
  isDst: boolean;
  warnings?: string[];
}

export interface RawBirthInput {
  date: string;
  hours: number;
  minutes: number;
  seconds: number;
  placeText: string;
  placeId?: string;
  latitude: number;
  longitude: number;
  timezone: string;
  offsetString: string;
  offsetMinutes: number;
  ayanamsa: AyanamsaMode;
}

export interface ResolvedBirthChartInput {
  id: string;
  createdAt: string;
  rawInput: RawBirthInput;
  resolvedPlace: {
    name: string;
    admin1?: string;
    country: string;
    countryCode: string;
    latitude: number;
    longitude: number;
    timezone: string;
    source: string;
  };
  resolvedTime: {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
    seconds: number;
    utcIsoString: string;
    utcTimestamp: number;
    offsetMinutes: number;
    offsetSeconds: number;
    offsetString: string;
    isDst: boolean;
  };
  ayanamsa: AyanamsaMode;
  readyForCalculation: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  resolvedChartInput?: ResolvedBirthChartInput;
}
