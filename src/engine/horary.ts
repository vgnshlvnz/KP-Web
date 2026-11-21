/**
 * KP horary (prashna) chart on the unified engine (work package `port-horary`, #56).
 *
 * The querent picks a number from 1 to 249. Each number is one sub of the 249-row KP table. The
 * horary Ascendant (lagna) is the START of that sub; the midpoint is used only when the caller
 * sets `useSubMidpoint: true` (an explicit toggle, never a default). The tropical target is the
 * sidereal target plus the TRUE ayanamsa (mean + nutation in longitude), the same value the
 * planets and cusps are converted with, so that in Swiss Ephemeris terms (sidereal = tropical -
 * true ayanamsa) the Ascendant lands on the sub start and not up to 18 arcsec inside the
 * previous sub (#33). `ascendantToArmc` (#50) turns that Ascendant into the ARMC. Planets,
 * lords, significators, dasha and ruling planets are those of the question instant and place,
 * computed by the same code as `calculateChart`.
 */

import {
  ChartCalculationOptions,
  DateTimeLocation,
  HoraryCalculationResult,
} from './types.js';
import { normalizeDegrees } from './astronomy.js';
import { ascendantToArmc } from './placidus.js';
import { getHoraryEntry } from './kp-lords.js';
import { calculateChartWithArmc } from './index.js';

export interface HoraryInput {
  /** The instant and place of the question: planets, dasha and ruling planets come from here. */
  questionTime: DateTimeLocation;
  /** The querent's number, an integer from 1 to 249. 0, 250 and non-integers throw. */
  horaryNumber: number;
  /**
   * Explicit toggle. `false` or omitted: the lagna is the START of the sub (the KP rule, not an
   * open decision). `true`: the lagna is the midpoint of the sub.
   */
  useSubMidpoint?: boolean;
}

/**
 * Aim this far inside the sub when the lagna is its start, in arcseconds.
 *
 * The inversion and the sidereal conversion carry round-off of up to a few 1e-9 arcsec. Aiming
 * exactly at the start would land the Ascendant at start - 1e-9" about half the time, which is the
 * previous sub (for horary number 1 that is sub 249 at 359.99999 deg). Aiming 1e-4" inside makes
 * the chart robust against that. It is 4 orders of magnitude below anything an arcsecond-level
 * ephemeris can resolve, and it is not applied to the midpoint, where the round-off is harmless.
 */
const SUB_START_INSIDE_ARCSEC = 1e-4;

/**
 * Computes the KP horary chart for a chosen number 1-249.
 *
 * Every option is required and none has a default (TODO(#22), TODO(#23), TODO(#24),
 * TODO(#29 Q6..Q12)); a missing or unknown one throws, as in `calculateChart`.
 *
 * Polar latitudes: a horary chart needs a unique ARMC for the Ascendant, and inside the polar
 * circle (|lat| >= 90 - obliquity, about 66.56) the Ascendant is not a one-to-one function of the
 * ARMC. So `calculateHoraryChart` throws `PolarLatitudeError` there for BOTH `polarHandling`
 * values; there is no Porphyry fallback for horary (TODO(#29 Q7): the owner has not decided how
 * polar horary should behave beyond this). Outside the polar circle `polarHandling` is still
 * required and still applies to a Placidus iteration that does not converge.
 */
export function calculateHoraryChart(
  input: HoraryInput,
  options: ChartCalculationOptions
): HoraryCalculationResult {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('calculateHoraryChart requires an input object');
  }
  const { questionTime, horaryNumber, useSubMidpoint = false } = input;
  if (typeof useSubMidpoint !== 'boolean') {
    throw new TypeError('useSubMidpoint must be a boolean when given');
  }

  // Range-checked: 0, 250, non-integers and NaN throw RangeError.
  const entry = getHoraryEntry(horaryNumber);

  // The lagna is the sidereal longitude the Ascendant must have. `lagnaTargetDeg` reports it
  // exactly, without the numerical safeguard below.
  const lagnaTargetDeg = useSubMidpoint
    ? (entry.startLongitude + entry.endLongitude) / 2
    : entry.startLongitude;
  const aimDeg = useSubMidpoint
    ? lagnaTargetDeg
    : lagnaTargetDeg + SUB_START_INSIDE_ARCSEC / 3600;

  let invertedArmc = NaN;
  const chart = calculateChartWithArmc(questionTime, options, (ctx) => {
    const targetTropical = normalizeDegrees(aimDeg + ctx.trueAyanamsaDeg);
    invertedArmc = ascendantToArmc(targetTropical, questionTime.latitude, ctx.trueObliquityDeg);
    return invertedArmc;
  });

  return {
    ...chart,
    horaryNumber,
    horarySubStartDeg: entry.startLongitude,
    horarySubEndDeg: entry.endLongitude,
    lagnaTargetDeg,
    useSubMidpoint,
    invertedRamcDeg: invertedArmc,
  };
}
