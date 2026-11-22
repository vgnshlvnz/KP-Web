/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import fixtureText from './fixtures/kp-horary-249.csv?raw';
import {
  getPositionLords,
  getHorary249Table,
  getHoraryEntry,
  VIMSHOTTARI_LORDS,
  DASHA_YEARS,
  ZODIAC_SIGNS,
} from '../src/engine/kp-lords.js';
import type { KPPlanetLord } from '../src/engine/types.js';

/**
 * Row-by-row reference check of the 1-249 table (work package #4, criterion 5).
 *
 * Reference: `test/fixtures/kp-horary-249.csv`, the standard KP table copied from
 * https://kpastrologypro.com/kp-horary-numbers-1-249 on 2026-11-22 by an automated fetch (not hand
 * proofread). The page writes the end of a sign as `0:00:00` in rows 22, 62, 83 and 105 and as
 * `30:00:00` elsewhere; `parseFixture` reads `0:00:00` in an end column as 30:00:00 of the same sign.
 * Nothing in the fixture is derived from the engine, so it is an independent check of
 * `src/engine/kp-lords.ts`. All comparisons below use whole arcseconds taken from the fixture.
 */

const ARCSEC_PER_SIGN = 30 * 3600;
const SIGN_NAMES = ZODIAC_SIGNS.map((s) => s.name);

interface RefRow {
  number: number;
  sign: string;
  signIndex: number;
  /** Absolute start and end, arcseconds from 0 Aries. */
  start: number;
  end: number;
  starLord: KPPlanetLord;
  subLord: KPPlanetLord;
}

function dmsToArcsec(text: string): number {
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) throw new Error(`bad D:MM:SS value: ${text}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function parseFixture(): RefRow[] {
  const lines = fixtureText
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '' && !l.startsWith('#'));
  expect(lines[0]).toBe('number,sign,start_dms_in_sign,end_dms_in_sign,star_lord,sub_lord');
  return lines.slice(1).map((line) => {
    const [number, sign, startText, endText, star, sub] = line.split(',');
    const signIndex = SIGN_NAMES.indexOf(sign);
    if (signIndex < 0) throw new Error(`unknown sign in fixture: ${sign}`);
    let endInSign = dmsToArcsec(endText);
    if (endInSign === 0) endInSign = ARCSEC_PER_SIGN; // end-of-sign convention, see header
    return {
      number: Number(number),
      sign,
      signIndex,
      start: signIndex * ARCSEC_PER_SIGN + dmsToArcsec(startText),
      end: signIndex * ARCSEC_PER_SIGN + endInSign,
      starLord: star as KPPlanetLord,
      subLord: sub as KPPlanetLord,
    };
  });
}

const REF = parseFixture();

/** Independent lookup in the fixture: the row that contains this longitude (degrees). */
function refRowAt(lonDeg: number): RefRow {
  const lon = ((lonDeg % 360) + 360) % 360;
  const arcsec = lon * 3600;
  const row = REF.find((r) => arcsec >= r.start && arcsec < r.end);
  if (!row) throw new Error(`no fixture row for ${lonDeg}`);
  return row;
}

describe('fixture sanity (so a bad transcription cannot hide behind the engine)', () => {
  it('has 249 rows numbered 1..249 that tile 0..360 degrees with no gap or overlap', () => {
    expect(REF).toHaveLength(249);
    REF.forEach((r, i) => {
      expect(r.number).toBe(i + 1);
      expect(r.end).toBeGreaterThan(r.start);
      if (i > 0) expect(r.start).toBe(REF[i - 1].end);
    });
    expect(REF[0].start).toBe(0);
    expect(REF[248].end).toBe(360 * 3600);
  });

  it('every in-sign value is a multiple of 20 arcseconds (the unit of a Vimshottari sub)', () => {
    for (const r of REF) {
      expect(r.start % 20).toBe(0);
      expect(r.end % 20).toBe(0);
    }
  });

  it('each row spans its sub-lord years: 14,400 units per star, sub = years x 120 units of 1/1080 degree', () => {
    // A sub that is split by a sign boundary is two consecutive rows with the same star and sub lord.
    // Merge those, then each merged sub must be exactly (years x 120) x 3.333... arcsec = years x 400 arcsec.
    const merged: Array<{ star: KPPlanetLord; sub: KPPlanetLord; start: number; end: number }> = [];
    for (const r of REF) {
      const last = merged[merged.length - 1];
      if (last && last.star === r.starLord && last.sub === r.subLord && last.end === r.start) {
        last.end = r.end;
      } else {
        merged.push({ star: r.starLord, sub: r.subLord, start: r.start, end: r.end });
      }
    }
    expect(merged).toHaveLength(243);
    for (const m of merged) {
      expect(m.end - m.start).toBe(DASHA_YEARS[m.sub] * 400);
    }
  });
});

describe('249-row comparison with the engine table', () => {
  const table = getHorary249Table();

  it.each(REF.map((r) => [r.number, r] as const))('row %i matches getHorary249Table()', (_n, r) => {
    const e = table[r.number - 1];
    expect(e.number).toBe(r.number);
    expect(e.signName).toBe(r.sign);
    expect(Math.round(e.startLongitude * 3600)).toBe(r.start);
    expect(Math.round(e.endLongitude * 3600)).toBe(r.end);
    expect(e.starLord).toBe(r.starLord);
    expect(e.subLord).toBe(r.subLord);
    // The engine's own float values sit on the arcsecond grid to within rounding noise.
    expect(Math.abs(e.startLongitude * 3600 - r.start)).toBeLessThan(1e-6);
    expect(Math.abs(e.endLongitude * 3600 - r.end)).toBeLessThan(1e-6);
    expect(getHoraryEntry(r.number)).toBe(e);
  });

  it.each(REF.map((r) => [r.number, r] as const))(
    'row %i: getPositionLords at its midpoint gives the same sign, star, sub and number',
    (_n, r) => {
      const l = getPositionLords((r.start + r.end) / 2 / 3600);
      expect(l.horary249Number).toBe(r.number);
      expect(l.signName).toBe(r.sign);
      expect(l.starLord).toBe(r.starLord);
      expect(l.subLord).toBe(r.subLord);
    }
  );
});

describe('the six sign-boundary splits', () => {
  // [first row, second row, sign boundary in degrees]
  const SPLITS: Array<[number, number, number]> = [
    [22, 23, 30],
    [62, 63, 90],
    [105, 106, 150],
    [145, 146, 210],
    [188, 189, 270],
    [228, 229, 330],
  ];

  it('the fixture has these six and only these (same star and sub lord on both sides of a sign edge)', () => {
    const found: Array<[number, number]> = [];
    for (let i = 1; i < REF.length; i++) {
      if (
        REF[i].signIndex !== REF[i - 1].signIndex &&
        REF[i].starLord === REF[i - 1].starLord &&
        REF[i].subLord === REF[i - 1].subLord
      ) {
        found.push([REF[i - 1].number, REF[i].number]);
      }
    }
    expect(found).toEqual(SPLITS.map(([a, b]) => [a, b]));
  });

  it.each(SPLITS)('rows %i/%i split one sub at %i degrees', (a, b, boundaryDeg) => {
    const ea = getHoraryEntry(a);
    const eb = getHoraryEntry(b);
    expect(ea.endLongitude).toBe(boundaryDeg);
    expect(eb.startLongitude).toBe(boundaryDeg);
    expect(ea.starName).toBe(eb.starName);
    expect(ea.subLord).toBe(eb.subLord);
    expect(eb.signIndex).toBe(ea.signIndex + 1);
    // Both halves together are the full sub: years x 400 arcsec.
    const span = (eb.endLongitude - ea.startLongitude) * 3600;
    expect(span).toBeCloseTo(DASHA_YEARS[ea.subLord] * 400, 6);
    // Just either side of the boundary the engine reports the two numbers.
    expect(getPositionLords(boundaryDeg - 1e-6).horary249Number).toBe(a);
    expect(getPositionLords(boundaryDeg).horary249Number).toBe(b);
    expect(getPositionLords(boundaryDeg - 1e-6).subLord).toBe(getPositionLords(boundaryDeg).subLord);
  });
});

describe('samples either side of every boundary (+/- 1 arcsec and +/- 1e-6 degree)', () => {
  // Boundaries are the 249 row starts plus 360. Expected values come from the fixture only.
  const boundaries = [...REF.map((r) => r.start), 360 * 3600];
  const OFFSETS_DEG = [1 / 3600, 1e-6];

  function check(lon: number, label: string, bad: string[]) {
    const ref = refRowAt(lon);
    const l = getPositionLords(lon);
    const got = `${l.horary249Number}/${l.signName}/${l.starLord}/${l.subLord}`;
    const want = `${ref.number}/${ref.sign}/${ref.starLord}/${ref.subLord}`;
    if (got !== want) bad.push(`${label} lon=${lon}: got ${got}, want ${want}`);
  }

  it('every sub, sign and nakshatra boundary: the value just after is the new row, just before the previous row', () => {
    const bad: string[] = [];
    for (const b of boundaries) {
      const deg = b / 3600;
      for (const off of OFFSETS_DEG) {
        check(deg + off, `after +${off}`, bad);
        check(deg - off, `before -${off}`, bad);
      }
    }
    expect(bad).toEqual([]);
  });

  it('wraps at 0/360: 360 degrees is 0 Aries (row 1), 360 - epsilon is row 249', () => {
    expect(getPositionLords(360).horary249Number).toBe(1);
    expect(getPositionLords(0).horary249Number).toBe(1);
    expect(getPositionLords(360 - 1e-6).horary249Number).toBe(249);
    expect(getPositionLords(360 - 1 / 3600).horary249Number).toBe(249);
    expect(getPositionLords(360 + 1 / 3600).horary249Number).toBe(1);
    expect(getPositionLords(-1e-6).horary249Number).toBe(249);
    expect(getPositionLords(360 - 1e-6).signName).toBe('Pisces');
    expect(getPositionLords(360 - 1e-6).starLord).toBe('Mercury'); // Revati
    expect(getPositionLords(360).starLord).toBe('Ketu'); // Ashwini
  });

  it('sign edges at exact multiples of 30 degrees change the sign and sign lord, not the earlier star/sub when the sub is split', () => {
    for (let s = 1; s < 12; s++) {
      const after = getPositionLords(s * 30);
      const before = getPositionLords(s * 30 - 1e-6);
      expect(after.signName).toBe(SIGN_NAMES[s]);
      expect(after.signLord).toBe(ZODIAC_SIGNS[s].lord);
      expect(before.signName).toBe(SIGN_NAMES[s - 1]);
      expect(before.signLord).toBe(ZODIAC_SIGNS[s - 1].lord);
    }
  });

  it('nakshatra edges: the star number and lord change there, and the first sub is the own-lord sub', () => {
    // Nakshatra k starts at k x 13°20' = k x 48,000 arcsec; the lord sequence repeats every 9 stars.
    const bad: string[] = [];
    for (let k = 0; k < 27; k++) {
      const startArcsec = k * 48000;
      const lordIdx = k % 9;
      const after = getPositionLords((startArcsec + 1) / 3600);
      expect(after.starNumber).toBe(k + 1);
      expect(after.starLord).toBe(VIMSHOTTARI_LORDS[lordIdx]);
      // The first sub of a nakshatra is the star lord's own sub.
      if (after.subLord !== VIMSHOTTARI_LORDS[lordIdx]) bad.push(`star ${k + 1} first sub ${after.subLord}`);
      if (k > 0) {
        const before = getPositionLords((startArcsec - 1) / 3600);
        expect(before.starNumber).toBe(k);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('sub-sub lords follow the Vimshottari proportions inside each sub (criterion 2)', () => {
  /**
   * Arithmetic (all spans in arcseconds): a sub with lord L spans years(L) x 400". Inside it the
   * nine sub-sub lords run in dasha order starting from L, each taking years(SL)/120 of the sub, so
   * a sub-sub has width years(L) x years(SL) x 400/120 = years(L) x years(SL) x 10/3 arcsec.
   * Sub spans come from the fixture, not from the engine.
   */
  interface Sub {
    star: KPPlanetLord;
    sub: KPPlanetLord;
    start: number;
    end: number;
  }
  const subs: Sub[] = [];
  for (const r of REF) {
    const last = subs[subs.length - 1];
    if (last && last.star === r.starLord && last.sub === r.subLord && last.end === r.start) {
      last.end = r.end;
    } else {
      subs.push({ star: r.starLord, sub: r.subLord, start: r.start, end: r.end });
    }
  }

  function subSubSpans(sub: Sub): Array<{ lord: KPPlanetLord; start: number; end: number }> {
    const idx = VIMSHOTTARI_LORDS.indexOf(sub.sub);
    const width = sub.end - sub.start;
    let cum = 0;
    return Array.from({ length: 9 }, (_, j) => {
      const lord = VIMSHOTTARI_LORDS[(idx + j) % 9];
      const start = sub.start + (width * cum) / 120;
      cum += DASHA_YEARS[lord];
      return { lord, start, end: sub.start + (width * cum) / 120 };
    });
  }

  it('has 243 subs whose sub-sub widths add up to the sub width', () => {
    expect(subs).toHaveLength(243);
    for (const s of subs) {
      const spans = subSubSpans(s);
      expect(spans[0].lord).toBe(s.sub);
      expect(spans[8].end).toBeCloseTo(s.end, 9);
    }
  });

  it('in all 243 x 9 sub-sub spans: the engine gives the derived lord at the midpoint, and 1 arcsec inside each edge', () => {
    const bad: string[] = [];
    for (const s of subs) {
      for (const ss of subSubSpans(s)) {
        const probes: Array<[string, number]> = [
          ['mid', (ss.start + ss.end) / 2],
          ['start+1"', ss.start + 1],
          ['end-1"', ss.end - 1],
        ];
        for (const [label, arcsec] of probes) {
          const l = getPositionLords(arcsec / 3600);
          if (l.starLord !== s.star || l.subLord !== s.sub || l.subSubLord !== ss.lord) {
            bad.push(
              `${s.star}/${s.sub} sub-sub ${ss.lord} @${label}: got ${l.starLord}/${l.subLord}/${l.subSubLord}`
            );
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('1 arcsec outside a sub-sub edge gives the neighbouring sub-sub', () => {
    const bad: string[] = [];
    for (const s of subs) {
      const spans = subSubSpans(s);
      spans.forEach((ss, j) => {
        if (j === 0) return;
        const prev = spans[j - 1];
        const l = getPositionLords((ss.start - 1) / 3600);
        if (l.subLord !== s.sub || l.subSubLord !== prev.lord) {
          bad.push(`${s.star}/${s.sub}: before ${ss.lord} start got ${l.subLord}/${l.subSubLord}, want ${prev.lord}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  // Hand-derived spot values (arcsec from the start of the sub), written out so a reader can check them.
  it('Ashwini, Ketu sub (row 1, 0:00:00 to 0:46:40 = 2,800"): Ketu-Ketu ends at 163.33", Ketu-Venus at 630"', () => {
    // Ketu 7y of 120y x 2,800" = 163.333"; Venus 20y: (7+20)/120 x 2,800" = 630" = 0:10:30.
    expect(getPositionLords(163 / 3600).subSubLord).toBe('Ketu');
    expect(getPositionLords(164 / 3600).subSubLord).toBe('Venus');
    expect(getPositionLords(629 / 3600).subSubLord).toBe('Venus');
    expect(getPositionLords(631 / 3600).subSubLord).toBe('Sun');
    // Mercury (17y) is last: the last sub-sub starts at (120-17)/120 x 2,800" = 2,403.33".
    expect(getPositionLords(2403 / 3600).subSubLord).toBe('Saturn');
    expect(getPositionLords(2404 / 3600).subSubLord).toBe('Mercury');
    expect(getPositionLords(2799 / 3600).subSubLord).toBe('Mercury');
  });

  it('Ashwini, Venus sub (row 2 starts at 0:46:40, 8,000"): sub-sub order Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury, Ketu', () => {
    // Order starts from the sub lord (Venus) and runs in dasha order, wrapping to Ketu last.
    const startArcsec = 2800;
    const widthArcsec = 8000;
    const order: KPPlanetLord[] = ['Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury', 'Ketu'];
    let cum = 0;
    for (const lord of order) {
      const mid = startArcsec + (widthArcsec * (cum + DASHA_YEARS[lord] / 2)) / 120;
      expect(getPositionLords(mid / 3600).subSubLord).toBe(lord);
      cum += DASHA_YEARS[lord];
    }
    expect(cum).toBe(120);
    // Venus-Venus is 20/120 x 8,000" = 1,333.33" wide.
    expect(getPositionLords((startArcsec + 1333) / 3600).subSubLord).toBe('Venus');
    expect(getPositionLords((startArcsec + 1334) / 3600).subSubLord).toBe('Sun');
  });
});
