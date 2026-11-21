import { describe, expect, it } from 'vitest';
import { createManualPlace, findPlaceById, searchEmbeddedPlaces, searchPlaces } from '../src/core/places';

describe('Open-Source Places Search', () => {
  it('finds exact and prefix matches for major cities', () => {
    const results = searchEmbeddedPlaces('Chennai');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.name).toBe('Chennai');
    expect(top.admin1).toBe('Tamil Nadu');
    expect(top.country).toBe('India');
    expect(top.latitude).toBeCloseTo(13.0827, 2);
    expect(top.longitude).toBeCloseTo(80.2707, 2);
    expect(top.timezone).toBe('Asia/Kolkata');
    expect(top.source).toBe('embedded_geonames');
  });

  it('performs case-insensitive and diacritic-tolerant search', () => {
    const r1 = searchEmbeddedPlaces('kuala lumpur');
    expect(r1.length).toBeGreaterThan(0);
    expect(r1[0].name).toBe('Kuala Lumpur');
    expect(r1[0].timezone).toBe('Asia/Kuala_Lumpur');

    const r2 = searchEmbeddedPlaces('sao paulo');
    expect(r2.length).toBeGreaterThan(0);
    expect(r2[0].timezone).toBe('America/Sao_Paulo');
  });

  it('finds locations in UK, US, and Europe', () => {
    const london = searchEmbeddedPlaces('London');
    expect(london.some((p) => p.name === 'London' && p.timezone === 'Europe/London')).toBe(true);

    const ny = searchEmbeddedPlaces('New York');
    expect(ny.some((p) => p.name === 'New York' && p.timezone === 'America/New_York')).toBe(true);
  });

  it('returns empty array on empty or whitespace query', () => {
    expect(searchEmbeddedPlaces('')).toEqual([]);
    expect(searchEmbeddedPlaces('   ')).toEqual([]);
  });

  it('finds place by ID', () => {
    const place = findPlaceById('in-chennai');
    expect(place).toBeDefined();
    expect(place?.name).toBe('Chennai');
    expect(place?.timezone).toBe('Asia/Kolkata');

    expect(findPlaceById('non-existent')).toBeUndefined();
  });

  it('creates validated manual places with custom coordinates and timezone', () => {
    const manual = createManualPlace('Custom Village', 11.2345, 78.5678, 'Asia/Kolkata', 'India');
    expect(manual.name).toBe('Custom Village');
    expect(manual.latitude).toBe(11.2345);
    expect(manual.longitude).toBe(78.5678);
    expect(manual.timezone).toBe('Asia/Kolkata');
    expect(manual.source).toBe('manual');
  });

  it('searchPlaces returns embedded results seamlessly', async () => {
    const results = await searchPlaces('Mumbai', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Mumbai');
    expect(results[0].timezone).toBe('Asia/Kolkata');
  });
});
