/**
 * KP ruling planets and the day lord.
 *
 * Ported from Stack B (`src/kp/ruling-planets.ts`) onto the unified types in `./types.ts`.
 *
 * Day lord (fixes #36)
 * --------------------
 * The day lord is the lord of the weekday of the MOST RECENT LOCAL SUNRISE AT OR BEFORE the
 * moment. It changes at sunrise, never at midnight (CLAUDE.md). Stack B searched forward from
 * `moment - 24 h`, so for a moment before today's sunrise it found yesterday's sunrise, compared
 * the wrong pair of instants and kept today's weekday. Here the sunrise is searched BACKWARD from
 * the moment, so the pre-sunrise case is the normal case.
 *
 * Weekday of the sunrise: calendar day at the place in local mean time (UTC + longitude / 15 h),
 * which is what Stack B used. This function takes no time zone. Sunrise falls well inside the
 * local morning at every latitude where the sun rises and sets each day, so local mean time and
 * civil time give the same date. Only just inside the polar circles (sunrise within minutes of
 * local midnight) could the civil date differ.
 *
 * Polar night / polar day
 * -----------------------
 * Stack B silently substituted "06:00 local". That is NOT ported. When the sun has no sunrise in
 * the 48 hours before the moment, the result carries an explicit `sunriseStatus`
 * ('no_sunrise_polar_night' or 'no_sunrise_polar_day') and no day lord.
 * TODO(#29 Q8): how a chart reports that case, beyond the flag, is undecided.
 *
 * Sunrise is fixed (`SUNRISE_DEFINITION` in `conventions.ts`, #29 (owner, 2026-11-21)): the Sun's
 * upper limb with standard refraction, which is what `Astronomy.SearchRiseSet` does.
 *
 * Open owner decision, a REQUIRED parameter with no default:
 *  - `RulingPlanetSet`    TODO(#24)
 * Pure TypeScript apart from `astronomy-engine`; runs in Cloudflare Workers.
 */

import * as Astronomy from 'astronomy-engine';
import type {
  ChartCalculationOptions,
  Coordinates,
  KPPlanetLord,
  KpLords,
  RulingPlanets,
} from './types.js';

/** Lord of each weekday, indexed by `Date#getUTCDay()` (0 = Sunday). */
export const DAY_LORDS: readonly KPPlanetLord[] = [
  'Sun', // Sunday
  'Moon', // Monday
  'Mars', // Tuesday
  'Mercury', // Wednesday
  'Jupiter', // Thursday
  'Venus', // Friday
  'Saturn', // Saturday
];

/** Sunrise is searched this many days back from the moment. */
const SUNRISE_LOOKBACK_DAYS = 2;

/**
 * Altitude of the Sun's centre at the upper-limb-plus-standard-refraction sunrise: 16' semi-diameter
 * plus 34' refraction. Only used to tell polar day from polar night when there is no sunrise in
 * the look-back window; `SearchRiseSet` itself computes the actual sunrise.
 */
const SUNRISE_CENTER_ALTITUDE_DEG = -(16 + 34) / 60;

const MS_PER_HOUR = 3600 * 1000;

export type NoSunriseStatus = 'no_sunrise_polar_night' | 'no_sunrise_polar_day';

/** Day lord found: the sunrise that fixed it is reported. */
export interface DayLordFound {
  sunriseStatus: 'ok';
  dayLord: KPPlanetLord;
  /** The most recent sunrise at or before the moment, ISO-8601 UTC. */
  sunriseUtc: string;
}

/** No sunrise in the look-back window. There is no day lord and no sunrise time. */
export interface DayLordNotFound {
  sunriseStatus: NoSunriseStatus;
  dayLord: null;
  sunriseUtc: null;
}

export type DayLordResult = DayLordFound | DayLordNotFound;

function assertValidInputs(dateUtc: Date, coordinates: Coordinates): void {
  if (!(dateUtc instanceof Date) || Number.isNaN(dateUtc.getTime())) {
    throw new RangeError('dateUtc must be a valid Date');
  }
  const { latitude, longitude } = coordinates;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError(`latitude must be within [-90, 90], got ${latitude}`);
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError(`longitude must be within [-180, 180], got ${longitude}`);
  }
}

/**
 * Sunrise at the place, as a Date: the most recent one strictly before `dateUtc` within
 * the look-back window, or `null`. A sunrise at exactly the same instant as `dateUtc` is
 * beyond the sub-second precision of the search and is not distinguished.
 */
function findMostRecentSunrise(dateUtc: Date, observer: Astronomy.Observer): Date | null {
  const event = Astronomy.SearchRiseSet(
    Astronomy.Body.Sun,
    observer,
    +1, // rise
    dateUtc,
    -SUNRISE_LOOKBACK_DAYS, // negative: search backward in time
  );
  return event ? event.date : null;
}

/**
 * Day lord at a place and moment. The day lord changes at sunrise (upper limb, standard
 * refraction: #29 (owner, 2026-11-21)), not at midnight.
 */
export function calculateDayLord(dateUtc: Date, coordinates: Coordinates): DayLordResult {
  assertValidInputs(dateUtc, coordinates);

  const observer = new Astronomy.Observer(coordinates.latitude, coordinates.longitude, 0);
  const sunrise = findMostRecentSunrise(dateUtc, observer);

  if (!sunrise) {
    // No sunrise in the last 48 h, so the Sun did not cross the horizon in that window and its
    // altitude now says which side it stayed on.
    const time = Astronomy.MakeTime(dateUtc);
    const equator = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
    const horizon = Astronomy.Horizon(time, observer, equator.ra, equator.dec); // geometric
    const sunriseStatus: NoSunriseStatus =
      horizon.altitude > SUNRISE_CENTER_ALTITUDE_DEG
        ? 'no_sunrise_polar_day'
        : 'no_sunrise_polar_night';
    return { sunriseStatus, dayLord: null, sunriseUtc: null };
  }

  // Weekday of the sunrise's calendar day at the place (local mean time).
  const localMs = sunrise.getTime() + (coordinates.longitude / 15) * MS_PER_HOUR;
  const weekday = new Date(localMs).getUTCDay(); // 0 = Sunday

  return {
    sunriseStatus: 'ok',
    dayLord: DAY_LORDS[weekday],
    sunriseUtc: sunrise.toISOString(),
  };
}

/** Options this module needs from `ChartCalculationOptions`. Required. */
export type RulingPlanetOptions = Pick<ChartCalculationOptions, 'rulingPlanetSet'>;

/** Ruling planets with a day lord. */
export type RulingPlanetsFound = RulingPlanets & { sunriseStatus: 'ok' };

/**
 * Ruling planets when there is no sunrise. There is no day lord, so `dayLord` and `sunriseUtc`
 * are `null` and `rulingPlanetsList` holds only the four ascendant and Moon entries.
 * TODO(#29 Q8): how a chart reports this case, beyond `sunriseStatus`, is undecided.
 */
export interface RulingPlanetsNoSunrise
  extends Omit<RulingPlanets, 'dayLord' | 'sunriseUtc' | 'sunriseStatus'> {
  dayLord: null;
  sunriseUtc: null;
  sunriseStatus: NoSunriseStatus;
}

export type RulingPlanetsResult = RulingPlanetsFound | RulingPlanetsNoSunrise;

/**
 * Ruling planets at a moment and place.
 *
 * `options.rulingPlanetSet` is required. TODO(#24): membership is the owner's decision.
 * 'asc_star_sign_moon_star_sign_day_lord' is Stack B's fixed list
 * `[AscStar, AscSign, MoonStar, MoonSign, DayLord]`: duplicates kept, no nodes.
 *
 * `ascendant` and `moon` supply only their sign and star lords, so a `HouseCusp` or a
 * `PlanetaryPosition` can be passed. (The lord fields of `getPositionLords` results were
 * narrowed to `KPPlanetLord` by `port-lords`, #43.)
 */
export function calculateRulingPlanets(
  ascendant: Pick<KpLords, 'signLord' | 'starLord'>,
  moon: Pick<KpLords, 'signLord' | 'starLord'>,
  dateUtc: Date,
  coordinates: Coordinates,
  options: RulingPlanetOptions,
): RulingPlanetsResult {
  // TODO(#24): further named sets are added only when the owner decides.
  if (options.rulingPlanetSet !== 'asc_star_sign_moon_star_sign_day_lord') {
    throw new Error(`Unknown RulingPlanetSet: ${String(options.rulingPlanetSet)}`);
  }

  const day = calculateDayLord(dateUtc, coordinates);

  const head: KPPlanetLord[] = [
    ascendant.starLord,
    ascendant.signLord,
    moon.starLord,
    moon.signLord,
  ];
  const base = {
    ascendantSignLord: ascendant.signLord,
    ascendantStarLord: ascendant.starLord,
    moonSignLord: moon.signLord,
    moonStarLord: moon.starLord,
  };

  if (day.dayLord === null) {
    return {
      ...base,
      dayLord: null,
      sunriseUtc: null,
      sunriseStatus: day.sunriseStatus,
      rulingPlanetsList: head,
    };
  }

  return {
    ...base,
    dayLord: day.dayLord,
    sunriseUtc: day.sunriseUtc,
    sunriseStatus: 'ok',
    rulingPlanetsList: [...head, day.dayLord],
  };
}
