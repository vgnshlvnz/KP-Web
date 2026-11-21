/**
 * Stack B compatibility shim.
 *
 * The domain types live in `src/engine/types.ts` (work package `unify-types`, #39). This file
 * re-exports the parts that are identical, so Stack B (`src/kp/*`, `src/ephemeris/*`,
 * `src/houses/*`, `src/worker.ts`) keeps compiling. It is deleted by `entrypoint` together with
 * Stack B.
 *
 * Kept local on purpose, because Stack B's code depends on their old shapes:
 *   - `AyanamsaMode = 'KP_OLD' | 'KP_NEW'` (the unified wire value is lowercase `'kp_old' | 'kp_new'`)
 *   - `ChartCalculationResult` (Stack B's flat result; the unified one is in `engine/types.ts`)
 *   - `HoraryCalculationResult`
 */

import type {
  DashaBalance,
  HoraryDetails,
  HouseCusp,
  FourLevelSignificators,
  PlanetaryPosition,
  RulingPlanets,
} from './engine/types.js';

export type {
  Coordinates,
  DashaBalance,
  DashaPeriod,
  DateTimeInput,
  FourLevelSignificators,
  HoraryTableEntry,
  HouseCusp,
  KPPlanetLord,
  KpLords,
  NodeMode,
  PlanetName,
  PlanetaryPosition,
  RulingPlanets,
} from './engine/types.js';

/**
 * Stack B's uppercase ayanamsa value. Local to this shim until `entrypoint`.
 * KP Old or KP New only; never Lahiri. TODO(#22): no default is chosen here.
 */
export type AyanamsaMode = 'KP_OLD' | 'KP_NEW';

export interface ChartCalculationResult {
  engine: string;
  ayanamsaMode: AyanamsaMode;
  ayanamsaValueDeg: number;
  ayanamsaDms: string;
  julianDayUt: number;
  localSiderealTimeDeg: number;
  ramcDeg: number;
  obliquityDeg: number;
  planets: PlanetaryPosition[];
  houses: HouseCusp[];
  ascendant: HouseCusp;
  mc: HouseCusp;
  significators: FourLevelSignificators;
  rulingPlanets: RulingPlanets;
  dashaBalance: DashaBalance;
  warnings: string[];
}

export interface HoraryCalculationResult extends ChartCalculationResult, HoraryDetails {}
