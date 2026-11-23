import { describe, expect, it } from 'vitest';
import app from '../src/index.js';
import indexPage from '../public/index.html?raw';
import animatePage from '../public/animate.html?raw';

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('repeated clock time: the chart and animate pages name the UTC offsets (as /match)', () => {
  // New York (locationId 1398) 2024-11-03 01:30 occurs twice: EDT (UTC-4), then EST (UTC-5).
  const twice = { year: 2024, month: 11, day: 3, hour: 1, minute: 30, second: 0, locationId: 1398, ayanamsa: 'kp_new' };
  const between = (src: string, a: string, b: string) => {
    const i = src.indexOf(a);
    const j = src.indexOf(b, i);
    if (i < 0 || j < 0) throw new Error(`markers not found: ${a} .. ${b}`);
    return src.slice(i, j);
  };

  for (const [name, src] of [['index.html', indexPage], ['animate.html', animatePage]] as const) {
    it(`${name}: parses both offsets from the real API message and labels the select`, async () => {
      const res = await post('/api/calculate', twice);
      expect(res.status).toBe(400);
      const { error } = (await res.json()) as { error: string };
      const ambiguousOffsets = new Function(
        `${between(src, 'function ambiguousOffsets', 'function labelOffsetOptions')}\nreturn ambiguousOffsets;`
      )() as (m: string) => { earlier: string; later: string } | null;
      expect(ambiguousOffsets(error)).toEqual({ earlier: 'UTC-04:00', later: 'UTC-05:00' });
      expect(ambiguousOffsets('The local time 2024-03-10 02:30:00 does not exist')).toBeNull();
      // The hint replaces the API's "earlier"/"later" sentence with the offsets (labelling is a no-op here).
      const withOffsetHint = new Function(
        'ambiguousOffsets', 'labelOffsetOptions',
        `${between(src, 'function withOffsetHint', "['inpYear'")}\nreturn withOffsetHint;`
      )(ambiguousOffsets, () => {}) as (m: string) => string;
      const hinted = withOffsetHint(error);
      expect(hinted).not.toContain('Choose "earlier" or "later".');
      expect(hinted).toContain('Choose UTC-04:00 or UTC-05:00 in "UTC offset if the time repeats", then try again.');
      expect(withOffsetHint('Unknown locationId')).toBe('Unknown locationId');
      for (const choice of ['earlier', 'later']) {
        expect((await post('/api/calculate', { ...twice, ambiguousTime: choice })).status).toBe(200);
      }
      expect(src).toContain('<md-outlined-select id="inpAmbiguous" label="UTC offset if the time repeats">');
      expect(src).not.toContain('label="Repeated time"');
      expect(src).not.toContain('Earlier one');
      // Labels are dropped when the date, time or place changes.
      expect(src).toContain("['inpYear', 'inpMonth', 'inpDay', 'inpHour', 'inpMinute', 'inpSecond', 'inpCountry', 'inpPlace'].forEach((id) =>");
    });
  }

  it('index.html adds the hint to its error alert; fillSample resets the labels', () => {
    expect(indexPage).toContain("alert('Calculation error: ' + withOffsetHint(computed.json.error || computed.res.status));");
    expect(indexPage).toContain("alert('Calculation error: ' + withOffsetHint(chart.json.error || chart.res.status));");
    expect(between(indexPage, 'async function fillSample', 'await selectLocation')).toContain('labelOffsetOptions(null);');
  });

  it('animate.html adds the hint to its status line; each animation step resets the labels', () => {
    expect(animatePage).toContain("return 'Chart computation failed: ' + withOffsetHint(detail);");
    expect(between(animatePage, 'function advanceOneStep', "el('inpSecond').value = next.second;\n      labelOffsetOptions(null);")).toBeTruthy();
    // Restart and Now! also set the fields from script (#125 review).
    expect(between(animatePage, "el('btnRestart').addEventListener", "fetchForDisplay('Restarted.')")).toContain('labelOffsetOptions(null);');
    expect(between(animatePage, "el('btnNow').addEventListener", "fetchForDisplay('Now.')")).toContain('labelOffsetOptions(null);');
  });
});
