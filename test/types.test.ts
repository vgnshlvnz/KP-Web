/**
 * Type-level tests for the unified domain types (unify-types, #39).
 *
 * `expectTypeOf` assertions are checked by `npm run typecheck` (tsc includes `test/`). At runtime
 * vitest only runs the trivial value assertions. No calculation is involved in this file.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  AyanamsaMode,
  AyanamsaType,
  ChartCalculationOptions,
  ChartCalculationResult,
  ChartWarning,
  DashaBalance,
  DashaPeriod,
  HoraryCalculationResult,
  HoraryTableEntry,
  HouseCusp,
  KPPlanetLord,
  KPPositionLords,
  KpLords,
  PlanetName,
  PlanetaryPosition,
  RulingPlanets,
  SubBoundaryInfo,
} from '../src/engine/types';
import type { AyanamsaMode as CoreAyanamsaMode } from '../src/core/types';
import type { calculateKPChart } from '../src/engine/index';

describe('AyanamsaMode', () => {
  it('is exactly the ten supported ids (#29, owner; KPSTLA added in #72): no default member, no free string', () => {
    expectTypeOf<AyanamsaMode>().toEqualTypeOf<
      | 'kp_straight_line_adjusted'
      | 'kp_old'
      | 'kp_new'
      | 'lahiri'
      | 'raman'
      | 'fagan_bradley'
      | 'yukteshwar'
      | 'jn_bhasin'
      | 'usha_shashi'
      | 'nil'
    >();
    // 'lahiri' used to be asserted NOT to be a member. The owner decision on #29 (2026-11-21, answer A) added it.
    expectTypeOf<'lahiri'>().toMatchTypeOf<AyanamsaMode>();
    expectTypeOf<'lahiri2'>().not.toMatchTypeOf<AyanamsaMode>();
    expectTypeOf<'default'>().not.toMatchTypeOf<AyanamsaMode>();
    expectTypeOf<'KP_OLD'>().not.toMatchTypeOf<AyanamsaMode>();
    expectTypeOf<string>().not.toMatchTypeOf<AyanamsaMode>();
    expect(true).toBe(true);
  });

  it('AyanamsaType (Stack A name) and core AyanamsaMode are the same type', () => {
    expectTypeOf<AyanamsaType>().toEqualTypeOf<AyanamsaMode>();
    expectTypeOf<CoreAyanamsaMode>().toEqualTypeOf<AyanamsaMode>();
  });

  it('the unified engine has no NodeMode: mean node only (#29 (owner, 2026-11-21))', () => {
    // @ts-expect-error NodeMode was removed from engine/types
    type _NoNodeMode = import('../src/engine/types').NodeMode;
    expect(true).toBe(true);
  });
});

describe('PlanetName and KPPlanetLord', () => {
  it('PlanetName is exactly Sun..Saturn, Rahu, Ketu: no outer planets (#29 (owner, 2026-11-21))', () => {
    expectTypeOf<PlanetName>().toEqualTypeOf<
      'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu'
    >();
    expectTypeOf<'Uranus'>().not.toMatchTypeOf<PlanetName>();
  });

  it('KPPlanetLord is the nine Vimshottari lords', () => {
    expectTypeOf<KPPlanetLord>().toEqualTypeOf<
      'Ketu' | 'Venus' | 'Sun' | 'Moon' | 'Mars' | 'Rahu' | 'Jupiter' | 'Saturn' | 'Mercury'
    >();
  });
});

describe('lords', () => {
  it('KpLords lord fields are KPPlanetLord', () => {
    expectTypeOf<KpLords['signLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<KpLords['starLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<KpLords['subLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<KpLords['subSubLord']>().toEqualTypeOf<KPPlanetLord>();
  });

  it('KpLords carries the sub-boundary fields', () => {
    expectTypeOf<KpLords>().toMatchTypeOf<SubBoundaryInfo>();
    expectTypeOf<KpLords['subSpanStart']>().toEqualTypeOf<number>();
    expectTypeOf<KpLords['subSpanEnd']>().toEqualTypeOf<number>();
    expectTypeOf<KpLords['distanceFromSubStartArcsec']>().toEqualTypeOf<number>();
    expectTypeOf<KpLords['distanceToSubEndArcsec']>().toEqualTypeOf<number>();
    expectTypeOf<KpLords['isNearSubBoundary']>().toEqualTypeOf<boolean>();
  });

  it('planet positions and house cusps carry KpLords (all lord fields are KPPlanetLord)', () => {
    expectTypeOf<PlanetaryPosition>().toMatchTypeOf<KpLords>();
    expectTypeOf<HouseCusp>().toMatchTypeOf<KpLords>();
    expectTypeOf<PlanetaryPosition['subSubLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<HouseCusp['subLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<PlanetaryPosition['name']>().toEqualTypeOf<PlanetName>();
  });

  it('Stack A lords record gains optional boundary fields only', () => {
    expectTypeOf<KPPositionLords['subSpanStart']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<KPPositionLords['isNearSubBoundary']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<KPPositionLords['horary249Number']>().toEqualTypeOf<number>();
  });

  it('horary table entry lord fields are KPPlanetLord', () => {
    expectTypeOf<HoraryTableEntry['signLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<HoraryTableEntry['starLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<HoraryTableEntry['subLord']>().toEqualTypeOf<KPPlanetLord>();
  });

  it('ruling planets and dasha lord fields are KPPlanetLord', () => {
    expectTypeOf<RulingPlanets['dayLord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<RulingPlanets['rulingPlanetsList']>().toEqualTypeOf<KPPlanetLord[]>();
    expectTypeOf<DashaPeriod['lord']>().toEqualTypeOf<KPPlanetLord>();
    expectTypeOf<DashaBalance['dashaLord']>().toEqualTypeOf<KPPlanetLord>();
  });
});

describe('chart result and warnings', () => {
  it('chart result adds optional fields only (Stack A callers still compile)', () => {
    expectTypeOf<ChartCalculationResult['ayanamsaType']>().toEqualTypeOf<AyanamsaMode>();
    expectTypeOf<ChartCalculationResult['cusps']>().not.toBeNever();
    expectTypeOf<ChartCalculationResult['warnings']>().toEqualTypeOf<ChartWarning[] | undefined>();
    expectTypeOf<ChartCalculationResult['isPolarFallback']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ChartCalculationResult['planetPositions']>().toEqualTypeOf<
      PlanetaryPosition[] | undefined
    >();
  });

  it('warnings include a polar fallback code', () => {
    expectTypeOf<'polar_fallback'>().toMatchTypeOf<ChartWarning['code']>();
    expectTypeOf<'near_sub_boundary'>().toMatchTypeOf<ChartWarning['code']>();
  });

  it('horary result exposes lagna toggle and sub span', () => {
    expectTypeOf<HoraryCalculationResult['useSubMidpoint']>().toEqualTypeOf<boolean>();
    expectTypeOf<HoraryCalculationResult['horaryNumber']>().toEqualTypeOf<number>();
    expectTypeOf<HoraryCalculationResult>().toMatchTypeOf<ChartCalculationResult>();
  });
});

// #22 decided (no API default; KP New is the UI's default selection), TODO(#23), TODO(#24): none of these options has a default.
describe('owner-decision options have no default', () => {
  it('every option field is required', () => {
    expectTypeOf<Required<ChartCalculationOptions>>().toEqualTypeOf<ChartCalculationOptions>();
    expectTypeOf<ChartCalculationOptions['ayanamsa']>().toEqualTypeOf<AyanamsaMode>();
    expectTypeOf<{}>().not.toMatchTypeOf<ChartCalculationOptions>();
  });
});

// #22 decided: the legacy chart function used to default `ayanamsaType` to 'kp_old'. It is required now
// (final-cleanup, #69). Type-level only: `npm run typecheck` fails if the default comes back.
describe('calculateKPChart has no ayanamsa default (#22, #69)', () => {
  const input = {
    year: 1992,
    month: 3,
    day: 11,
    hour: 6,
    minute: 14,
    second: 0,
    utcOffsetHours: 8,
    latitude: 3.139,
    longitude: 101.6869,
  };

  it('the ayanamsa parameter is required and not optional', () => {
    type Params = Parameters<typeof calculateKPChart>;
    expectTypeOf<Params[1]>().toEqualTypeOf<AyanamsaType>();
    expectTypeOf<Params[1]>().not.toEqualTypeOf<AyanamsaType | undefined>();
  });

  it('omitting the ayanamsa is a type error', () => {
    // Never called: the point is that the next two lines must not type-check.
    const omitted = (fn: typeof calculateKPChart) => {
      // @ts-expect-error ayanamsaType is required (no silent 'kp_old')
      fn(input);
      // @ts-expect-error `undefined` is not an ayanamsa either
      fn(input, undefined);
    };
    expect(typeof omitted).toBe('function');
  });
});
