/**
 * KP-Qt EphemerisEngine reference, copied from
 * vgnshlvnz/KP-Qt pull 92 (`cursor/ayanamsa-ref-79c6`,
 * `e5ca41d65036516b76f47455336b73643366364a`),
 * `tools/ayanamsa-ref/ayanamsa_reference.json`.
 *
 * Regenerate there (Qt 6), from the KP-Qt repo root:
 *   cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug -DKP_BUILD_AYANAMSA_REF=ON
 *   cmake --build build --target ayanamsa-ref
 *   ./build/ayanamsa-ref --output tools/ayanamsa-ref/ayanamsa_reference.json
 * then copy that file over `test/fixtures/kpqt-ayanamsa-reference.json`.
 *
 * `mean_deg` has no nutation. `true_deg` is mean + IAU 1980 nutation, except Nil.
 * KP-Web's exposed true value is mean + this engine's IAU 2000B nutation (#57).
 * The two nutation series are not the same, so true_deg is checked as
 * mean_deg + the reference epoch's `nutation_lon_deg` only after substituting
 * that nutation: the assertion that must hold for the port is the mean, and
 * that passing the reference nutation reproduces true_deg. The engine's own
 * true value is mean + IAU 2000B, and the gap to true_deg is reported, not
 * forced to 0.001 arcsec (that would replace the engine nutation).
 *
 * KP Straight Line (Adjusted) keeps the owner definition (#29) and is not
 * required to equal KP-Qt. User Defined is a placeholder and is not a mode.
 */
import { describe, expect, it } from 'vitest';
import indexHtml from '../public/index.html?raw';
import { calculateAyanamsa, calculateNutation } from '../src/engine/astronomy.js';
import { AYANAMSA_MODES, type KpCivilDate } from '../src/engine/ayanamsa-defs.js';
import reference from './fixtures/kpqt-ayanamsa-reference.json';

const ARCSEC = 3600;
const TOLERANCE_ARCSEC = 0.001;

const MATCHED: Record<string, 'kp_ayanamsa' | 'kp_straight_line' | 'lahiri' | 'raman' | 'fagan_bradley' | 'yukteshwar' | 'jn_bhasin' | 'usha_shashi'> = {
  'KP Ayanamsa': 'kp_ayanamsa',
  'KP Straight Line': 'kp_straight_line',
  Lahiri: 'lahiri',
  'B.V.Raman': 'raman',
  'Fagan Bradley': 'fagan_bradley',
  Yukteshwar: 'yukteshwar',
  'J.N.Bhasin': 'jn_bhasin',
  'Usha Shashi': 'usha_shashi',
};

function civilOf(epochId: string): KpCivilDate {
  const epoch = reference.epochs.find((row) => row.id === epochId)!;
  return {
    year: epoch.calendar.year,
    month: epoch.calendar.month,
    day: epoch.calendar.day,
    hour: epoch.calendar.hour,
    minute: epoch.calendar.minute,
    second: epoch.calendar.second,
  };
}

function epochOf(epochId: string) {
  return reference.epochs.find((row) => row.id === epochId)!;
}

function systemOf(name: string) {
  return reference.systems.find((row) => row.name === name)!;
}

describe('KP-Qt reference JSON (PR 92, e5ca41d)', () => {
  it('J2000 TT means match the published sanity values', () => {
    const epoch = epochOf('2000-01-01T12:00:00TT');
    const civil = civilOf(epoch.id);
    const expectMean = {
      kp_ayanamsa: 23.766834708985698,
      kp_straight_line: 23.84949732708333,
      lahiri: 23.85713274253795,
      raman: 22.411102742537942,
      fagan_bradley: 24.740452948154186,
      yukteshwar: 22.478884742537964,
      jn_bhasin: 22.76221874253799,
      usha_shashi: 20.05762274253795,
    };
    for (const [id, want] of Object.entries(expectMean)) {
      const got = calculateAyanamsa(epoch.jd_ut, id as keyof typeof expectMean, 0, civil).meanAyanamsa;
      expect(Math.abs(got - want) * ARCSEC, id).toBeLessThanOrEqual(TOLERANCE_ARCSEC);
    }
  });

  it('eight systems match mean_deg, and true_deg when the reference nutation is applied', () => {
    for (const name of Object.keys(MATCHED) as (keyof typeof MATCHED)[]) {
      const id = MATCHED[name];
      const system = systemOf(name);
      for (const value of system.values) {
        const epoch = epochOf(value.epoch);
        const got = calculateAyanamsa(epoch.jd_ut, id, epoch.nutation_lon_deg, civilOf(epoch.id));
        expect(Math.abs(got.meanAyanamsa - value.mean_deg) * ARCSEC, `${name} ${value.epoch} mean`).toBeLessThanOrEqual(
          TOLERANCE_ARCSEC
        );
        expect(Math.abs(got.trueAyanamsa - value.true_deg) * ARCSEC, `${name} ${value.epoch} true`).toBeLessThanOrEqual(
          TOLERANCE_ARCSEC
        );
      }
    }
  });

  it('the engine true value is mean plus IAU 2000B, and the gap to KP-Qt true_deg is that nutation difference', () => {
    let maxGap = 0;
    for (const name of Object.keys(MATCHED) as (keyof typeof MATCHED)[]) {
      const id = MATCHED[name];
      for (const value of systemOf(name).values) {
        const epoch = epochOf(value.epoch);
        const dPsi = calculateNutation(epoch.jd_ut).dPsi;
        const got = calculateAyanamsa(epoch.jd_ut, id, dPsi, civilOf(epoch.id));
        expect(got.trueAyanamsa).toBeCloseTo(got.meanAyanamsa + dPsi, 12);
        const gap = Math.abs(got.trueAyanamsa - value.true_deg) * ARCSEC;
        const nutGap = Math.abs(dPsi - epoch.nutation_lon_deg) * ARCSEC;
        expect(Math.abs(gap - nutGap), `${name} ${value.epoch}`).toBeLessThan(TOLERANCE_ARCSEC);
        maxGap = Math.max(maxGap, gap);
      }
    }
    // IAU 2000B versus KP-Qt's IAU 1980 is more than 0.001 arcsec. Recorded, not collapsed.
    // IAU 2000B versus KP-Qt's IAU 1980. Measured maximum on this grid is 0.00814 arcsec.
    expect(maxGap).toBeGreaterThan(0.008);
    expect(maxGap).toBeLessThan(0.009);
  });
});

describe('KP Straight Line (Adjusted) stays the owner definition', () => {
  it('differs from KP-Qt on every reference epoch, by about 12 to 13 arcsec', () => {
    const system = systemOf('KP Straight Line (Adjusted)');
    const diffs: number[] = [];
    for (const value of system.values) {
      const epoch = epochOf(value.epoch);
      const got = calculateAyanamsa(epoch.jd_ut, 'kp_straight_line_adjusted', 0, civilOf(epoch.id));
      const arcsec = (got.meanAyanamsa - value.mean_deg) * ARCSEC;
      diffs.push(arcsec);
      expect(Math.abs(arcsec), value.epoch).toBeGreaterThan(10);
      expect(Math.abs(arcsec), value.epoch).toBeLessThan(14);
      expect(got.trueAyanamsa).toBe(got.meanAyanamsa);
    }
    const max = Math.max(...diffs.map((d) => Math.abs(d)));
    expect(max).toBeGreaterThan(12);
    expect(max).toBeLessThan(13);
  });
});

describe('User Defined is not selectable', () => {
  it('is absent from the mode list and from the page select', () => {
    expect(AYANAMSA_MODES).not.toContain('user_defined');
    expect(systemOf('User Defined').placeholder_zero_point).toBe(true);
    const select =
      indexHtml.match(/<(select|md-(?:outlined|filled)-select)\b[^>]*id="inpAyanamsa"[\s\S]*?<\/\1>/)?.[0] ?? '';
    expect(select).not.toContain('User Defined');
    expect(select).not.toContain('user_defined');
    const selected = [...select.matchAll(/<(?:option|md-select-option) value="([^"]+)"[^>]*\sselected/g)].map((m) => m[1]);
    expect(selected).toEqual(['kp_new']);
  });
});
