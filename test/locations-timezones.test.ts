import { describe, expect, it } from 'vitest';
import { LOCATIONS } from '../src/data/locations';
import { COUNTRY_TIMEZONES, ROW_TIMEZONES, ROW_TIMEZONE_NOTES } from '../src/data/location-timezones';
import { computeTimezoneOffset, isValidTimezone } from '../src/core/timezone';

/**
 * The reviewed country/place to IANA zone table (`src/data/location-timezones.ts`) against the generated
 * rows (`src/data/locations.ts`). `scripts/import-locations.py` already refuses a row with no zone; these
 * tests pin the same rules in the test run and add the checks the script cannot do (the runtime knows the
 * zone; the zone is plausible for the point).
 */

const key = (country: string, place: string | null) => `${country}|${place ?? ''}`;

describe('location time zone table', () => {
  it('every zone in the table is known to Intl.DateTimeFormat (the Worker runtime)', () => {
    const zones = new Set([...Object.values(COUNTRY_TIMEZONES), ...Object.values(ROW_TIMEZONES)]);
    expect(zones.size).toBeGreaterThan(50);
    for (const zone of zones) {
      expect(() => Intl.DateTimeFormat(undefined, { timeZone: zone }), zone).not.toThrow();
      expect(isValidTimezone(zone), zone).toBe(true);
    }
  });

  it('a country is in exactly one of the two tables', () => {
    const multi = new Set(Object.keys(ROW_TIMEZONES).map((k) => k.split('|')[0]));
    const both = Object.keys(COUNTRY_TIMEZONES).filter((c) => multi.has(c));
    expect(both).toEqual([]);
  });

  it('every row has a zone: its own entry in a multi-zone country, the country default otherwise', () => {
    for (const l of LOCATIONS) {
      const zone = ROW_TIMEZONES[key(l.country, l.place)] ?? COUNTRY_TIMEZONES[l.country];
      expect(zone, `${l.country} | ${l.place} (id ${l.id})`).toBeTruthy();
    }
  });

  it('the generated rows carry exactly the zone the table gives', () => {
    for (const l of LOCATIONS) {
      const zone = ROW_TIMEZONES[key(l.country, l.place)] ?? COUNTRY_TIMEZONES[l.country];
      expect(l.timezone, `id ${l.id}`).toBe(zone);
    }
  });

  it('no table entry is a typo: each key names a real row or country', () => {
    const rowKeys = new Set(LOCATIONS.map((l) => key(l.country, l.place)));
    const countries = new Set(LOCATIONS.map((l) => l.country));
    for (const k of Object.keys(ROW_TIMEZONES)) expect(rowKeys.has(k), k).toBe(true);
    for (const k of Object.keys(ROW_TIMEZONE_NOTES)) expect(k in ROW_TIMEZONES, k).toBe(true);
    for (const c of Object.keys(COUNTRY_TIMEZONES)) expect(countries.has(c), c).toBe(true);
  });

  it('a multi-zone country has an entry for every one of its rows', () => {
    const multi = new Set(Object.keys(ROW_TIMEZONES).map((k) => k.split('|')[0]));
    for (const l of LOCATIONS.filter((r) => multi.has(r.country))) {
      expect(key(l.country, l.place) in ROW_TIMEZONES, `${l.country} | ${l.place}`).toBe(true);
    }
    // The 22 countries with several tzdb zones, plus France (overseas rows): 185 rows to review.
    expect(LOCATIONS.filter((r) => multi.has(r.country))).toHaveLength(185);
    expect(multi.size).toBe(23);
  });

  it('the standard UTC offset of every row is within two hours of its longitude (catches a wrong-region zone)', () => {
    const at = (zone: string, y: number, m: number) => computeTimezoneOffset(y, m, 15, 12, 0, 0, zone).offsetSeconds / 3600;
    for (const l of LOCATIONS) {
      const standard = Math.min(at(l.timezone, 2024, 1), at(l.timezone, 2024, 7));
      let diff = Math.abs(standard * 15 - l.longitude);
      diff = Math.min(diff, 360 - diff);
      expect(diff, `${l.country} | ${l.place} (id ${l.id}) ${l.timezone}`).toBeLessThanOrEqual(30);
    }
  });

  it('rows the owner relies on get the expected zone', () => {
    const zoneOf = (country: string, place: string | null) =>
      LOCATIONS.find((l) => l.country === country && l.place === place)!.timezone;
    expect(zoneOf('India', 'Delhi')).toBe('Asia/Kolkata');
    expect(zoneOf('India', 'Chennai')).toBe('Asia/Kolkata');
    expect(zoneOf('India', null)).toBe('Asia/Kolkata');
    // Peninsular Malaysia and Sabah/Sarawak have different histories (+7:30 until 1982 versus +8).
    expect(zoneOf('Malaysia', 'Kuala Lumpur')).toBe('Asia/Kuala_Lumpur');
    expect(zoneOf('Malaysia', 'Sabah')).toBe('Asia/Kuching');
    expect(zoneOf('Malaysia', 'Sarawak')).toBe('Asia/Kuching');
    expect(zoneOf('Singapore', 'Central Region')).toBe('Asia/Singapore');
    expect(zoneOf('USA', 'New York')).toBe('America/New_York');
    expect(zoneOf('USA', 'California')).toBe('America/Los_Angeles');
    expect(zoneOf('USA', 'Arizona')).toBe('America/Phoenix');
    expect(zoneOf('USA', 'Hawaii')).toBe('Pacific/Honolulu');
    expect(zoneOf('Portugal', 'Azores')).toBe('Atlantic/Azores');
    expect(zoneOf('Spain', 'Canary Islands')).toBe('Atlantic/Canary');
    expect(zoneOf('France', 'Réunion')).toBe('Indian/Reunion');
    expect(zoneOf('France', 'Paris')).toBe('Europe/Paris');
    expect(zoneOf('United Kingdom', null)).toBe('Europe/London');
  });

  it('the rows the reviewer was unsure of carry a note (country centre points in wide countries)', () => {
    for (const k of ['Australia|', 'Brazil|', 'Canada|', 'Mexico|', 'Russia|', 'Indonesia|', 'Kazakhstan|']) {
      expect(ROW_TIMEZONE_NOTES[k], k).toBeTruthy();
    }
  });
});
