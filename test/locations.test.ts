import { describe, expect, it } from 'vitest';
import { LOCATIONS } from '../src/data/locations';
import { getLocation, listCountries, listLocationsByCountry, listPlaces } from '../src/core/locations';

/**
 * The generated `src/data/locations.ts` against the owner's `locations.db` (sha256 e58a625a23c52eb5...,
 * 722 rows, 116 countries), and the lookups over it. The .db is not in the repo, so this pins a sample read
 * from it by id (every 20th row in id order, plus the rows other tests and the samples use) as
 * [id, country, state, latitude, longitude]. Regenerate the file with
 * `python3 scripts/import-locations.py /path/to/locations.db` (`--check` says whether it is up to date).
 */
const FROM_DB: Array<[number, string, string | null, number, number]> = [
  [1, "Afghanistan", null, 33.93911, 67.709953],
  [61, "Chile", null, -35.675147, -71.542969],
  [180, "Honduras", null, 15.199999, -86.241905],
  [353, "Lithuania", null, 55.169438, 23.881275],
  [462, "Peru", null, -9.189967, -75.015152],
  [595, "Syria", null, 34.802075, 38.996815],
  [739, "Austria", "Upper Austria", 48.025, 13.975],
  [764, "Belgium", "Antwerp", 51.219448, 4.402464],
  [793, "China", "Chongqing", 29.431586, 106.912251],
  [818, "Cyprus", "Limassol", 34.684422, 33.033572],
  [840, "Denmark", "Zealand", 55.5, 11.75],
  [866, "France", "Marseille", 43.296482, 5.36978],
  [874, "France", "French Guiana", 3.933889, -53.125782],
  [875, "France", "Réunion", -21.115141, 55.536384],
  [876, "France", "Martinique", 14.641528, -61.024174],
  [877, "France", "Guadeloupe", 16.265, -61.551],
  [890, "Greece", "Athens", 37.98381, 23.727539],
  [913, "Hungary", "Southern Great Plain", 46.5, 20.0],
  [916, "India", "Delhi", 28.613939, 77.209021],
  [919, "India", "Chennai", 13.08268, 80.270718],
  [935, "India", "West Bengal", 22.986757, 87.854976],
  [957, "Iran", "Urmia", 37.549999, 45.066667],
  [979, "Ireland", "Leinster", 53.333333, -6.75],
  [1001, "Italy", "Tuscany", 43.416667, 11.0],
  [1024, "Jordan", "Jerash", 32.281111, 35.899444],
  [1047, "Kuwait", "Al Farwaniyah", 29.278189, 47.959483],
  [1070, "Lebanon", "Tyre", 33.270833, 35.203333],
  [1093, "Luxembourg", "Clervaux", 50.05, 6.033333],
  [1096, "Malaysia", "Kuala Lumpur", 3.139003, 101.686855],
  [1102, "Malaysia", "Sabah", 5.978869, 116.072083],
  [1103, "Malaysia", "Sarawak", 1.55311, 110.345032],
  [1120, "Myanmar", "Naypyidaw", 19.763306, 96.078156],
  [1142, "Netherlands", "Rotterdam", 51.92442, 4.477733],
  [1168, "Pakistan", "Rawalpindi", 33.601921, 73.038779],
  [1193, "Philippines", "Baguio", 16.402047, 120.596047],
  [1214, "Portugal", "Madeira", 32.760707, -16.959472],
  [1215, "Portugal", "Azores", 37.74125, -25.67564],
  [1239, "Saudi Arabia", "Medina", 24.470901, 39.612236],
  [1262, "Slovakia", "Western Slovakia", 48.5, 18.0],
  [1287, "Spain", "Madrid", 40.416775, -3.70379],
  [1295, "Spain", "Canary Islands", 28.291565, -16.629129],
  [1310, "Sweden", "Stockholm", 59.329323, 18.068581],
  [1333, "Tajikistan", "Sughd Region", 39.5, 69.0],
  [1360, "United Arab Emirates", "Sharjah", 25.348766, 55.420455],
  [1381, "USA", "Iowa", 41.878003, -93.097702],
  [1398, "USA", "New York", 40.712776, -74.005974],
  [1401, "USA", "Ohio", 40.417287, -82.907123],
  [1423, "Uzbekistan", "Bukhara", 39.767927, 64.421312],
  [1446, "Yemen", "Seiyun", 15.942778, 48.788333],
  [1447, "Yemen", "Zabid", 14.195, 43.315556],
];

describe('src/data/locations.ts matches locations.db', () => {
  it('has the 722 rows and 116 countries of the .db', () => {
    expect(LOCATIONS).toHaveLength(722);
    expect(new Set(LOCATIONS.map((l) => l.country)).size).toBe(116);
    // 115 country-only rows (state NULL in the .db); Austria's is id 9.
    expect(LOCATIONS.filter((l) => l.place === null)).toHaveLength(115);
  });

  it('ids are the .db ids: unique, in order, and (country, place) is unique', () => {
    const ids = LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(ids[0]).toBe(1);
    expect(ids[ids.length - 1]).toBe(1447);
    expect(new Set(LOCATIONS.map((l) => `${l.country}|${l.place ?? ''}`)).size).toBe(LOCATIONS.length);
  });

  it.each(FROM_DB)('row %i (%s, %s) is the .db row, coordinates unchanged', (id, country, place, latitude, longitude) => {
    expect(getLocation(id)).toMatchObject({ id, country, place, latitude, longitude });
  });

  it('every coordinate is a real latitude and longitude and every row has a zone', () => {
    for (const l of LOCATIONS) {
      expect(l.latitude, `id ${l.id}`).toBeGreaterThanOrEqual(-90);
      expect(l.latitude, `id ${l.id}`).toBeLessThanOrEqual(90);
      expect(l.longitude, `id ${l.id}`).toBeGreaterThanOrEqual(-180);
      expect(l.longitude, `id ${l.id}`).toBeLessThanOrEqual(180);
      expect(l.timezone, `id ${l.id}`).toMatch(/^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+)+$/);
    }
  });
});

describe('src/core/locations.ts', () => {
  it('listCountries: 116 names, sorted, each with at least one row', () => {
    const countries = listCountries();
    expect(countries).toHaveLength(116);
    expect(countries).toEqual([...countries].sort((a, b) => a.localeCompare(b, 'en')));
    expect(countries).toContain('India');
    expect(countries).toContain('Malaysia');
    for (const c of countries) expect(listPlaces(c).length, c).toBeGreaterThan(0);
  });

  it('listPlaces: country-only row first, then places by name; India has 22 rows', () => {
    const india = listPlaces('India');
    expect(india).toHaveLength(22);
    expect(india[0]).toMatchObject({ id: 191, place: null });
    const names = india.slice(1).map((l) => l.place as string);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    expect(names).toContain('Delhi');
    expect(listPlaces('Afghanistan')).toHaveLength(1);
    expect(listPlaces('Nowhere')).toEqual([]);
  });

  it('every row is reachable: country lists add up to 722', () => {
    expect(listCountries().reduce((n, c) => n + listPlaces(c).length, 0)).toBe(722);
  });

  it('getLocation: by id, undefined for an unknown id', () => {
    expect(getLocation(916)).toMatchObject({ country: 'India', place: 'Delhi', timezone: 'Asia/Kolkata' });
    expect(getLocation(919)).toMatchObject({ country: 'India', place: 'Chennai' });
    expect(getLocation(0)).toBeUndefined();
    expect(getLocation(99999)).toBeUndefined();
    expect(getLocation(1.5)).toBeUndefined();
  });

  it('listLocationsByCountry is the same data, grouped', () => {
    const grouped = listLocationsByCountry();
    expect(grouped).toHaveLength(116);
    expect(grouped.reduce((n, g) => n + g.places.length, 0)).toBe(722);
    const delhi = grouped.find((g) => g.country === 'India')!.places.find((p) => p.id === 916)!;
    expect(delhi).toEqual({ id: 916, country: 'India', place: 'Delhi', latitude: 28.613939, longitude: 77.209021, timezone: 'Asia/Kolkata' });
  });
});
