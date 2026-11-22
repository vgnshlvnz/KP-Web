import { describe, expect, it } from 'vitest';
import { stepTime, type SimpleDateTime } from '../src/client/animate-step';

function dt(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): SimpleDateTime {
  return { year, month, day, hour, minute, second };
}

describe('stepTime', () => {
  it('steps seconds within a minute', () => {
    expect(stepTime(dt(2024, 6, 15, 10, 30, 45), 10, 'seconds')).toEqual(dt(2024, 6, 15, 10, 30, 55));
  });

  it('steps seconds across a minute boundary', () => {
    expect(stepTime(dt(2024, 6, 15, 10, 30, 55), 10, 'seconds')).toEqual(dt(2024, 6, 15, 10, 31, 5));
  });

  it('steps minutes across an hour boundary', () => {
    expect(stepTime(dt(2024, 6, 15, 10, 50, 0), 15, 'minutes')).toEqual(dt(2024, 6, 15, 11, 5, 0));
  });

  it('steps hours across a day boundary', () => {
    expect(stepTime(dt(2024, 6, 15, 23, 0, 0), 2, 'hours')).toEqual(dt(2024, 6, 16, 1, 0, 0));
  });

  it('steps days across a month boundary', () => {
    expect(stepTime(dt(2024, 1, 31, 12, 0, 0), 1, 'days')).toEqual(dt(2024, 2, 1, 12, 0, 0));
  });

  it('steps days across a year boundary', () => {
    expect(stepTime(dt(2024, 12, 31, 0, 0, 0), 1, 'days')).toEqual(dt(2025, 1, 1, 0, 0, 0));
  });

  it('Jan 31 + 1 month clamps to Feb 29 in a leap year', () => {
    expect(stepTime(dt(2024, 1, 31, 6, 0, 0), 1, 'months')).toEqual(dt(2024, 2, 29, 6, 0, 0));
  });

  it('Jan 31 + 1 month clamps to Feb 28 in a non-leap year', () => {
    expect(stepTime(dt(2023, 1, 31, 6, 0, 0), 1, 'months')).toEqual(dt(2023, 2, 28, 6, 0, 0));
  });

  it('Feb 29 + 1 year clamps to Feb 28 in a non-leap year', () => {
    expect(stepTime(dt(2024, 2, 29, 9, 15, 0), 1, 'years')).toEqual(dt(2025, 2, 28, 9, 15, 0));
  });

  it('steps months across a year boundary', () => {
    expect(stepTime(dt(2024, 11, 15), 3, 'months')).toEqual(dt(2025, 2, 15));
  });

  it('steps years preserving month and day on a non-leap target', () => {
    expect(stepTime(dt(2024, 3, 15, 8, 0, 0), 1, 'years')).toEqual(dt(2025, 3, 15, 8, 0, 0));
  });

  it('steps multiple years', () => {
    expect(stepTime(dt(2020, 2, 29, 0, 0, 0), 4, 'years')).toEqual(dt(2024, 2, 29, 0, 0, 0));
  });
});
