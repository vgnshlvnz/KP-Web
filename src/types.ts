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
  FourLevelSignificators as EngineFourLevelSignificators,
  PlanetaryPosition as EnginePlanetaryPosition,
  RulingPlanets,
} from './engine/types.js';

export type {
  Coordinates,
  DashaBalance,
  DashaPeriod,
  DateTimeInput,
  HoraryTableEntry,
  HouseCusp,
  KPPlanetLord,
  KpLords,
  RulingPlanets,
} from './engine/types.js';

/**
 * Stack B's own node mode. The unified engine has mean node only (#29 (owner, 2026-11-21)) and no
 * `NodeMode`; this stays here so Stack B keeps compiling until `entrypoint` deletes it.
 */
export type NodeMode = 'MEAN' | 'TRUE';

/**
 * Stack B's planet names, which still include the outer planets. The unified `PlanetName`
 * (engine/types.ts) is Sun to Saturn plus Rahu and Ketu only. Deleted with Stack B.
 */
export type PlanetName =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn'
  | 'Rahu'
  | 'Ketu'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto';

/** Stack B's planet record: the unified one with Stack B's wider `PlanetName`. */
export type PlanetaryPosition = Omit<EnginePlanetaryPosition, 'name'> & { name: PlanetName };

/** Stack B's four-level significators: the unified layout with Stack B's wider `PlanetName`. */
export interface FourLevelSignificators extends Omit<EngineFourLevelSignificators, 'houseWise' | 'planetWise'> {
  houseWise: Record<
    number,
    {
      level1: PlanetName[];
      level2: PlanetName[];
      level3: PlanetName[];
      level4: PlanetName[];
    }
  >;
  planetWise: Record<
    PlanetName,
    {
      level1Houses: number[];
      level2Houses: number[];
      level3Houses: number[];
      level4Houses: number[];
      agentsFor: PlanetName[];
    }
  >;
}

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
