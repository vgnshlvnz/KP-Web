/**
 * Vimshottari Dasha Calculation Module.
 *
 * Computes Dasha, Bhukti, and Antara timelines based on the Moon's sidereal longitude.
 */

import { DashaPeriod, KPPlanetLord } from '../types.js';
import {
  NAKSHATRAS,
  NAKSHATRA_SPAN_DEG,
  TOTAL_VIMSHOTTARI_YEARS,
  VIMSHOTTARI_LORDS,
  VIMSHOTTARI_YEARS,
} from './sub-lords.js';

const DAYS_PER_YEAR = 365.2425;

/**
 * Computes the Vimshottari Dasha balance and timeline down to Antara.
 *
 * @param moonSiderealLon - Moon's sidereal longitude in degrees (0-360)
 * @param birthDateUtc - Birth or question UTC Date
 * @param numCycles - Number of major dasha cycles to generate (default: 9, covering full 120 years)
 */
export function calculateVimshottariDasha(
  moonSiderealLon: number,
  birthDateUtc: Date,
  numCycles = 9
): {
  birthStar: string;
  dashaLord: KPPlanetLord;
  balanceYears: number;
  balanceMonths: number;
  balanceDays: number;
  dashaTimeline: DashaPeriod[];
} {
  const lon = ((moonSiderealLon % 360) + 360) % 360;
  const nakIdx = Math.floor(lon / NAKSHATRA_SPAN_DEG);
  const nak = NAKSHATRAS[nakIdx];
  const posInNak = lon - nakIdx * NAKSHATRA_SPAN_DEG;

  const fractionTraversed = posInNak / NAKSHATRA_SPAN_DEG;
  const fractionRemaining = 1 - fractionTraversed;

  const birthLord = nak.lord;
  const birthLordTotalYears = VIMSHOTTARI_YEARS[birthLord];
  const balanceTotalYears = birthLordTotalYears * fractionRemaining;

  const balanceYears = Math.floor(balanceTotalYears);
  const remMonths = (balanceTotalYears - balanceYears) * 12;
  const balanceMonths = Math.floor(remMonths);
  const balanceDays = Math.round((remMonths - balanceMonths) * 30.4375);

  // Generate timeline
  const startIndex = VIMSHOTTARI_LORDS.indexOf(birthLord);
  const timeline: DashaPeriod[] = [];

  let currentDate = new Date(birthDateUtc.getTime());

  for (let i = 0; i < numCycles; i++) {
    const dashaLord =
      VIMSHOTTARI_LORDS[(startIndex + i) % VIMSHOTTARI_LORDS.length];
    const totalDashaYears = VIMSHOTTARI_YEARS[dashaLord];

    // For first dasha, only the remaining balance is active
    const effectiveYears = i === 0 ? balanceTotalYears : totalDashaYears;
    const durationDays = effectiveYears * DAYS_PER_YEAR;

    const dashaStartDate = new Date(currentDate.getTime());
    const dashaEndDate = new Date(
      currentDate.getTime() + durationDays * 86400 * 1000
    );

    // Compute Bhuktis (sub-periods)
    const bhuktis: DashaPeriod[] = [];
    const bhuktiStartIndex = VIMSHOTTARI_LORDS.indexOf(dashaLord);

    let bhuktiCurrDate = new Date(dashaStartDate.getTime());

    for (let b = 0; b < 9; b++) {
      const bhuktiLord =
        VIMSHOTTARI_LORDS[(bhuktiStartIndex + b) % VIMSHOTTARI_LORDS.length];
      const bhuktiYears =
        (totalDashaYears * VIMSHOTTARI_YEARS[bhuktiLord]) /
        TOTAL_VIMSHOTTARI_YEARS;

      // Adjust for first dasha fraction
      const effectiveBhuktiYears =
        i === 0
          ? (bhuktiYears * balanceTotalYears) / totalDashaYears
          : bhuktiYears;
      const bhuktiDays = effectiveBhuktiYears * DAYS_PER_YEAR;

      const bhuktiStart = new Date(bhuktiCurrDate.getTime());
      const bhuktiEnd = new Date(
        bhuktiCurrDate.getTime() + bhuktiDays * 86400 * 1000
      );

      // Compute Antaras (sub-sub-periods)
      const antaras: DashaPeriod[] = [];
      const antaraStartIndex = VIMSHOTTARI_LORDS.indexOf(bhuktiLord);

      let antaraCurrDate = new Date(bhuktiStart.getTime());

      for (let a = 0; a < 9; a++) {
        const antaraLord =
          VIMSHOTTARI_LORDS[(antaraStartIndex + a) % VIMSHOTTARI_LORDS.length];
        const antaraDays =
          (bhuktiDays * VIMSHOTTARI_YEARS[antaraLord]) /
          TOTAL_VIMSHOTTARI_YEARS;

        const antaraStart = new Date(antaraCurrDate.getTime());
        const antaraEnd = new Date(
          antaraCurrDate.getTime() + antaraDays * 86400 * 1000
        );

        antaras.push({
          lord: antaraLord,
          level: 'antara',
          startDate: antaraStart.toISOString().slice(0, 10),
          endDate: antaraEnd.toISOString().slice(0, 10),
          durationDays: Math.round(antaraDays),
        });

        antaraCurrDate = antaraEnd;
      }

      bhuktis.push({
        lord: bhuktiLord,
        level: 'bhukti',
        startDate: bhuktiStart.toISOString().slice(0, 10),
        endDate: bhuktiEnd.toISOString().slice(0, 10),
        durationDays: Math.round(bhuktiDays),
        subPeriods: antaras,
      });

      bhuktiCurrDate = bhuktiEnd;
    }

    timeline.push({
      lord: dashaLord,
      level: 'dasha',
      startDate: dashaStartDate.toISOString().slice(0, 10),
      endDate: dashaEndDate.toISOString().slice(0, 10),
      durationDays: Math.round(durationDays),
      subPeriods: bhuktis,
    });

    currentDate = dashaEndDate;
  }

  return {
    birthStar: nak.name,
    dashaLord: birthLord,
    balanceYears,
    balanceMonths,
    balanceDays,
    dashaTimeline: timeline,
  };
}
