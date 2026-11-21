/**
 * KP Ruling Planets Module.
 *
 * Ruling planets are the key guiding planets in KP astrology:
 *   1. Ascendant Star Lord
 *   2. Ascendant Sign Lord
 *   3. Moon Star Lord
 *   4. Moon Sign Lord
 *   5. Day Lord (calculated from local sunrise, changing at sunrise, not midnight)
 */

import * as Astronomy from 'astronomy-engine';
import { Coordinates, HouseCusp, KPPlanetLord, PlanetaryPosition, RulingPlanets } from '../types.js';

export const DAY_LORDS: KPPlanetLord[] = [
  'Sun', // Sunday (0)
  'Moon', // Monday (1)
  'Mars', // Tuesday (2)
  'Mercury', // Wednesday (3)
  'Jupiter', // Thursday (4)
  'Venus', // Friday (5)
  'Saturn', // Saturday (6)
];

/**
 * Calculates the day lord based on local sunrise.
 * If the moment is before local sunrise, the previous day's lord applies.
 */
export function calculateDayLord(
  dateUtc: Date,
  coordinates: Coordinates
): { dayLord: KPPlanetLord; sunriseUtc: string } {
  const observer = new Astronomy.Observer(
    coordinates.latitude,
    coordinates.longitude,
    0
  );
  const time = Astronomy.MakeTime(dateUtc);

  // Search for sunrise on this day
  // Look back up to 24 hours to find the most recent sunrise
  const searchStart = Astronomy.MakeTime(
    new Date(dateUtc.getTime() - 24 * 3600 * 1000)
  );
  const sunriseEvent = Astronomy.SearchRiseSet(
    Astronomy.Body.Sun,
    observer,
    +1, // direction +1 for rise
    searchStart,
    2 // search window of 2 days
  );

  let sunriseDate: Date;
  if (sunriseEvent) {
    sunriseDate = sunriseEvent.date;
  } else {
    // Polar fallback: approximate 6 AM local time
    const localHour = dateUtc.getUTCHours() + coordinates.longitude / 15;
    const sunriseLocal = new Date(dateUtc);
    sunriseLocal.setUTCHours(6 - Math.round(coordinates.longitude / 15), 0, 0, 0);
    sunriseDate = sunriseLocal;
  }

  // Determine weekday at sunrise:
  // If event is before the sunrise that occurred today, day belongs to yesterday
  let effectiveDate = new Date(dateUtc);
  if (dateUtc.getTime() < sunriseDate.getTime()) {
    effectiveDate = new Date(dateUtc.getTime() - 24 * 3600 * 1000);
  }

  // Weekday in local time
  const localTimeMs =
    effectiveDate.getTime() + (coordinates.longitude / 15) * 3600 * 1000;
  const localDate = new Date(localTimeMs);
  const dayOfWeek = localDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  return {
    dayLord: DAY_LORDS[dayOfWeek],
    sunriseUtc: sunriseDate.toISOString(),
  };
}

/**
 * Computes KP Ruling Planets.
 */
export function calculateRulingPlanets(
  ascendant: HouseCusp,
  moon: PlanetaryPosition,
  dateUtc: Date,
  coordinates: Coordinates
): RulingPlanets {
  const { dayLord, sunriseUtc } = calculateDayLord(dateUtc, coordinates);

  const rulingPlanetsList: KPPlanetLord[] = [
    ascendant.starLord,
    ascendant.signLord,
    moon.starLord,
    moon.signLord,
    dayLord,
  ];

  return {
    ascendantSignLord: ascendant.signLord,
    ascendantStarLord: ascendant.starLord,
    moonSignLord: moon.signLord,
    moonStarLord: moon.starLord,
    dayLord,
    sunriseUtc,
    rulingPlanetsList,
  };
}
