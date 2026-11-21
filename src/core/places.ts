import { CITIES_DATA, CityEntry } from '../data/cities';
import { PlaceResult } from './types';

/**
 * Normalizes text for case-insensitive and diacritic-insensitive search.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Searches the embedded open-source GeoNames cities dataset.
 */
export function searchEmbeddedPlaces(query: string, limit: number = 10): PlaceResult[] {
  const normQuery = normalize(query);
  if (!normQuery) return [];

  const exactMatches: CityEntry[] = [];
  const prefixMatches: CityEntry[] = [];
  const substringMatches: CityEntry[] = [];

  for (const city of CITIES_DATA) {
    const normName = normalize(city.name);
    const normAscii = normalize(city.asciiName);
    const normAdmin = normalize(city.admin1);
    const normCountry = normalize(city.country);

    if (normName === normQuery || normAscii === normQuery) {
      exactMatches.push(city);
    } else if (normName.startsWith(normQuery) || normAscii.startsWith(normQuery)) {
      prefixMatches.push(city);
    } else if (
      normName.includes(normQuery) ||
      normAscii.includes(normQuery) ||
      normAdmin.includes(normQuery) ||
      normCountry.includes(normQuery)
    ) {
      substringMatches.push(city);
    }
  }

  const combined = [...exactMatches, ...prefixMatches, ...substringMatches].slice(0, limit);

  return combined.map((city) => ({
    id: city.id,
    name: city.name,
    admin1: city.admin1,
    country: city.country,
    countryCode: city.countryCode,
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone,
    source: 'embedded_geonames',
  }));
}

/**
 * Searches online Open-Meteo Geocoding API if reachable.
 * Uses open-source GeoNames data under CC-BY.
 */
export async function searchOpenMeteoPlaces(query: string, limit: number = 10): Promise<PlaceResult[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${limit}&language=en&format=json`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        id: number;
        name: string;
        latitude: number;
        longitude: number;
        country?: string;
        country_code?: string;
        admin1?: string;
        timezone?: string;
      }>;
    };

    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results
      .filter((item) => item.timezone)
      .map((item) => ({
        id: `openmeteo-${item.id}`,
        name: item.name,
        admin1: item.admin1,
        country: item.country || '',
        countryCode: item.country_code?.toUpperCase() || '',
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: item.timezone as string,
        source: 'open_meteo',
      }));
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

/**
 * Unified place search. Attempts online open-source search first when enabled,
 * and falls back to / supplements with the embedded GeoNames dataset.
 */
export async function searchPlaces(
  query: string,
  options: { limit?: number; preferOnline?: boolean } = {}
): Promise<PlaceResult[]> {
  const limit = options.limit ?? 10;
  const embeddedResults = searchEmbeddedPlaces(query, limit);

  if (options.preferOnline) {
    const onlineResults = await searchOpenMeteoPlaces(query, limit);
    if (onlineResults.length > 0) {
      // Merge results, removing duplicates by name and coordinates
      const seen = new Set<string>();
      const merged: PlaceResult[] = [];

      for (const item of [...onlineResults, ...embeddedResults]) {
        const key = `${normalize(item.name)}-${item.latitude.toFixed(2)}-${item.longitude.toFixed(2)}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }
      return merged.slice(0, limit);
    }
  }

  return embeddedResults;
}

/**
 * Finds a place by its identifier in the embedded dataset.
 */
export function findPlaceById(id: string): PlaceResult | undefined {
  const city = CITIES_DATA.find((c) => c.id === id);
  if (!city) return undefined;
  return {
    id: city.id,
    name: city.name,
    admin1: city.admin1,
    country: city.country,
    countryCode: city.countryCode,
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone,
    source: 'embedded_geonames',
  };
}

/**
 * Creates a validated manual place object.
 */
export function createManualPlace(
  name: string,
  latitude: number,
  longitude: number,
  timezone: string,
  country: string = 'Custom'
): PlaceResult {
  return {
    id: `manual-${Date.now()}`,
    name: name.trim(),
    country: country.trim(),
    countryCode: '',
    latitude,
    longitude,
    timezone: timezone.trim(),
    source: 'manual',
  };
}
