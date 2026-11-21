/**
 * Vimshottari dasha / bhukti / antara (work package `port-dasha`, #44).
 *
 * Ported from Stack B (`src/kp/dasha.ts`) onto the unified types, with two changes:
 *
 * 1. #37: the balance of the birth dasha is the unexpired TAIL of that dasha. The bhuktis already
 *    elapsed at birth are skipped, the running bhukti is cut to its remaining fraction, and the
 *    running antara inside it is cut the same way. Stack B scaled all nine bhuktis into the
 *    balance, so the running bhukti was always the dasha lord's own.
 * 2. Days per year is a required parameter. There is no hidden constant.
 *    TODO(#29 Q9): owner to decide the dasha year length (365.25, 365.2425 (Stack B), 360, ...).
 *
 * All period lengths are computed in YEARS first (exact 120-year proportions). Days per year only
 * enters when years are converted to calendar dates, so balance, running bhukti and "years left"
 * do not depend on it.
 *
 * Constants come from `kp-lords.ts` (read-only here).
 */

import {
  DASHA_YEARS,
  NAKSHATRAS,
  NAKSHATRA_SPAN_DEG,
  TOTAL_DASHA_YEARS,
  VIMSHOTTARI_LORDS,
} from './kp-lords.js';
import type {
  ChartCalculationOptions,
  DashaBalance,
  DashaPeriod,
  KPPlanetLord,
} from './types.js';

/**
 * Dasha options. `dashaYearDays` has no default: TODO(#29 Q9).
 * `numDashas` is how many major periods to list, counting the balance dasha (default 9, as in
 * Stack B; because the first one is only a balance, the list then ends short of 120 years).
 */
export type DashaOptions = Pick<ChartCalculationOptions, 'dashaYearDays'> & {
  numDashas?: number;
};

/** A period that is already running at birth, with what is left of it. */
export interface RunningPeriod {
  lord: KPPlanetLord;
  /** Full length of this period in years. */
  fullYears: number;
  /** Years of it still to run at birth. */
  yearsLeft: number;
}

/** Everything that follows from the Moon's longitude, before any calendar dates. Units: years. */
export interface DashaAtBirth {
  birthStar: string;
  dashaLord: KPPlanetLord;
  /** Fraction of the birth nakshatra still ahead of the Moon (0 to 1). */
  fractionRemaining: number;
  /** Years of the birth dasha still to run. */
  balanceYears: number;
  running: {
    dasha: RunningPeriod;
    bhukti: RunningPeriod;
    antara: RunningPeriod;
  };
}

/** Periods shorter than this (years, about 0.3 ms) are floating-point residue, not real periods. */
const EPSILON_YEARS = 1e-11;
const MS_PER_DAY = 86_400_000;

function lordsFrom(start: KPPlanetLord): KPPlanetLord[] {
  const i = VIMSHOTTARI_LORDS.indexOf(start);
  return Array.from({ length: 9 }, (_, k) => VIMSHOTTARI_LORDS[(i + k) % 9]);
}

/** Length in years of the sub-period of `subLord` inside a period of `parentYears`. */
function proportion(parentYears: number, subLord: KPPlanetLord): number {
  return (parentYears * DASHA_YEARS[subLord]) / TOTAL_DASHA_YEARS;
}

/** Years of each of the nine bhuktis of a full dasha of `dashaLord`, starting with its own. */
export function getBhuktiYears(dashaLord: KPPlanetLord): Array<{ lord: KPPlanetLord; years: number }> {
  const total = DASHA_YEARS[dashaLord];
  return lordsFrom(dashaLord).map((lord) => ({ lord, years: proportion(total, lord) }));
}

/**
 * Which of the sequential sub-periods contains `elapsed` years from the start.
 * Returns the index, and how many years of that sub-period remain.
 */
function locate(
  lengths: number[],
  elapsed: number
): { index: number; yearsLeft: number } {
  let cumulative = 0;
  for (let i = 0; i < lengths.length; i++) {
    cumulative += lengths[i];
    if (cumulative - elapsed > EPSILON_YEARS) {
      return { index: i, yearsLeft: cumulative - elapsed };
    }
  }
  // elapsed equals the whole period (cannot happen for a fraction below 1); stay on the last one.
  const last = lengths.length - 1;
  return { index: last, yearsLeft: lengths[last] };
}

/**
 * Moon longitude to birth dasha, balance and the running bhukti and antara (years only).
 *
 * @param moonSiderealLon Moon's sidereal longitude, degrees. Which ayanamsa produced it is the
 *   caller's business (TODO(#22)); this function never picks one.
 */
export function getDashaAtBirth(moonSiderealLon: number): DashaAtBirth {
  const lon = ((moonSiderealLon % 360) + 360) % 360;
  const nakIdx = Math.min(Math.floor(lon / NAKSHATRA_SPAN_DEG), 26);
  const nak = NAKSHATRAS[nakIdx];
  const posInNak = lon - nakIdx * NAKSHATRA_SPAN_DEG;
  const fractionRemaining = 1 - posInNak / NAKSHATRA_SPAN_DEG;

  const dashaLord = nak.lord as KPPlanetLord;
  const dashaYears = DASHA_YEARS[dashaLord];
  const balanceYears = dashaYears * fractionRemaining;
  const elapsedInDasha = dashaYears - balanceYears;

  const bhuktis = getBhuktiYears(dashaLord);
  const b = locate(
    bhuktis.map((x) => x.years),
    elapsedInDasha
  );
  const bhukti = bhuktis[b.index];

  const elapsedInBhukti = bhukti.years - b.yearsLeft;
  const antaras = lordsFrom(bhukti.lord).map((lord) => ({
    lord,
    years: proportion(bhukti.years, lord),
  }));
  const a = locate(
    antaras.map((x) => x.years),
    elapsedInBhukti
  );
  const antara = antaras[a.index];

  return {
    birthStar: nak.name,
    dashaLord,
    fractionRemaining,
    balanceYears,
    running: {
      dasha: { lord: dashaLord, fullYears: dashaYears, yearsLeft: balanceYears },
      bhukti: { lord: bhukti.lord, fullYears: bhukti.years, yearsLeft: b.yearsLeft },
      antara: { lord: antara.lord, fullYears: antara.years, yearsLeft: a.yearsLeft },
    },
  };
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Builds a dated period from its slices. Boundaries are start + cumulative years (not chained
 * additions), so the last child ends exactly where its parent ends.
 */
function buildPeriod(
  level: DashaPeriod['level'],
  lord: KPPlanetLord,
  startMs: number,
  years: number,
  msPerYear: number,
  subPeriods?: DashaPeriod[]
): DashaPeriod {
  const endMs = startMs + years * msPerYear;
  const period: DashaPeriod = {
    lord,
    level,
    startDate: isoDate(startMs),
    endDate: isoDate(endMs),
    durationDays: Math.round((years * msPerYear) / MS_PER_DAY),
  };
  if (subPeriods) period.subPeriods = subPeriods;
  return period;
}

function buildAntaras(
  bhuktiLord: KPPlanetLord,
  bhuktiFullYears: number,
  startAntaraLord: KPPlanetLord,
  firstAntaraYears: number,
  startMs: number,
  msPerYear: number
): DashaPeriod[] {
  // `startAntaraLord` is the antara running at the start of this bhukti slice (the bhukti lord
  // itself for a full bhukti). Antaras before it were already over, and are skipped.
  const order = lordsFrom(bhuktiLord);
  const from = order.indexOf(startAntaraLord);
  const out: DashaPeriod[] = [];
  let cumulative = 0;
  for (let k = from; k < 9; k++) {
    const lord = order[k];
    const years = k === from ? firstAntaraYears : proportion(bhuktiFullYears, lord);
    out.push(buildPeriod('antara', lord, startMs + cumulative * msPerYear, years, msPerYear));
    cumulative += years;
  }
  return out;
}

/**
 * Vimshottari timeline from the Moon's sidereal longitude.
 *
 * The first dasha is the balance dasha: it starts at `birthDateUtc`, its first bhukti is the
 * running one (cut to what is left), and the first antara inside that is the running one (cut).
 * All later dashas, bhuktis and antaras are full.
 *
 * @param moonSiderealLon Moon's sidereal longitude, degrees (caller chose the ayanamsa, TODO(#22))
 * @param birthDateUtc    birth or question instant
 * @param options         `dashaYearDays` is required, TODO(#29 Q9). `numDashas` defaults to 9.
 */
export function calculateVimshottariDasha(
  moonSiderealLon: number,
  birthDateUtc: Date,
  options: DashaOptions
): DashaBalance {
  const { dashaYearDays } = options;
  if (!Number.isFinite(dashaYearDays) || dashaYearDays <= 0) {
    throw new RangeError(`dashaYearDays must be a positive number, got ${dashaYearDays}`);
  }
  const numDashas = options.numDashas ?? 9;
  const msPerYear = dashaYearDays * MS_PER_DAY;

  const birth = getDashaAtBirth(moonSiderealLon);

  const balanceYears = Math.floor(birth.balanceYears);
  const remMonths = (birth.balanceYears - balanceYears) * 12;
  const balanceMonths = Math.floor(remMonths);
  // A dasha month is one twelfth of the dasha year, so the displayed balance follows the one
  // year-length option. (This used to be a hidden 30.4375 = 365.25 / 12.)
  // TODO(#29 Q17): owner to confirm that months are derived as dashaYearDays / 12.
  const daysPerMonth = dashaYearDays / 12;
  const balanceDays = Math.round((remMonths - balanceMonths) * daysPerMonth);

  const timeline: DashaPeriod[] = [];
  const dashaOrder = lordsFrom(birth.dashaLord);
  let dashaStartMs = birthDateUtc.getTime();

  for (let d = 0; d < numDashas; d++) {
    const dashaLord = dashaOrder[d % 9];
    const isBalance = d === 0;
    const dashaYears = isBalance ? birth.balanceYears : DASHA_YEARS[dashaLord];
    const fullBhuktis = getBhuktiYears(dashaLord);

    // Bhukti slices for this dasha. The balance dasha skips the bhuktis already elapsed and cuts
    // the running one (#37). Every other dasha lists all nine in full.
    const firstIndex = isBalance ? fullBhuktis.findIndex((x) => x.lord === birth.running.bhukti.lord) : 0;

    const bhuktiPeriods: DashaPeriod[] = [];
    let cumulative = 0;
    for (let k = firstIndex; k < 9; k++) {
      const full = fullBhuktis[k];
      const running = isBalance && k === firstIndex;
      const years = running ? birth.running.bhukti.yearsLeft : full.years;
      const bhuktiStartMs = dashaStartMs + cumulative * msPerYear;

      const antaras = buildAntaras(
        full.lord,
        full.years,
        running ? birth.running.antara.lord : full.lord,
        running ? birth.running.antara.yearsLeft : proportion(full.years, full.lord),
        bhuktiStartMs,
        msPerYear
      );
      bhuktiPeriods.push(buildPeriod('bhukti', full.lord, bhuktiStartMs, years, msPerYear, antaras));
      cumulative += years;
    }

    timeline.push(
      buildPeriod('dasha', dashaLord, dashaStartMs, dashaYears, msPerYear, bhuktiPeriods)
    );
    dashaStartMs += dashaYears * msPerYear;
  }

  return {
    birthStar: birth.birthStar,
    dashaLord: birth.dashaLord,
    balanceYears,
    balanceMonths,
    balanceDays,
    dashaTimeline: timeline,
  };
}
