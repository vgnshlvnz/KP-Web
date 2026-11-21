import { describe, it, expect } from 'vitest';
import {
  calculateVimshottariDasha,
  getBhuktiYears,
  getDashaAtBirth,
} from '../src/engine/dasha.js';
import { DASHA_YEARS, TOTAL_DASHA_YEARS, VIMSHOTTARI_LORDS } from '../src/engine/kp-lords.js';
import type { DashaPeriod, KPPlanetLord } from '../src/engine/types.js';

/**
 * Reference values: docs/build-fix/audit.md Appendix A.7 (Swiss Ephemeris 2.10.03, KP Old Moon).
 * Moon longitudes are the KP Old column of A.1 to A.5.
 *
 * Days per year: the A.7 values are in YEARS (exact 120-year proportions), so they assume NO
 * days-per-year value and `getDashaAtBirth` takes none. Only the dated timeline needs one.
 * TODO(#29 Q9): owner has not chosen it. Stack B used 365.2425; the tests below pass both
 * 365.2425 and 365.25 explicitly and check that years-based results do not depend on it.
 */
const TOL_YEARS = 1e-6;

interface Case {
  id: string;
  birthUtc: Date;
  moonKpOld: number;
  dasha: KPPlanetLord;
  balance: number;
  bhukti: KPPlanetLord;
  bhuktiLeft: number;
}

const CASES: Case[] = [
  {
    id: 'kl1992',
    birthUtc: new Date('1992-03-10T22:14:00Z'),
    moonKpOld: 42.0295069,
    dasha: 'Moon',
    balance: 8.47787,
    bhukti: 'Rahu',
    bhuktiLeft: 1.394536,
  },
  {
    id: 'gw2000',
    birthUtc: new Date('2000-01-01T12:00:00Z'),
    moonKpOld: 199.5673813,
    dasha: 'Rahu',
    balance: 0.584035,
    bhukti: 'Mars',
    bhuktiLeft: 0.584035,
  },
  {
    id: 'chn1950',
    birthUtc: new Date('1950-06-15T18:29:30Z'),
    moonKpOld: 62.2216636,
    dasha: 'Mars',
    balance: 2.333627,
    bhukti: 'Ketu',
    bhuktiLeft: 0.233627,
  },
  {
    id: 'pj2026',
    birthUtc: new Date('2026-11-21T01:00:00Z'),
    moonKpOld: 346.5658552,
    dasha: 'Saturn',
    balance: 0.143656,
    bhukti: 'Jupiter',
    bhuktiLeft: 0.143656,
  },
  {
    id: 'tromso2010',
    birthUtc: new Date('2010-12-21T03:00:00Z'),
    moonKpOld: 62.4477699,
    dasha: 'Mars',
    balance: 2.214921,
    bhukti: 'Ketu',
    bhuktiLeft: 0.114921,
  },
];

const YEAR_DAYS = [365.2425, 365.25];
const MS_PER_DAY = 86_400_000;
const day = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY;

describe('Vimshottari dasha at birth (Appendix A.7, regression for #37)', () => {
  for (const c of CASES) {
    it(`${c.id}: ${c.dasha} dasha, balance ${c.balance} y, running bhukti ${c.bhukti} with ${c.bhuktiLeft} y left`, () => {
      const r = getDashaAtBirth(c.moonKpOld);
      expect(r.dashaLord).toBe(c.dasha);
      expect(Math.abs(r.balanceYears - c.balance)).toBeLessThan(TOL_YEARS);
      expect(r.running.bhukti.lord).toBe(c.bhukti);
      expect(Math.abs(r.running.bhukti.yearsLeft - c.bhuktiLeft)).toBeLessThan(TOL_YEARS);
    });
  }

  it('running antara is the tail of the running bhukti and never longer than what is left', () => {
    for (const c of CASES) {
      const { running } = getDashaAtBirth(c.moonKpOld);
      expect(running.antara.yearsLeft).toBeGreaterThan(0);
      expect(running.antara.yearsLeft).toBeLessThanOrEqual(running.antara.fullYears + 1e-12);
      expect(running.antara.yearsLeft).toBeLessThanOrEqual(running.bhukti.yearsLeft + 1e-12);
      expect(running.bhukti.yearsLeft).toBeLessThanOrEqual(running.bhukti.fullYears + 1e-12);
      expect(running.bhukti.yearsLeft).toBeLessThanOrEqual(running.dasha.yearsLeft + 1e-12);
    }
  });

  it('KL 1992 running antara, worked by hand', () => {
    // Moon dasha 10 y; elapsed 10 - 8.47787 = 1.52213 y. Moon bhuktis (y): Moon 0.8333, Mars 0.5833,
    // Rahu 1.5; Moon+Mars = 1.41667, so Rahu runs from 1.41667 to 2.91667 and 1.39454 y are left.
    // Elapsed inside Rahu = 1.5 - 1.394536 = 0.105464 y. Rahu-Rahu antara is 1.5 * 18 / 120 = 0.225 y,
    // so it is still running, with 0.225 - 0.105464 = 0.119536 y left.
    const r = getDashaAtBirth(42.0295069).running;
    expect(r.bhukti.lord).toBe('Rahu');
    expect(r.antara.lord).toBe('Rahu');
    expect(Math.abs(r.antara.fullYears - (1.5 * 18) / 120)).toBeLessThan(1e-12);
    expect(Math.abs(r.antara.yearsLeft - 0.119536)).toBeLessThan(TOL_YEARS);
  });

  it('wraps the longitude (x + 360 and x - 360 give the same result as x)', () => {
    const a = getDashaAtBirth(42.0295069);
    expect(getDashaAtBirth(42.0295069 + 360)).toEqual(a);
    expect(getDashaAtBirth(42.0295069 - 360).balanceYears).toBeCloseTo(a.balanceYears, 9);
  });

  it('Moon at 0 deg: full Ketu dasha, Ketu-Ketu-Ketu running from the start', () => {
    const r = getDashaAtBirth(0);
    expect(r.birthStar).toBe('Ashwini');
    expect(r.dashaLord).toBe('Ketu');
    expect(r.balanceYears).toBeCloseTo(7, 12);
    expect(r.running.bhukti.lord).toBe('Ketu');
    expect(r.running.bhukti.yearsLeft).toBeCloseTo(7 * (7 / 120), 12);
    expect(r.running.antara.lord).toBe('Ketu');
  });

  it('Moon just before 360: last nakshatra (Revati, Mercury), almost no balance, no zero-length bhukti', () => {
    const r = getDashaAtBirth(359.9999999);
    expect(r.birthStar).toBe('Revati');
    expect(r.dashaLord).toBe('Mercury');
    expect(r.balanceYears).toBeGreaterThan(0);
    // Mercury bhuktis end with Saturn, and Saturn antaras (starting Saturn) end with Jupiter.
    expect(r.running.bhukti.lord).toBe('Saturn');
    expect(r.running.antara.lord).toBe('Jupiter');
    expect(r.running.antara.yearsLeft).toBeGreaterThan(0);
    expect(r.running.antara.yearsLeft).toBeLessThan(1e-6);
  });
});

describe('Full-dasha arithmetic', () => {
  it('the 9 bhuktis of every dasha sum to the dasha length', () => {
    for (const lord of VIMSHOTTARI_LORDS) {
      const sum = getBhuktiYears(lord).reduce((s, b) => s + b.years, 0);
      expect(sum).toBeCloseTo(DASHA_YEARS[lord], 12);
    }
  });

  it('the dasha lengths sum to 120 years', () => {
    const sum = VIMSHOTTARI_LORDS.reduce((s, l) => s + DASHA_YEARS[l], 0);
    expect(sum).toBe(TOTAL_DASHA_YEARS);
  });

  it('bhuktis start with the dasha lord and follow the Vimshottari order', () => {
    const b = getBhuktiYears('Moon').map((x) => x.lord);
    expect(b).toEqual(['Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus', 'Sun']);
  });
});

function flatten(p: DashaPeriod): DashaPeriod[] {
  return [p, ...(p.subPeriods ?? []).flatMap(flatten)];
}

describe('Dated timeline', () => {
  for (const days of YEAR_DAYS) {
    describe(`dashaYearDays = ${days}`, () => {
      for (const c of CASES) {
        const tl = () => calculateVimshottariDasha(c.moonKpOld, c.birthUtc, { dashaYearDays: days });

        it(`${c.id}: lord, balance and first running bhukti`, () => {
          const r = tl();
          expect(r.dashaLord).toBe(c.dasha);
          expect(r.balanceYears + r.balanceMonths / 12 + r.balanceDays / 365.25).toBeCloseTo(c.balance, 1);
          const first = r.dashaTimeline[0];
          expect(first.lord).toBe(c.dasha);
          expect(first.subPeriods![0].lord).toBe(c.bhukti);
        });

        it(`${c.id}: first bhukti starts at birth and lasts the years left (#37)`, () => {
          const first = tl().dashaTimeline[0];
          const bhukti = first.subPeriods![0];
          expect(bhukti.startDate).toBe(c.birthUtc.toISOString().slice(0, 10));
          expect(Math.abs(bhukti.durationDays - c.bhuktiLeft * days)).toBeLessThanOrEqual(0.5 + 1e-9);
          // Not the old behaviour: bhuktis elapsed before birth are skipped, not squeezed in.
          const lords = VIMSHOTTARI_LORDS;
          const k = lords.indexOf(c.dasha);
          const order = Array.from({ length: 9 }, (_, i) => lords[(k + i) % 9]);
          expect(first.subPeriods!.map((b) => b.lord)).toEqual(order.slice(order.indexOf(c.bhukti)));
        });

        it(`${c.id}: periods are contiguous and children end where their parent ends`, () => {
          const r = tl();
          for (let i = 1; i < r.dashaTimeline.length; i++) {
            expect(r.dashaTimeline[i].startDate).toBe(r.dashaTimeline[i - 1].endDate);
          }
          for (const dasha of r.dashaTimeline) {
            const bhuktis = dasha.subPeriods!;
            expect(bhuktis[0].startDate).toBe(dasha.startDate);
            expect(bhuktis[bhuktis.length - 1].endDate).toBe(dasha.endDate);
            for (let i = 1; i < bhuktis.length; i++) expect(bhuktis[i].startDate).toBe(bhuktis[i - 1].endDate);
            for (const bhukti of bhuktis) {
              const antaras = bhukti.subPeriods!;
              expect(antaras[0].startDate).toBe(bhukti.startDate);
              expect(antaras[antaras.length - 1].endDate).toBe(bhukti.endDate);
              for (let i = 1; i < antaras.length; i++) expect(antaras[i].startDate).toBe(antaras[i - 1].endDate);
            }
          }
        });

        it(`${c.id}: every period after the balance dasha is full length`, () => {
          const r = tl();
          for (const dasha of r.dashaTimeline.slice(1)) {
            expect(dasha.subPeriods).toHaveLength(9);
            expect(Math.abs(dasha.durationDays - DASHA_YEARS[dasha.lord] * days)).toBeLessThanOrEqual(0.5 + 1e-9);
            for (const b of dasha.subPeriods!) expect(b.subPeriods).toHaveLength(9);
          }
        });

        it(`${c.id}: balance dasha ends after the balance years`, () => {
          const first = tl().dashaTimeline[0];
          const spanDays = day(first.endDate) - day(first.startDate);
          expect(Math.abs(spanDays - c.balance * days)).toBeLessThanOrEqual(1);
        });
      }
    });
  }

  it('numDashas defaults to 9 and can be changed', () => {
    const c = CASES[0];
    expect(calculateVimshottariDasha(c.moonKpOld, c.birthUtc, { dashaYearDays: 365.25 }).dashaTimeline).toHaveLength(9);
    expect(
      calculateVimshottariDasha(c.moonKpOld, c.birthUtc, { dashaYearDays: 365.25, numDashas: 3 }).dashaTimeline.map((d) => d.lord)
    ).toEqual(['Moon', 'Mars', 'Rahu']);
  });

  it('day length changes dates but not lords or balance', () => {
    const c = CASES[0];
    const a = calculateVimshottariDasha(c.moonKpOld, c.birthUtc, { dashaYearDays: 365.2425 });
    const b = calculateVimshottariDasha(c.moonKpOld, c.birthUtc, { dashaYearDays: 360 });
    expect(a.balanceYears).toBe(b.balanceYears);
    expect(a.balanceMonths).toBe(b.balanceMonths);
    expect(a.dashaTimeline.map((d) => d.lord)).toEqual(b.dashaTimeline.map((d) => d.lord));
    expect(a.dashaTimeline[3].endDate).not.toBe(b.dashaTimeline[3].endDate);
  });

  it('dashaYearDays is required: no hidden default', () => {
    const c = CASES[0];
    // @ts-expect-error dashaYearDays is a required option
    expect(() => calculateVimshottariDasha(c.moonKpOld, c.birthUtc, {})).toThrow(RangeError);
    // @ts-expect-error options object is required
    expect(() => calculateVimshottariDasha(c.moonKpOld, c.birthUtc)).toThrow();
    expect(() => calculateVimshottariDasha(c.moonKpOld, c.birthUtc, { dashaYearDays: 0 })).toThrow(RangeError);
    expect(() => calculateVimshottariDasha(c.moonKpOld, c.birthUtc, { dashaYearDays: NaN })).toThrow(RangeError);
  });

  it('flattening a timeline yields 3 levels only', () => {
    const c = CASES[1];
    const r = calculateVimshottariDasha(c.moonKpOld, c.birthUtc, { dashaYearDays: 365.2425 });
    expect(new Set(r.dashaTimeline.flatMap(flatten).map((p) => p.level))).toEqual(new Set(['dasha', 'bhukti', 'antara']));
  });
});
