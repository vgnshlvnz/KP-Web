/**
 * KP Sub-Lords and Sub-Sub Lords Calculation Module.
 *
 * Implements Krishnamurti Paddhati rules for dividing each of the 27 Nakshatras
 * into 9 unequal sub-divisions sized by Vimshottari Dasha proportions, and each
 * sub into 9 sub-sub divisions.
 */

import { KPPlanetLord, KpLords } from '../types.js';

export const ZODIAC_SIGNS: Array<{ name: string; lord: KPPlanetLord }> = [
  { name: 'Aries', lord: 'Mars' },
  { name: 'Taurus', lord: 'Venus' },
  { name: 'Gemini', lord: 'Mercury' },
  { name: 'Cancer', lord: 'Moon' },
  { name: 'Leo', lord: 'Sun' },
  { name: 'Virgo', lord: 'Mercury' },
  { name: 'Libra', lord: 'Venus' },
  { name: 'Scorpio', lord: 'Mars' },
  { name: 'Sagittarius', lord: 'Jupiter' },
  { name: 'Capricorn', lord: 'Saturn' },
  { name: 'Aquarius', lord: 'Saturn' },
  { name: 'Pisces', lord: 'Jupiter' },
];

export const VIMSHOTTARI_LORDS: KPPlanetLord[] = [
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
];

export const VIMSHOTTARI_YEARS: Record<KPPlanetLord, number> = {
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

export const TOTAL_VIMSHOTTARI_YEARS = 120;

export const NAKSHATRAS: Array<{ name: string; lord: KPPlanetLord }> = [
  { name: 'Ashwini', lord: 'Ketu' },
  { name: 'Bharani', lord: 'Venus' },
  { name: 'Krittika', lord: 'Sun' },
  { name: 'Rohini', lord: 'Moon' },
  { name: 'Mrigashira', lord: 'Mars' },
  { name: 'Ardra', lord: 'Rahu' },
  { name: 'Punarvasu', lord: 'Jupiter' },
  { name: 'Pushya', lord: 'Saturn' },
  { name: 'Ashlesha', lord: 'Mercury' },
  { name: 'Magha', lord: 'Ketu' },
  { name: 'Purva Phalguni', lord: 'Venus' },
  { name: 'Uttara Phalguni', lord: 'Sun' },
  { name: 'Hasta', lord: 'Moon' },
  { name: 'Chitra', lord: 'Mars' },
  { name: 'Swati', lord: 'Rahu' },
  { name: 'Vishakha', lord: 'Jupiter' },
  { name: 'Anuradha', lord: 'Saturn' },
  { name: 'Jyeshtha', lord: 'Mercury' },
  { name: 'Mula', lord: 'Ketu' },
  { name: 'Purva Ashadha', lord: 'Venus' },
  { name: 'Uttara Ashadha', lord: 'Sun' },
  { name: 'Shravana', lord: 'Moon' },
  { name: 'Dhanishta', lord: 'Mars' },
  { name: 'Shatabhisha', lord: 'Rahu' },
  { name: 'Purva Bhadrapada', lord: 'Jupiter' },
  { name: 'Uttara Bhadrapada', lord: 'Saturn' },
  { name: 'Revati', lord: 'Mercury' },
];

export const NAKSHATRA_SPAN_DEG = 360 / 27; // 13°20' = 13.333333333333334°

/**
 * Returns the sign, star, sub, and sub-sub lord for any given sidereal longitude.
 *
 * @param siderealLon - Sidereal longitude in degrees (0-360)
 * @param boundaryThresholdArcsec - Distance in arcsec to consider near a sub boundary (default: 60 arcsec = 1 arcminute)
 */
export function calculateKpLords(
  siderealLon: number,
  boundaryThresholdArcsec = 60
): KpLords {
  const lon = ((siderealLon % 360) + 360) % 360;

  // 1. Sign
  const signIndex = Math.floor(lon / 30);
  const signInfo = ZODIAC_SIGNS[signIndex];

  // 2. Nakshatra (Star)
  const nakshatraIndex = Math.floor(lon / NAKSHATRA_SPAN_DEG);
  const nakshatraInfo = NAKSHATRAS[nakshatraIndex];
  const nakshatraStart = nakshatraIndex * NAKSHATRA_SPAN_DEG;
  const posInNakshatra = lon - nakshatraStart;

  // 3. Sub Lord
  // Sub division starts with the nakshatra's lord and cycles through the 9 Vimshottari lords
  const starLordIndex = VIMSHOTTARI_LORDS.indexOf(nakshatraInfo.lord);

  let accumulatedSubSpan = 0;
  let subLord: KPPlanetLord = nakshatraInfo.lord;
  let subSpanStart = nakshatraStart;
  let subSpanEnd = nakshatraStart + NAKSHATRA_SPAN_DEG;
  let currentSubSpan = 0;

  for (let i = 0; i < 9; i++) {
    const candidateLord =
      VIMSHOTTARI_LORDS[(starLordIndex + i) % VIMSHOTTARI_LORDS.length];
    const lordYears = VIMSHOTTARI_YEARS[candidateLord];
    const span = (lordYears / TOTAL_VIMSHOTTARI_YEARS) * NAKSHATRA_SPAN_DEG;

    const isLast = i === 8;
    if (
      posInNakshatra >= accumulatedSubSpan - 1e-11 &&
      (posInNakshatra < accumulatedSubSpan + span - 1e-11 || isLast)
    ) {
      subLord = candidateLord;
      subSpanStart = nakshatraStart + accumulatedSubSpan;
      subSpanEnd = subSpanStart + span;
      currentSubSpan = span;
      break;
    }
    accumulatedSubSpan += span;
  }

  // 4. Sub-Sub Lord
  // Sub-sub division starts with the sub-lord itself and cycles through the 9 Vimshottari lords
  const subLordIndex = VIMSHOTTARI_LORDS.indexOf(subLord);
  const posInSub = lon - subSpanStart;

  let accumulatedSubSubSpan = 0;
  let subSubLord: KPPlanetLord = subLord;

  for (let j = 0; j < 9; j++) {
    const candidateSubSubLord =
      VIMSHOTTARI_LORDS[(subLordIndex + j) % VIMSHOTTARI_LORDS.length];
    const ssYears = VIMSHOTTARI_YEARS[candidateSubSubLord];
    const ssSpan = (ssYears / TOTAL_VIMSHOTTARI_YEARS) * currentSubSpan;

    const isLastSs = j === 8;
    if (
      posInSub >= accumulatedSubSubSpan - 1e-11 &&
      (posInSub < accumulatedSubSubSpan + ssSpan - 1e-11 || isLastSs)
    ) {
      subSubLord = candidateSubSubLord;
      break;
    }
    accumulatedSubSubSpan += ssSpan;
  }

  // Boundary proximity check
  const distFromStart = (lon - subSpanStart) * 3600;
  const distToEnd = (subSpanEnd - lon) * 3600;
  const isNearSubBoundary =
    distFromStart < boundaryThresholdArcsec ||
    distToEnd < boundaryThresholdArcsec;

  return {
    signIndex,
    signName: signInfo.name,
    signLord: signInfo.lord,
    nakshatraIndex,
    nakshatraName: nakshatraInfo.name,
    nakshatraNumber: nakshatraIndex + 1,
    starLord: nakshatraInfo.lord,
    subLord,
    subSubLord,
    subSpanStart,
    subSpanEnd,
    distanceFromSubStartArcsec: Math.max(0, distFromStart),
    distanceToSubEndArcsec: Math.max(0, distToEnd),
    isNearSubBoundary,
  };
}
