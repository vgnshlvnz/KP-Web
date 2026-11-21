import { describe, expect, it } from 'vitest';
import {
  getDaysInMonth,
  isLeapYear,
  validateAyanamsa,
  validateBirthInput,
  validateCoordinates,
  validateDate,
  validateTime,
} from '../src/core/validation';

describe('Birth Data Validation & Integrity', () => {
  describe('Calendar Date Validation', () => {
    it('detects leap years correctly', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2100)).toBe(false);
      expect(isLeapYear(2023)).toBe(false);
    });

    it('returns correct days in month', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29);
      expect(getDaysInMonth(2023, 2)).toBe(28);
      expect(getDaysInMonth(2024, 4)).toBe(30);
      expect(getDaysInMonth(2024, 1)).toBe(31);
    });

    it('validates legitimate dates', () => {
      expect(validateDate(1985, 5, 15)).toBeNull();
      expect(validateDate(2024, 2, 29)).toBeNull();
    });

    it('rejects invalid dates (e.g. Feb 30, April 31, non-leap Feb 29)', () => {
      expect(validateDate(2023, 2, 29)).toContain('between 1 and 28');
      expect(validateDate(2024, 2, 30)).toContain('between 1 and 29');
      expect(validateDate(2024, 4, 31)).toContain('between 1 and 30');
      expect(validateDate(2024, 13, 1)).toContain('between 1 and 12');
      expect(validateDate(1750, 5, 15)).toContain('between 1800 and 2200');
    });
  });

  describe('Time Validation to the Second', () => {
    it('accepts valid time components with seconds', () => {
      expect(validateTime(14, 30, 25)).toBeNull();
      expect(validateTime(0, 0, 0)).toBeNull();
      expect(validateTime(23, 59, 59)).toBeNull();
    });

    it('rejects invalid hours, minutes, or seconds', () => {
      expect(validateTime(24, 30, 25)).toContain('Hours must be an integer between 0 and 23');
      expect(validateTime(14, 60, 25)).toContain('Minutes must be an integer between 0 and 59');
      expect(validateTime(14, 30, 60)).toContain('Seconds must be an integer between 0 and 59');
      expect(validateTime(14, 30, -1)).toContain('Seconds must be an integer between 0 and 59');
    });
  });

  describe('Coordinates Validation', () => {
    it('accepts valid latitude and longitude', () => {
      expect(validateCoordinates(13.0827, 80.2707)).toBeNull();
      expect(validateCoordinates(-33.8688, 151.2093)).toBeNull();
      expect(validateCoordinates(0, 0)).toBeNull();
    });

    it('rejects out of bounds coordinates', () => {
      expect(validateCoordinates(91, 0)).toContain('Latitude must be a valid number between -90 and +90');
      expect(validateCoordinates(0, 181)).toContain('Longitude must be a valid number between -180 and +180');
      expect(validateCoordinates(NaN, 0)).toContain('Latitude must be a valid number');
    });
  });

  describe('Ayanamsa Selection (explicit choice, no default, no silent fallback)', () => {
    it('accepts every supported mode when it is explicitly selected', () => {
      // Owner decision on #29 (2026-11-21, answer A): KP Old, KP New, Lahiri, Raman, Fagan-Bradley,
      // Yukteshwar, J.N. Bhasin, Usha-Shashi and Nil (tropical).
      for (const id of [
        'kp_old',
        'kp_new',
        'lahiri',
        'raman',
        'fagan_bradley',
        'yukteshwar',
        'jn_bhasin',
        'usha_shashi',
        'nil',
      ]) {
        expect(validateAyanamsa(id), id).toBeNull();
      }
    });

    it('rejects an unknown or missing ayanamsa without silent fallback', () => {
      // Superseded by the owner decision on #29: this test used to assert that 'lahiri' is rejected
      // ("Lahiri or silent fallback is not permitted"). Lahiri is now a supported explicit choice, so
      // the unknown id here is 'lahiri2'. The silent fallback is still prohibited.
      const errUnknown = validateAyanamsa('lahiri2');
      expect(errUnknown).toBeDefined();
      expect(errUnknown).toContain('no silent fallback');
      for (const bad of ['Lahiri', 'KP_OLD', 'kp-old', 'default']) {
        expect(validateAyanamsa(bad), bad).toContain('no silent fallback');
      }

      const errEmpty = validateAyanamsa('');
      expect(errEmpty).toContain('KP Old');

      const errNull = validateAyanamsa(null);
      expect(errNull).toContain('KP Old');
      expect(validateAyanamsa(undefined)).toContain('KP Old');
    });
  });

  describe('Full Birth Input Validation & Resolution', () => {
    it('successfully validates complete and accurate birth data', () => {
      const payload = {
        date: '1985-05-15',
        hours: 14,
        minutes: 30,
        seconds: 25,
        placeText: 'Chennai, Tamil Nadu, India',
        latitude: 13.0827,
        longitude: 80.2707,
        timezone: 'Asia/Kolkata',
        country: 'India',
        countryCode: 'IN',
        ayanamsa: 'kp_old',
      };

      const result = validateBirthInput(payload);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.resolvedChartInput).toBeDefined();

      const chart = result.resolvedChartInput!;
      expect(chart.rawInput.date).toBe('1985-05-15');
      expect(chart.rawInput.seconds).toBe(25);
      expect(chart.rawInput.placeText).toBe('Chennai, Tamil Nadu, India');
      expect(chart.rawInput.ayanamsa).toBe('kp_old');

      expect(chart.resolvedPlace.latitude).toBeCloseTo(13.0827, 4);
      expect(chart.resolvedTime.offsetString).toBe('UTC+05:30');
      expect(chart.resolvedTime.offsetMinutes).toBe(330);
      expect(chart.resolvedTime.utcIsoString).toBe('1985-05-15T09:00:25.000Z');
      expect(chart.readyForCalculation).toBe(true);
      expect(chart.rawInput.offsetString).toBe('UTC+05:30');
      expect(chart.rawInput.offsetMinutes).toBe(330);
    });

    it('rejects malformed date strings', () => {
      const res1 = validateBirthInput({
        date: '2024-02-30junk',
        hours: 10,
        minutes: 0,
        seconds: 0,
        placeText: 'Chennai',
        latitude: 13.0827,
        longitude: 80.2707,
        timezone: 'Asia/Kolkata',
        ayanamsa: 'kp_old',
      });
      expect(res1.valid).toBe(false);
      expect(res1.errors.date).toContain('strictly as YYYY-MM-DD');
    });

    it('rejects nonexistent DST spring-forward time during validation', () => {
      const res = validateBirthInput({
        date: '2024-03-10',
        hours: 2,
        minutes: 30,
        seconds: 0,
        placeText: 'New York',
        latitude: 40.7128,
        longitude: -74.006,
        timezone: 'America/New_York',
        ayanamsa: 'kp_old',
      });
      expect(res.valid).toBe(false);
      expect(res.errors.time).toContain('spring-forward');
    });

    it('rejects incomplete or invalid birth input without guessing', () => {
      const payload = {
        date: '2023-02-29', // Invalid date
        hours: 25, // Invalid hour
        minutes: 30,
        // Missing seconds!
        placeText: '', // Empty place
        latitude: 100, // Out of bounds
        longitude: 200,
        timezone: 'Fake/Zone',
        ayanamsa: 'lahiri2', // Not a supported id (was 'lahiri' before the #29 owner decision)
      };

      const result = validateBirthInput(payload);
      expect(result.valid).toBe(false);
      expect(result.resolvedChartInput).toBeUndefined();
      expect(result.errors.date).toBeDefined();
      expect(result.errors.time).toBeDefined();
      expect(result.errors.place).toBeDefined();
      expect(result.errors.coordinates).toBeDefined();
      expect(result.errors.timezone).toBeDefined();
      expect(result.errors.ayanamsa).toBeDefined();
    });
  });
});
