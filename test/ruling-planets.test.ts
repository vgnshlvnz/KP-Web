/**
 * Ruling planets and day lord (port-ruling-planets, #45; regression for #36).
 *
 * Reference values: docs/build-fix/audit.md Appendix A.1 to A.5 (cases) and A.7 (most recent
 * sunrise, Swiss Ephemeris 2.10.03 `rise_trans`: upper limb, standard refraction).
 * Sunrise tolerance: 60 s (task spec; the largest observed difference is 22 s).
 */
import { describe, expect, it } from 'vitest';
import {
  DAY_LORDS,
  calculateDayLord,
  calculateRulingPlanets,
  type RulingPlanetOptions,
} from '../src/engine/ruling-planets.js';
import type { Coordinates } from '../src/engine/types.js';

const KL: Coordinates = { latitude: 3.139, longitude: 101.6869 };
const GREENWICH: Coordinates = { latitude: 51.4779, longitude: -0.0015 };
const CHENNAI: Coordinates = { latitude: 13.0827, longitude: 80.2707 };
const PJ: Coordinates = { latitude: 3.1073, longitude: 101.6067 };
const TROMSO: Coordinates = { latitude: 69.6492, longitude: 18.9553 };

/** Julian Day (UT) to a UTC instant in ms. JD 2440587.5 is 1970-01-01T00:00:00Z. */
const jdToMs = (jd: number): number => Math.round((jd - 2440587.5) * 86400000);

const RP_OPTIONS: RulingPlanetOptions = {
  rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
};

interface DayCase {
  name: string;
  moment: string; // ISO with explicit offset, as in Appendix A headings
  coords: Coordinates;
  seSunriseJd: number; // A.7
  dayLord: string;
}

const CASES: DayCase[] = [
  {
    name: 'Kuala Lumpur 1992-03-11 06:14 +08:00 (before sunrise, #36)',
    moment: '1992-03-11T06:14:00+08:00',
    coords: KL,
    seSunriseJd: 2448691.472913,
    dayLord: 'Mars',
  },
  {
    name: 'Greenwich 2000-01-01 12:00 UTC',
    moment: '2000-01-01T12:00:00Z',
    coords: GREENWICH,
    seSunriseJd: 2451544.836958,
    dayLord: 'Saturn',
  },
  {
    name: 'Chennai 1950-06-15 23:59:30 +05:30',
    moment: '1950-06-15T23:59:30+05:30',
    coords: CHENNAI,
    seSunriseJd: 2433447.508448,
    dayLord: 'Jupiter',
  },
  {
    name: 'Petaling Jaya 2026-11-21 09:00 +08:00',
    moment: '2026-11-21T09:00:00+08:00',
    coords: PJ,
    seSunriseJd: 2461365.458366,
    dayLord: 'Saturn',
  },
];

describe('DAY_LORDS', () => {
  it('maps Sunday..Saturday to Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn', () => {
    expect([...DAY_LORDS]).toEqual([
      'Sun',
      'Moon',
      'Mars',
      'Mercury',
      'Jupiter',
      'Venus',
      'Saturn',
    ]);
  });
});

describe('calculateDayLord: Swiss Ephemeris reference cases (Appendix A.7)', () => {
  for (const c of CASES) {
    it(`${c.name}: day lord ${c.dayLord}, sunrise within 60 s of SE`, () => {
      const r = calculateDayLord(new Date(c.moment), c.coords);
      expect(r.sunriseStatus).toBe('ok');
      if (r.sunriseStatus !== 'ok') return; // narrow
      expect(r.dayLord).toBe(c.dayLord);
      const diffSeconds = Math.abs(new Date(r.sunriseUtc).getTime() - jdToMs(c.seSunriseJd)) / 1000;
      expect(diffSeconds).toBeLessThan(60);
    });
  }

  it('Kuala Lumpur 1992 06:14 is Mars, not Mercury (#36: Stack B returned Wednesday)', () => {
    const r = calculateDayLord(new Date('1992-03-11T06:14:00+08:00'), KL);
    expect(r.dayLord).toBe('Mars');
    expect(r.dayLord).not.toBe('Mercury');
    // The sunrise that fixed it is the one of 1992-03-09 23:21 UTC, the day BEFORE the
    // moment's own morning: the wrong value Stack B reported was this same instant.
    expect(r.sunriseUtc).toMatch(/^1992-03-09T23:2[01]:/);
  });
});

describe('calculateDayLord: changes at sunrise, not midnight', () => {
  it('flips exactly across the sunrise and not across local midnight (Kuala Lumpur, 1992-03-10)', () => {
    const sunriseMs = jdToMs(2448691.472913 + 1); // sunrise of the following morning, 1992-03-10 23:21 UTC
    const before = calculateDayLord(new Date(sunriseMs - 90_000), KL);
    const after = calculateDayLord(new Date(sunriseMs + 90_000), KL);
    expect(before.dayLord).toBe('Mars'); // Tuesday's day, still running although it is Wednesday
    expect(after.dayLord).toBe('Mercury'); // Wednesday's day has begun

    // Local midnight (mean time) between the two: still Mars.
    const localMidnight = Date.UTC(1992, 2, 10, 0, 0, 0) - (KL.longitude / 15) * 3600_000 + 86_400_000;
    expect(calculateDayLord(new Date(localMidnight + 60_000), KL).dayLord).toBe('Mars');
  });

  it('flips one second either side of its own reported sunrise', () => {
    const found = calculateDayLord(new Date('2000-01-01T12:00:00Z'), GREENWICH);
    expect(found.sunriseStatus).toBe('ok');
    if (found.sunriseStatus !== 'ok') return;
    expect(found.dayLord).toBe('Saturn');
    // The next sunrise (Sunday) is the one after; the previous day's lord is Friday's.
    const sunriseMs = new Date(found.sunriseUtc).getTime();
    expect(calculateDayLord(new Date(sunriseMs - 2000), GREENWICH).dayLord).toBe('Venus');
    expect(calculateDayLord(new Date(sunriseMs + 2000), GREENWICH).dayLord).toBe('Saturn');
  });
});

describe('calculateDayLord: no sunrise is explicit, never 06:00 local', () => {
  it('Tromso 2010-12-21 03:00 UTC: polar night, no day lord, no sunrise time', () => {
    const r = calculateDayLord(new Date('2010-12-21T03:00:00Z'), TROMSO);
    expect(r).toEqual({ sunriseStatus: 'no_sunrise_polar_night', dayLord: null, sunriseUtc: null });
  });

  it('Tromso 2010-06-21 12:00 UTC: polar day (midnight sun), no day lord, no sunrise time', () => {
    const r = calculateDayLord(new Date('2010-06-21T12:00:00Z'), TROMSO);
    expect(r).toEqual({ sunriseStatus: 'no_sunrise_polar_day', dayLord: null, sunriseUtc: null });
  });

  it('southern hemisphere mirrors it: Antarctic latitude in June is polar night', () => {
    const r = calculateDayLord(new Date('2010-06-21T12:00:00Z'), { latitude: -75, longitude: 0 });
    expect(r.sunriseStatus).toBe('no_sunrise_polar_night');
  });
});

describe('calculateDayLord: validation', () => {
  const moment = new Date('2000-01-01T12:00:00Z');

  it('rejects an invalid date and out-of-range coordinates', () => {
    expect(() => calculateDayLord(new Date('nope'), GREENWICH)).toThrow(RangeError);
    expect(() => calculateDayLord(moment, { latitude: 91, longitude: 0 })).toThrow(RangeError);
    expect(() => calculateDayLord(moment, { latitude: 0, longitude: 181 })).toThrow(RangeError);
    expect(() => calculateDayLord(moment, { latitude: NaN, longitude: 0 })).toThrow(RangeError);
  });
});

describe('calculateRulingPlanets', () => {
  // Appendix A.1 (KP Old): Cusp 1 307.7290202 Saturn / Rahu; Moon 42.0295069 Venus / Moon.
  const asc = { signLord: 'Saturn', starLord: 'Rahu' } as const;
  const moon = { signLord: 'Venus', starLord: 'Moon' } as const;

  it('KL 1992: the 5-entry list [AscStar, AscSign, MoonStar, MoonSign, DayLord] with Mars as day lord', () => {
    const r = calculateRulingPlanets(asc, moon, new Date('1992-03-11T06:14:00+08:00'), KL, RP_OPTIONS);
    expect(r.sunriseStatus).toBe('ok');
    expect(r.dayLord).toBe('Mars');
    expect(r.rulingPlanetsList).toEqual(['Rahu', 'Saturn', 'Moon', 'Venus', 'Mars']);
    expect(r.ascendantStarLord).toBe('Rahu');
    expect(r.ascendantSignLord).toBe('Saturn');
    expect(r.moonStarLord).toBe('Moon');
    expect(r.moonSignLord).toBe('Venus');
    expect(r.sunriseUtc).toMatch(/^1992-03-09T23:2[01]:/);
  });

  it('keeps duplicates, as Stack B does (TODO(#24))', () => {
    // Moon sign lord and day lord both Saturn on a Saturday.
    const r = calculateRulingPlanets(
      { signLord: 'Saturn', starLord: 'Rahu' },
      { signLord: 'Saturn', starLord: 'Saturn' },
      new Date('2026-11-21T09:00:00+08:00'),
      PJ,
      RP_OPTIONS,
    );
    expect(r.rulingPlanetsList).toEqual(['Rahu', 'Saturn', 'Saturn', 'Saturn', 'Saturn']);
  });

  it('polar night: no day lord, an explicit status, and only the four ascendant and Moon entries', () => {
    const r = calculateRulingPlanets(asc, moon, new Date('2010-12-21T03:00:00Z'), TROMSO, RP_OPTIONS);
    expect(r.sunriseStatus).toBe('no_sunrise_polar_night');
    expect(r.dayLord).toBeNull();
    expect(r.sunriseUtc).toBeNull();
    expect(r.rulingPlanetsList).toEqual(['Rahu', 'Saturn', 'Moon', 'Venus']);
  });

  it('requires a known ruling-planet set: no silent default (TODO(#24))', () => {
    const moment = new Date('1992-03-11T06:14:00+08:00');
    expect(() =>
      calculateRulingPlanets(asc, moon, moment, KL, {} as unknown as RulingPlanetOptions),
    ).toThrow(/Unknown RulingPlanetSet/);
  });
});
