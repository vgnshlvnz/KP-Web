import { normalizeDegrees } from './astronomy.js';
import { KPPositionLords, KPCusp, KPPlanetLord, SubBoundaryInfo } from './types.js';

/**
 * KP lords module: the single source of sign, star, sub and sub-sub lords for the engine.
 *
 * Exported constant names and values (`ZODIAC_SIGNS`, `VIMSHOTTARI_LORDS`, `DASHA_YEARS`,
 * `NAKSHATRAS`, `NAKSHATRA_SPAN_DEG`, `TOTAL_DASHA_YEARS`) are imported by other modules; keep them stable.
 */

export const ZODIAC_SIGNS: ReadonlyArray<{ name: string; abbrev: string; lord: KPPlanetLord }> = [
  { name: 'Aries', abbrev: 'Ari', lord: 'Mars' },
  { name: 'Taurus', abbrev: 'Tau', lord: 'Venus' },
  { name: 'Gemini', abbrev: 'Gem', lord: 'Mercury' },
  { name: 'Cancer', abbrev: 'Can', lord: 'Moon' },
  { name: 'Leo', abbrev: 'Leo', lord: 'Sun' },
  { name: 'Virgo', abbrev: 'Vir', lord: 'Mercury' },
  { name: 'Libra', abbrev: 'Lib', lord: 'Venus' },
  { name: 'Scorpio', abbrev: 'Sco', lord: 'Mars' },
  { name: 'Sagittarius', abbrev: 'Sag', lord: 'Jupiter' },
  { name: 'Capricorn', abbrev: 'Cap', lord: 'Saturn' },
  { name: 'Aquarius', abbrev: 'Aqu', lord: 'Saturn' },
  { name: 'Pisces', abbrev: 'Pis', lord: 'Jupiter' },
];

export const VIMSHOTTARI_LORDS = [
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
] as const;

/** Same type as `KPPlanetLord` in `types.ts`; kept as an alias for existing importers. */
export type PlanetLord = KPPlanetLord;

export const DASHA_YEARS: Record<PlanetLord, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

export const TOTAL_DASHA_YEARS = 120;
export const NAKSHATRA_SPAN_DEG = 40.0 / 3.0; // 13°20' = 13.3333333333°

export const NAKSHATRAS: ReadonlyArray<{ number: number; name: string; lord: KPPlanetLord }> = [
  { number: 1, name: 'Ashwini', lord: 'Ketu' },
  { number: 2, name: 'Bharani', lord: 'Venus' },
  { number: 3, name: 'Krittika', lord: 'Sun' },
  { number: 4, name: 'Rohini', lord: 'Moon' },
  { number: 5, name: 'Mrigashira', lord: 'Mars' },
  { number: 6, name: 'Ardra', lord: 'Rahu' },
  { number: 7, name: 'Punarvasu', lord: 'Jupiter' },
  { number: 8, name: 'Pushya', lord: 'Saturn' },
  { number: 9, name: 'Ashlesha', lord: 'Mercury' },
  { number: 10, name: 'Magha', lord: 'Ketu' },
  { number: 11, name: 'Purva Phalguni', lord: 'Venus' },
  { number: 12, name: 'Uttara Phalguni', lord: 'Sun' },
  { number: 13, name: 'Hasta', lord: 'Moon' },
  { number: 14, name: 'Chitra', lord: 'Mars' },
  { number: 15, name: 'Swati', lord: 'Rahu' },
  { number: 16, name: 'Vishakha', lord: 'Jupiter' },
  { number: 17, name: 'Anuradha', lord: 'Saturn' },
  { number: 18, name: 'Jyeshtha', lord: 'Mercury' },
  { number: 19, name: 'Mula', lord: 'Ketu' },
  { number: 20, name: 'Purva Ashadha', lord: 'Venus' },
  { number: 21, name: 'Uttara Ashadha', lord: 'Sun' },
  { number: 22, name: 'Shravana', lord: 'Moon' },
  { number: 23, name: 'Dhanishta', lord: 'Mars' },
  { number: 24, name: 'Shatabhisha', lord: 'Rahu' },
  { number: 25, name: 'Purva Bhadrapada', lord: 'Jupiter' },
  { number: 26, name: 'Uttara Bhadrapada', lord: 'Saturn' },
  { number: 27, name: 'Revati', lord: 'Mercury' },
];

/**
 * Formats a decimal degree into degrees, minutes, and seconds (seconds rounded to the nearest
 * whole second, with carry). This is the one DMS formatter in the engine; the horary table's
 * `startDms` / `endDms` use it too. Output is zero-padded, e.g. `03°40'12"`.
 */
export function formatDMS(deg: number): {
  degrees: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const d = Math.abs(deg);
  const degrees = Math.floor(d);
  const remMinutes = (d - degrees) * 60.0;
  const minutes = Math.floor(remMinutes);
  const seconds = Math.round((remMinutes - minutes) * 60.0);

  // Handle rounding carry
  let adjSec = seconds;
  let adjMin = minutes;
  let adjDeg = degrees;

  if (adjSec === 60) {
    adjSec = 0;
    adjMin += 1;
  }
  if (adjMin === 60) {
    adjMin = 0;
    adjDeg += 1;
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatted = `${pad(adjDeg)}°${pad(adjMin)}'${pad(adjSec)}"`;

  return {
    degrees: adjDeg,
    minutes: adjMin,
    seconds: adjSec,
    formatted,
  };
}

export interface Horary249Entry {
  number: number;
  startLongitude: number;
  endLongitude: number;
  signIndex: number;
  signName: string;
  signLord: KPPlanetLord;
  starNumber: number;
  starName: string;
  starLord: KPPlanetLord;
  subLord: KPPlanetLord;
  /** `startLongitude` as degrees/minutes/seconds, e.g. `00°00'00"`. */
  startDms: string;
  /** `endLongitude` as degrees/minutes/seconds. The last entry ends at `360°00'00"`. */
  endDms: string;
}

// Cached 1-249 Horary table
let horary249TableCache: Horary249Entry[] | null = null;

/**
 * Generates the standard KP 1–249 Horary table.
 * Each of the 27 nakshatras is split into 9 unequal subs based on Vimshottari dasha years.
 * Six subs cross zodiac sign boundaries and are split, yielding exactly 249 entries.
 */
export function getHorary249Table(): Horary249Entry[] {
  if (horary249TableCache) {
    return horary249TableCache;
  }

  const table: Horary249Entry[] = [];

  const push = (
    signIndex: number,
    nak: (typeof NAKSHATRAS)[number],
    subLord: KPPlanetLord,
    startLongitude: number,
    endLongitude: number
  ) => {
    table.push({
      number: table.length + 1,
      startLongitude,
      endLongitude,
      signIndex,
      signName: ZODIAC_SIGNS[signIndex].name,
      signLord: ZODIAC_SIGNS[signIndex].lord,
      starNumber: nak.number,
      starName: nak.name,
      starLord: nak.lord,
      subLord,
      startDms: formatDMS(startLongitude).formatted,
      endDms: formatDMS(endLongitude).formatted,
    });
  };

  for (let nakIdx = 0; nakIdx < 27; nakIdx++) {
    const nak = NAKSHATRAS[nakIdx];
    const nakStart = nakIdx * NAKSHATRA_SPAN_DEG;
    const startLordIdx = VIMSHOTTARI_LORDS.indexOf(nak.lord);

    let curr = nakStart;

    for (let s = 0; s < 9; s++) {
      const subLord = VIMSHOTTARI_LORDS[(startLordIdx + s) % 9];
      const span = (DASHA_YEARS[subLord] / TOTAL_DASHA_YEARS) * NAKSHATRA_SPAN_DEG;
      const end = curr + span;

      const signCurr = Math.floor(curr / 30.0);
      const signEnd = Math.floor((end - 1e-9) / 30.0);

      if (signCurr !== signEnd) {
        // Crosses a sign boundary: split into two entries
        const splitDeg = (signCurr + 1) * 30.0;
        push(signCurr, nak, subLord, curr, splitDeg);
        push(signEnd, nak, subLord, splitDeg, end);
      } else {
        push(signCurr, nak, subLord, curr, end);
      }

      curr = end;
    }
  }

  horary249TableCache = table;
  return table;
}

/**
 * Returns one entry of the 1–249 horary table.
 * @throws RangeError if `n` is not an integer from 1 to 249.
 */
export function getHoraryEntry(n: number): Horary249Entry {
  if (!Number.isInteger(n) || n < 1 || n > 249) {
    throw new RangeError(`Horary number must be an integer between 1 and 249. Received: ${n}`);
  }
  return getHorary249Table()[n - 1];
}

/**
 * Opt-in sub-boundary reporting for `getPositionLords` / `buildKPCusp`.
 *
 * TODO(#29 Q10): the near-boundary threshold is an owner decision (Stack B used 60 arcsec).
 * There is deliberately no default: the caller must pass one.
 */
export interface PositionLordsOptions {
  /** Arcseconds from either edge of the sub span within which `isNearSubBoundary` is true. */
  nearBoundaryThresholdArcsec: number;
}

function assertThreshold(arcsec: number): void {
  if (!Number.isFinite(arcsec) || arcsec < 0) {
    throw new RangeError(
      `nearBoundaryThresholdArcsec must be a finite number >= 0. Received: ${arcsec}`
    );
  }
}

/**
 * Derives sign lord, star lord, sub lord, sub-sub lord, and 1-249 horary number
 * for any sidereal longitude (0° to 360°).
 *
 * Without `options` the result has no sub-boundary fields (the shape existing callers rely on).
 * With `options`, `subSpanStart`, `subSpanEnd`, `distanceFromSubStartArcsec`,
 * `distanceToSubEndArcsec` and `isNearSubBoundary` are filled in. They describe the **sub** span
 * (not the sub-sub span).
 */
export function getPositionLords(longitude: number): KPPositionLords;
export function getPositionLords(
  longitude: number,
  options: PositionLordsOptions
): KPPositionLords & SubBoundaryInfo;
export function getPositionLords(
  longitude: number,
  options?: PositionLordsOptions
): KPPositionLords | (KPPositionLords & SubBoundaryInfo) {
  if (options) {
    assertThreshold(options.nearBoundaryThresholdArcsec);
  }
  const lon = normalizeDegrees(longitude);

  // 1. Sign
  const signIndex = Math.floor(lon / 30.0);
  const sign = ZODIAC_SIGNS[signIndex];
  const degreeInSign = lon % 30.0;
  const dms = formatDMS(degreeInSign);
  const formatted = `${dms.formatted} ${sign.abbrev}`;

  // 2. Star (Nakshatra)
  const starIndex = Math.min(26, Math.floor(lon / NAKSHATRA_SPAN_DEG));
  const nak = NAKSHATRAS[starIndex];
  const degreeInStar = lon - starIndex * NAKSHATRA_SPAN_DEG;

  // 3. Sub Lord
  const starLord = nak.lord;
  const starLordIdx = VIMSHOTTARI_LORDS.indexOf(starLord);

  let accumulatedSubSpan = 0.0;
  let subLord: KPPlanetLord = starLord;
  let subSpan = 0.0;
  let subStartInStar = 0.0;

  for (let s = 0; s < 9; s++) {
    const candidateSubLord = VIMSHOTTARI_LORDS[(starLordIdx + s) % 9];
    const curSpan = (DASHA_YEARS[candidateSubLord] / TOTAL_DASHA_YEARS) * NAKSHATRA_SPAN_DEG;

    if (degreeInStar < accumulatedSubSpan + curSpan || s === 8) {
      subLord = candidateSubLord;
      subSpan = curSpan;
      subStartInStar = accumulatedSubSpan;
      break;
    }
    accumulatedSubSpan += curSpan;
  }

  // 4. Sub-Sub Lord
  const degreeInSub = degreeInStar - subStartInStar;
  const subLordIdx = VIMSHOTTARI_LORDS.indexOf(subLord);

  let accumulatedSubSubSpan = 0.0;
  let subSubLord: KPPlanetLord = subLord;

  for (let ss = 0; ss < 9; ss++) {
    const candidateSubSubLord = VIMSHOTTARI_LORDS[(subLordIdx + ss) % 9];
    const curSubSubSpan = (DASHA_YEARS[candidateSubSubLord] / TOTAL_DASHA_YEARS) * subSpan;

    if (degreeInSub < accumulatedSubSubSpan + curSubSubSpan || ss === 8) {
      subSubLord = candidateSubSubLord;
      break;
    }
    accumulatedSubSubSpan += curSubSubSpan;
  }

  // 5. Horary 249 Number
  const table = getHorary249Table();
  let horary249Number = 1;

  for (const entry of table) {
    if (lon >= entry.startLongitude && lon < entry.endLongitude) {
      horary249Number = entry.number;
      break;
    }
  }

  const lords: KPPositionLords = {
    longitude: lon,
    signIndex,
    signName: sign.name,
    signLord: sign.lord,
    degreeInSign,
    formatted,
    degrees: dms.degrees,
    minutes: dms.minutes,
    seconds: dms.seconds,
    starIndex,
    starNumber: nak.number,
    starName: nak.name,
    starLord: nak.lord,
    subLord,
    subSubLord,
    horary249Number,
  };

  if (!options) {
    return lords;
  }

  // 6. Sub-boundary info (Stack B's fields), distances in arcseconds, never negative.
  const subSpanStart = starIndex * NAKSHATRA_SPAN_DEG + subStartInStar;
  const subSpanEnd = subSpanStart + subSpan;
  const distanceFromSubStartArcsec = Math.max(0, (lon - subSpanStart) * 3600);
  const distanceToSubEndArcsec = Math.max(0, (subSpanEnd - lon) * 3600);

  return {
    ...lords,
    subSpanStart,
    subSpanEnd,
    distanceFromSubStartArcsec,
    distanceToSubEndArcsec,
    isNearSubBoundary:
      distanceFromSubStartArcsec < options.nearBoundaryThresholdArcsec ||
      distanceToSubEndArcsec < options.nearBoundaryThresholdArcsec,
  };
}

/**
 * Builds a complete KPCusp object given its house number (1..12),
 * cusp longitude, and next cusp longitude.
 * Pass `options` to also get the sub-boundary fields (see `getPositionLords`).
 */
export function buildKPCusp(
  house: number,
  cuspLongitude: number,
  nextCuspLongitude: number,
  options?: PositionLordsOptions
): KPCusp {
  const lords = options
    ? getPositionLords(cuspLongitude, options)
    : getPositionLords(cuspLongitude);
  const houseSpan = normalizeDegrees(nextCuspLongitude - cuspLongitude);

  return {
    ...lords,
    house,
    nextCuspLongitude: normalizeDegrees(nextCuspLongitude),
    houseSpan,
  };
}
