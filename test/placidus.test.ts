import test from 'node:test';
import assert from 'node:assert';
import {
  armcToMc,
  asc1,
  calculateTropicalPlacidusCusps,
  degNorm,
  getCuspalHouse,
  invertAscendantToRamc,
} from '../dist/houses/placidus.js';

test('Placidus house cusps 1 to 12 match Swiss Ephemeris reference down to sub-arcsecond', () => {
  const ramc = 153.25;
  const latitude = 13.0827; // Chennai, India
  const obliquity = 23.440635;

  // Reference cusps computed from Swiss Ephemeris swe.houses_armc(153.25, 13.0827, 23.440635, 'P')
  const refCusps = [
    240.491548, 269.444876, 299.450554, 331.216471, 3.42664, 33.483008,
    60.491548, 89.444876, 119.450554, 151.216471, 183.42664, 213.483008,
  ];

  const myCusps = calculateTropicalPlacidusCusps(ramc, latitude, obliquity);

  assert.strictEqual(myCusps.length, 12);

  for (let i = 0; i < 12; i++) {
    const diffArcsec = Math.abs(myCusps[i] - refCusps[i]) * 3600;
    assert.ok(
      diffArcsec < 0.05,
      `Cusp ${i + 1} difference ${diffArcsec.toFixed(4)}" exceeds 0.05 arcsec tolerance`
    );
  }
});

test('RAMC Inversion reproduces target Ascendant to < 0.001 arcseconds across all zodiac positions', () => {
  const latitude = 13.0827;
  const obliquity = 23.440635;
  const sine = Math.sin((obliquity * Math.PI) / 180);
  const cose = Math.cos((obliquity * Math.PI) / 180);

  // Targets across all 12 signs
  const targets = [
    0.0, 15.5, 30.0, 75.25, 108.0, 153.0, 195.4, 240.0, 272.8, 315.0, 345.9,
  ];

  for (const target of targets) {
    const invertedRamc = invertAscendantToRamc(target, latitude, obliquity);
    const calculatedAsc = asc1(invertedRamc + 90, latitude, sine, cose);

    let diff = Math.abs(calculatedAsc - target);
    if (diff > 180) diff = 360 - diff;
    const diffArcsec = diff * 3600;

    assert.ok(
      diffArcsec < 0.001,
      `Target ${target}° inversion error ${diffArcsec.toFixed(6)}" exceeds 0.001"`
    );
  }
});

test('Cuspal house assignment places planet just before a cusp into previous house', () => {
  // Sample cusps:
  // Cusp 1 = 20° (20), Cusp 2 = 50° (50), Cusp 3 = 80° (80), ..., Cusp 12 = 350° (350)
  const cusps = [20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320, 350];

  // A planet at 19.99° is before Cusp 1 (20°), so it belongs to House 12!
  assert.strictEqual(getCuspalHouse(19.99, cusps), 12);

  // A planet at 20.01° is after Cusp 1, so it belongs to House 1
  assert.strictEqual(getCuspalHouse(20.01, cusps), 1);

  // A planet at 49.99° is before Cusp 2 (50°), so it belongs to House 1
  assert.strictEqual(getCuspalHouse(49.99, cusps), 1);

  // A planet at 50.01° is in House 2
  assert.strictEqual(getCuspalHouse(50.01, cusps), 2);

  // Across 0° Aries boundary:
  // Cusp 12 is 350°, Cusp 1 is 20°
  assert.strictEqual(getCuspalHouse(355, cusps), 12);
  assert.strictEqual(getCuspalHouse(5, cusps), 12);
  assert.strictEqual(getCuspalHouse(25, cusps), 1);
});
