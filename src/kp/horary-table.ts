/**
 * KP Horary 1–249 Table Module.
 *
 * Implements the standard Krishnamurti Paddhati 1–249 Horary Table.
 * Each of the 243 nakshatra subs is mapped, and the 6 subs that cross
 * sign boundaries are split, yielding the canonical 249 sub entries.
 */

import { HoraryTableEntry, KPPlanetLord } from '../types.js';
import { formatDms } from '../ephemeris/ayanamsa.js';
import {
  NAKSHATRAS,
  NAKSHATRA_SPAN_DEG,
  TOTAL_VIMSHOTTARI_YEARS,
  VIMSHOTTARI_LORDS,
  VIMSHOTTARI_YEARS,
  ZODIAC_SIGNS,
} from './sub-lords.js';

let cachedHoraryTable: HoraryTableEntry[] | null = null;

/**
 * Builds and returns the complete 1–249 KP Horary Table.
 */
export function getHoraryTable(): HoraryTableEntry[] {
  if (cachedHoraryTable) {
    return cachedHoraryTable;
  }

  const table: HoraryTableEntry[] = [];
  let horaryNum = 1;

  for (let nakIdx = 0; nakIdx < 27; nakIdx++) {
    const nak = NAKSHATRAS[nakIdx];
    const nakStart = nakIdx * NAKSHATRA_SPAN_DEG;
    const starLordIndex = VIMSHOTTARI_LORDS.indexOf(nak.lord);
    let accumulated = 0;

    for (let s = 0; s < 9; s++) {
      const subLord = VIMSHOTTARI_LORDS[(starLordIndex + s) % 9];
      const span =
        (VIMSHOTTARI_YEARS[subLord] / TOTAL_VIMSHOTTARI_YEARS) *
        NAKSHATRA_SPAN_DEG;
      const subStart = nakStart + accumulated;
      const subEnd = subStart + span;

      const signStartIdx = Math.floor(subStart / 30);
      const signEndIdx = Math.floor((subEnd - 1e-10) / 30);

      if (signStartIdx !== signEndIdx) {
        // Sub crosses a 30-degree sign boundary (e.g. 30°, 60°, 150°, etc.)
        const boundary = signEndIdx * 30;

        // Part 1: in preceding sign
        table.push({
          horaryNumber: horaryNum++,
          signName: ZODIAC_SIGNS[signStartIdx].name,
          signLord: ZODIAC_SIGNS[signStartIdx].lord,
          nakshatraNumber: nakIdx + 1,
          nakshatraName: nak.name,
          starLord: nak.lord,
          subLord,
          startLongitude: subStart,
          endLongitude: boundary,
          startDms: formatDms(subStart),
          endDms: formatDms(boundary),
        });

        // Part 2: in succeeding sign
        table.push({
          horaryNumber: horaryNum++,
          signName: ZODIAC_SIGNS[signEndIdx].name,
          signLord: ZODIAC_SIGNS[signEndIdx].lord,
          nakshatraNumber: nakIdx + 1,
          nakshatraName: nak.name,
          starLord: nak.lord,
          subLord,
          startLongitude: boundary,
          endLongitude: subEnd,
          startDms: formatDms(boundary),
          endDms: formatDms(subEnd),
        });
      } else {
        table.push({
          horaryNumber: horaryNum++,
          signName: ZODIAC_SIGNS[signStartIdx].name,
          signLord: ZODIAC_SIGNS[signStartIdx].lord,
          nakshatraNumber: nakIdx + 1,
          nakshatraName: nak.name,
          starLord: nak.lord,
          subLord,
          startLongitude: subStart,
          endLongitude: subEnd,
          startDms: formatDms(subStart),
          endDms: formatDms(subEnd),
        });
      }

      accumulated += span;
    }
  }

  cachedHoraryTable = table;
  return table;
}

/**
 * Returns a specific horary table entry by number (1 to 249).
 */
export function getHoraryEntry(num: number): HoraryTableEntry {
  if (num < 1 || num > 249 || !Number.isInteger(num)) {
    throw new Error(`Horary number must be an integer between 1 and 249. Received: ${num}`);
  }
  return getHoraryTable()[num - 1];
}
