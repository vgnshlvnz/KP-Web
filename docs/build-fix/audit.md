# Engine audit and consolidation plan

Work package #31, part of #29. Agent: `engine-auditor`. Measured on `build/integration` @ `af7c24d` (`src/` identical to `88ee3e2`).
Reference: Swiss Ephemeris 2.10.03 via `pyswisseph` in a throw-away venv with the `sepl_18.se1` / `semo_18.se1` data files (full SE precision, not Moshier). **Local comparison only, not a project dependency.** Units: arc-seconds (″) unless stated.

## Summary

1. Stack A computes **no planets**: `calculateKPChart` takes planet longitudes as input (the live UI asks the user to paste them). Planets exist only in Stack B (`astronomy-engine`).
2. Ayanamsa, both modes, vs SE mean ayanamsa at 60 epochs 1800–2100: Stack A max 0.0002″, Stack B max 0.0312″ (KP New, 1800). Both are fine; A is tighter.
3. Placidus cusps, 4 non-polar cases × 2 ayanamsas × 12 cusps (96): Stack A max 0.19″ / mean 0.08″, **0** sub or sub-sub lord mismatches. Stack B max 17.57″ / mean 10.29″.
4. Planets Sun…Saturn (Stack B only, 70 values): max 18.38″ / mean 11.18″ as shipped, because Δψ is never subtracted (#33). With Δψ subtracted: max 10.08″ (Saturn 2026), mean 1.79″; Moon max 4.50″; cusps max 0.20″.
5. Nodes (Stack B only): mean node max 0.28″. True node max **2470″ (41′)** off, because it is computed in a J2000 frame (#34).
6. KP impact of Stack B as shipped: wrong sub/sub-sub lord in 4 of 186 planet, mean-node and cusp checks, 14 of 20 true-node checks, and 18 of 24 Tromsø cusps. With the Δψ fix: 0 of 186.
7. Tromsø 69.65 N: SE refuses Placidus and switches to Porphyry. Stack A does the same (matches SE Porphyry to 0.01″) and sets a warning, but `calculateKPChart` drops it from the response. Stack B silently computes at latitude 66°: cusps off by up to 13.3°, no warning (#35).
8. Same inputs, both stacks: the lord functions agree on 724,374 longitudes, including every sub-sub boundary ±1e-7°. The 249-entry horary tables are identical. House assignment and four-level significators are identical on 4 charts (0 of 192 level lists differ).
9. Bugs in Stack B-only logic: day lord before sunrise is wrong (KL 1992 gives Mercury; it should be Mars) (#36). First-dasha bhuktis are scaled instead of skipped, so the running bhukti is wrong in 5 of 5 cases (#37).
10. Plan: 10 packages. `unify-types` first; then 6 in parallel; then `port-chart`, then `port-horary`; `entrypoint` last. 12 open questions, including #22–#25 (not decided here).

---

## 1. Inventory

Paths are relative to `src/`. "Both" means the capability exists in both stacks; differences are noted.

### 1.1 Stack A (`engine/*`, entry `index.ts`, Hono)

| File | Export | Computes | Signature / types |
|---|---|---|---|
| `engine/astronomy.ts` | `normalizeDegrees`, `sind`, `cosd`, `tand`, `asind`, `atand`, `atan2d`, `DEG2RAD`, `RAD2DEG` | degree trig helpers | `(number) => number` |
| | `toJulianDate` | JD from a calendar date in UT (Meeus 7). Negative/overflowing hours are allowed (used for local→UT) | `(y, m, d, h=0, mi=0, s=0) => number` |
| | `calculateNutation` | Δψ, Δε, truncated IAU 1980 (13 terms). Δψ error vs SE ≤ 0.141″ | `(jd) => NutationResult {dPsi, dEps}` (deg) |
| | `calculateObliquity` | mean/true ε (Laskar). Error vs SE ≤ 0.061″ | `(jd, dEps=0) => ObliquityResult` |
| | `calculateSiderealTime` | GMST (IAU 1982), GAST, LST, ARMC. ARMC error vs SE ≤ 0.205″ | `(jd, lonDeg, dPsiDeg=0, trueEpsDeg=23.439291) => SiderealTimeResult` |
| | `calculateAyanamsa` | KP Old / KP New: mean from a polynomial in T; true = mean + Δψ | `(jd, type: AyanamsaType='kp_old', dPsiDeg=0) => AyanamsaResult` |
| `engine/placidus.ts` | `asc1`, `asc2`, `difdeg2n`, `armcToMC`, `mcToArmc` | SE-style Placidus primitives; MC↔ARMC | numbers |
| | `calculatePlacidusCusps` | 12 Placidus cusps (SE algorithm, iterative). For \|φ\| ≥ 90°−ε or non-convergence: Porphyry, `isPolarFallback`, `warnings` | `(armc, lat, eps, aya=0) => PlacidusCuspsResult` |
| `engine/kp-lords.ts` | `ZODIAC_SIGNS`, `VIMSHOTTARI_LORDS`, `PlanetLord`, `DASHA_YEARS`, `TOTAL_DASHA_YEARS`, `NAKSHATRA_SPAN_DEG`, `NAKSHATRAS` | KP constants | `as const` arrays / records |
| | `formatDMS` | `DD°MM'SS"` (rounded, carry handled) | `(deg) => {degrees, minutes, seconds, formatted}` |
| | `getHorary249Table`, `Horary249Entry` | 1–249 table (cached) | `() => Horary249Entry[]` |
| | `getPositionLords` | sign/star/sub/sub-sub lord + horary number | `(lon) => KPPositionLords` |
| | `buildKPCusp` | cusp + lords + house span | `(house, lon, nextLon) => KPCusp` |
| `engine/house-assignment.ts` | `isInHouse`, `getHouseForLongitude`, `assignPlanetsToHouses` | cuspal house (passed cusp, wraps at 0°) + lords + distances | `(PlanetInput[], number[]) => PlanetHouseAssignment[]` |
| `engine/significators.ts` | `calculateSignificators` | 4-level house-wise + planet-wise. No node-agent rules | `(KPCusp[], PlanetHouseAssignment[]) => SignificatorsResult` |
| `engine/chart-wheels.ts` | `buildChartWheels` | South/North Indian wheel data | `(KPCusp[], PlanetHouseAssignment[]) => ChartWheels` |
| `engine/index.ts` | `calculateKPChart` | local→UT, JD, nutation, ε, ARMC, ayanamsa, cusps, lords. Planets **only if passed in**. Significators, wheels | `(DateTimeLocation, AyanamsaType='kp_old', PlanetInput[]=[]) => ChartCalculationResult` |
| | `calculateCuspsFromARMC` | cusps from ARMC (no Asc→ARMC inversion) | `(armc, lat, eps=23.439291, aya=24.1358) => KPCusp[]` |
| `engine/types.ts` | `AyanamsaType = 'kp_old'\|'kp_new'`, `DateTimeLocation`, `KPPositionLords`, `KPCusp`, `PlanetInput`, `PlanetHouseAssignment`, `HouseSignificator`, `PlanetSignificator`, `SignificatorsResult`, `SouthIndianBox`, `NorthIndianHouse`, `ChartWheels`, `ChartCalculationResult` | types | planet names are `string` |
| `index.ts` | Hono `app` | `GET /api/health`, `GET /api/chart/sample`, `POST /api/chart/cusps`, `POST /api/chart/calculate`, `GET /api/horary/table` | |

### 1.2 Stack B (`types.ts`, `ephemeris/*`, `houses/*`, `kp/*`, entry `worker.ts`)

| File | Export | Computes | Signature / types |
|---|---|---|---|
| `ephemeris/ayanamsa.ts` | `KP_OLD_J2000_DEG`, `KP_NEW_J2000_DEG` | J2000 values (match SE to 1e-8°) | numbers |
| | `calculatePrecessionArcsec`, `calculateKpAyanamsa` | mean ayanamsa = J2000 value + IAU 2006 general precession. No nutation | `(jd, mode: AyanamsaMode='KP_OLD') => number` |
| | `formatDms` | `D°MM'SS"` (optional 2-decimal seconds) | `(deg, frac=false) => string` |
| | `dateToJulianDay`, `julianDayToDate` | JD ↔ UTC `Date` | same formula as A's `toJulianDate` (identical JD in all 5 cases) |
| `ephemeris/jpl-ephemeris.ts` | `calculatePlanetaryPositions` | Sun…Pluto via `astronomy-engine` (apparent, true equinox of date), Rahu/Ketu, speed (1 h finite difference), retrograde. Sidereal = tropical − **mean** ayanamsa (#33) | `(Date, AyanamsaMode='KP_OLD', NodeMode='MEAN') => {planets: RawPlanetPosition[], ayanamsaDeg, julianDayUt, obliquityDeg}` |
| | `calculateMeanLunarNode` | mean Ω polynomial | `(jd) => number` |
| | `calculateTrueLunarNode` | osculating node from the Moon state vector, mixed J2000/of-date frame (#34) | `(AstroTime) => number` |
| | `fetchJplHorizonsPosition` | makes a network call to JPL Horizons and **always returns `null`**. Unused | `async (cmd, Date) => null` |
| `houses/placidus.ts` | `degNorm`, `asc1`, `armcToMc` | same primitives as A (no `asc2` export) | numbers |
| | `calculateRamc` | ARMC from `Astronomy.SiderealTime` (GAST) + ε from `e_tilt`. ARMC error vs SE ≤ 0.124″ | `(Date, lon) => {ramcDeg, lstHours, obliquityDeg}` |
| | `calculateTropicalPlacidusCusps` | same algorithm as A, but **clamps \|lat\| to 66°** with no warning (#35); 30-iteration cap, no non-convergence handling | `(ramc, lat, eps) => number[12]` |
| | `invertAscendantToRamc` | Asc → ARMC (grid + Newton). Horary Asc hits the sub start to 4e-10″ | `(ascTrop, lat, eps) => number` |
| | `getCuspalHouse` | cuspal house, same semantics as A's `getHouseForLongitude` | `(lon, cusps) => 1..12` |
| `kp/sub-lords.ts` | `ZODIAC_SIGNS`, `VIMSHOTTARI_LORDS`, `VIMSHOTTARI_YEARS`, `TOTAL_VIMSHOTTARI_YEARS`, `NAKSHATRAS`, `NAKSHATRA_SPAN_DEG` | KP constants (typed `KPPlanetLord`) | |
| | `calculateKpLords` | sign/star/sub/sub-sub + sub span, distance to sub boundaries, `isNearSubBoundary` (default 60″) | `(lon, thresholdArcsec=60) => KpLords` |
| `kp/horary-table.ts` | `getHoraryTable`, `getHoraryEntry` | 1–249 table with DMS strings; range-checked lookup | `() => HoraryTableEntry[]`, `(n) => HoraryTableEntry` |
| `kp/significators.ts` | `calculateSignificators`, `DOCUMENTED_RAHU_KETU_RULES` | 4-level (9 bodies) + `agentsFor` for nodes (sign lord, star lord, same-sign planets). Doc string also claims "aspects", which are **not implemented**; `agentsFor` is not used in the house levels | `(PlanetaryPosition[], HouseCusp[]) => FourLevelSignificators` |
| `kp/dasha.ts` | `calculateVimshottariDasha` | balance + dasha/bhukti/antara timeline, 365.2425-day year; first-dasha bug (#37) | `(moonLon, Date, cycles=9) => {...}` |
| `kp/ruling-planets.ts` | `DAY_LORDS`, `calculateDayLord`, `calculateRulingPlanets` | sunrise via `SearchRiseSet` (upper limb + refraction); 5-member list, duplicates kept; pre-sunrise bug (#36); polar night → "6 AM local" | `(Date, Coordinates) => {dayLord, sunriseUtc}` |
| `kp/horary.ts` | `calculateHoraryChart`, `HoraryCalculationOptions` | horary chart: Asc = sub start (or midpoint toggle), ARMC inversion, planets at question time | `(opts) => HoraryCalculationResult` |
| `kp/engine.ts` | `calculateNatalChart`, `dateTimeInputToUtcDate`, `NatalChartOptions` | full chart: planets, cusps, lords, significators, RP, dasha, near-boundary warnings | `(NatalChartOptions) => ChartCalculationResult` |
| `types.ts` | `AyanamsaMode = 'KP_OLD'\|'KP_NEW'`, `NodeMode`, `PlanetName`, `KPPlanetLord`, `Coordinates`, `DateTimeInput`, `KpLords`, `PlanetaryPosition`, `HouseCusp`, `HoraryTableEntry`, `FourLevelSignificators`, `RulingPlanets`, `DashaPeriod`, `ChartCalculationResult`, `HoraryCalculationResult` | types | |
| `worker.ts` | default `{fetch}` | `GET /api/health`, `GET /api/ayanamsa`, `GET /api/horary-table`, `POST /api/calculate`, `POST /api/horary` | |

A **third** `AyanamsaMode = 'kp_old'|'kp_new'` lives in `core/types.ts`. `core/validation.ts` `validateAyanamsa` rejects anything else, but no route calls it.

### 1.3 Capability matrix

| Capability | Where | Signature / type differences |
|---|---|---|
| JD / time conversion | **both** | A: calendar + `utcOffsetHours` → JD UT. B: `DateTimeInput` → `Date` → `AstroTime` (ΔT handled by astronomy-engine). Same JD |
| Nutation, obliquity, sidereal time / ARMC | **both** | A: hand-rolled (IAU 1980 13-term, IAU 1982 GMST). B: `astronomy-engine` `e_tilt` / `SiderealTime` |
| KP ayanamsa (Old/New) | **both** | A `AyanamsaType 'kp_old'` returns `{mean,true}`; B `AyanamsaMode 'KP_OLD'` returns mean only |
| Planet positions, speed, retrograde | **B only** | A accepts `PlanetInput {name, longitude, speed?}` from the caller |
| Mean / true node | **B only** | `NodeMode 'MEAN'\|'TRUE'` |
| Placidus cusps | **both** | A sidereal + tropical + polar flag/warnings; B tropical `number[]` only |
| Asc → ARMC inversion (horary) | **B only** | A has only `mcToArmc` |
| Polar fallback | **A only** | B clamps latitude |
| Lords (sign/star/sub/sub-sub) | **both** | A `KPPositionLords` (+ DMS, horary number, `string` lords); B `KpLords` (+ sub span, boundary distances, `KPPlanetLord`) |
| 1–249 horary table | **both** | A `Horary249Entry`; B `HoraryTableEntry` + DMS + `getHoraryEntry` |
| Cuspal house of a planet | **both** | identical results |
| 4-level significators | **both** | identical levels; A uses arrays per house, B `Record<number,…>` + node `agentsFor` |
| Chart wheels | **A only** | |
| Vimshottari dasha | **B only** | |
| Ruling planets / day lord at sunrise | **B only** | |
| Horary chart | **B only** | |
| Near-sub-boundary warnings | **B only** | |
| HTTP API | **both** | different routes and payloads (see open question 10) |

---

## 2. Accuracy vs Swiss Ephemeris

### 2.1 Method

- SE: `swe.calc_ut(jd, body, FLG_SWIEPH|FLG_SPEED|FLG_SIDEREAL)`, `swe.MEAN_NODE` / `swe.TRUE_NODE`, `swe.houses_ex(jd, lat, lon, b'P', FLG_SIDEREAL)`, with `set_sid_mode(SIDM_KRISHNAMURTI)` (KP Old) and `SIDM_KRISHNAMURTI_VP291` (KP New). Ayanamsa: `get_ayanamsa_ex_ut` with `FLG_NONUT` (mean) and without it (true = mean + Δψ).
- Stack A: `calculateKPChart(input, 'kp_old'|'kp_new', [])` → cusps; `calculateAyanamsa` → mean/true. No planets.
- Stack B: `calculateNatalChart({…, ayanamsaMode, nodeMode: 'MEAN'|'TRUE'})` → planets, cusps, ayanamsa.
- TypeScript was run through scratch vitest files (`audit-scratch/*.test.ts`, not committed). Errors are stack − SE, wrapped to ±180°, in ″.
- Placidus isolation: both `calculatePlacidusCusps` (A) and `calculateTropicalPlacidusCusps` (B) were run on the same grid (15 latitudes × 48 ARMC, ε = 23.4392911°) and compared with `swe.houses_armc`.
- Lords: A `getPositionLords`, B `calculateKpLords` and an independent Python implementation were compared on 720,000 evenly spaced longitudes plus every sub and sub-sub boundary ±1e-7°.

### 2.2 Per-case tables

Stack B planet rows use `nodeMode: 'MEAN'`. True-node rows use `nodeMode: 'TRUE'`. Stack A has no planets ("n/a").

#### 1992-03-11 06:14:00 +08:00 Kuala Lumpur (JD UT 2448692.426389)

**KP Old** — error = stack − Swiss Ephemeris, arc-seconds

| Quantity | SE (deg) | Stack A | Stack B |
|---|---|---|---|
| Ayanamsa, mean | 23.651146 | -0.00 | +0.00 |
| Ayanamsa, true (mean + Δψ) | 23.655988 | +0.02 | n/a (B uses mean only) |
| Sun | 326.944067 | n/a | +17.29 |
| Moon | 42.029507 | n/a | +16.09 |
| Mars | 293.061143 | n/a | +18.18 |
| Mercury | 345.041466 | n/a | +15.64 |
| Jupiter | 134.613922 | n/a | +17.49 |
| Venus | 302.551645 | n/a | +18.21 |
| Saturn | 290.273159 | n/a | +18.38 |
| Rahu (mean node) | 252.447902 | n/a | +0.09 |
| Ketu (mean node) | 72.447902 | n/a | +0.09 |
| Rahu (true node) | 252.901236 | n/a | +368.03 |
| Ketu (true node) | 72.901236 | n/a | +368.03 |
| Cusp 1 | 307.729020 | -0.04 | +17.57 |
| Cusp 2 | 340.795054 | -0.04 | +17.57 |
| Cusp 3 | 12.950731 | -0.03 | +17.56 |
| Cusp 4 | 42.255614 | -0.03 | +17.55 |
| Cusp 5 | 69.617319 | -0.03 | +17.54 |
| Cusp 6 | 97.382202 | -0.04 | +17.55 |
| Cusp 7 | 127.729020 | -0.04 | +17.57 |
| Cusp 8 | 160.795054 | -0.04 | +17.57 |
| Cusp 9 | 192.950731 | -0.03 | +17.56 |
| Cusp 10 | 222.255614 | -0.03 | +17.55 |
| Cusp 11 | 249.617319 | -0.03 | +17.54 |
| Cusp 12 | 277.382202 | -0.04 | +17.55 |

**KP New** — error = stack − Swiss Ephemeris, arc-seconds

| Quantity | SE (deg) | Stack A | Stack B |
|---|---|---|---|
| Ayanamsa, mean | 23.671272 | +0.00 | -0.00 |
| Ayanamsa, true (mean + Δψ) | 23.676114 | +0.02 | n/a (B uses mean only) |
| Sun | 326.923941 | n/a | +17.29 |
| Moon | 42.009381 | n/a | +16.09 |
| Mars | 293.041017 | n/a | +18.18 |
| Mercury | 345.021341 | n/a | +15.65 |
| Jupiter | 134.593797 | n/a | +17.49 |
| Venus | 302.531520 | n/a | +18.21 |
| Saturn | 290.253034 | n/a | +18.38 |
| Rahu (mean node) | 252.427777 | n/a | +0.09 |
| Ketu (mean node) | 72.427777 | n/a | +0.09 |
| Rahu (true node) | 252.881110 | n/a | +368.04 |
| Ketu (true node) | 72.881110 | n/a | +368.04 |
| Cusp 1 | 307.708895 | -0.04 | +17.57 |
| Cusp 2 | 340.774929 | -0.04 | +17.57 |
| Cusp 3 | 12.930605 | -0.03 | +17.56 |
| Cusp 4 | 42.235488 | -0.03 | +17.55 |
| Cusp 5 | 69.597193 | -0.03 | +17.55 |
| Cusp 6 | 97.362077 | -0.04 | +17.56 |
| Cusp 7 | 127.708895 | -0.04 | +17.57 |
| Cusp 8 | 160.774929 | -0.04 | +17.57 |
| Cusp 9 | 192.930605 | -0.03 | +17.56 |
| Cusp 10 | 222.235488 | -0.03 | +17.55 |
| Cusp 11 | 249.597193 | -0.03 | +17.55 |
| Cusp 12 | 277.362077 | -0.04 | +17.56 |


#### 2000-01-01 12:00:00 UTC Greenwich (JD UT 2451545.000000)

**KP Old** — error = stack − Swiss Ephemeris, arc-seconds

| Quantity | SE (deg) | Stack A | Stack B |
|---|---|---|---|
| Ayanamsa, mean | 23.760240 | -0.00 | -0.00 |
| Ayanamsa, true (mean + Δψ) | 23.756370 | -0.14 | n/a (B uses mean only) |
| Sun | 256.612548 | n/a | -14.93 |
| Moon | 199.567381 | n/a | -13.43 |
| Mars | 304.206932 | n/a | -11.78 |
| Mercury | 248.132907 | n/a | -15.25 |
| Jupiter | 1.496717 | n/a | -9.93 |
| Venus | 217.809418 | n/a | -15.93 |
| Saturn | 16.639293 | n/a | -12.27 |
| Rahu (mean node) | 101.284276 | n/a | +0.14 |
| Ketu (mean node) | 281.284276 | n/a | +0.14 |
| Rahu (true node) | 100.197653 | n/a | -58.88 |
| Ketu (true node) | 280.197653 | n/a | -58.88 |
| Cusp 1 | 0.506542 | -0.11 | -14.13 |
| Cusp 2 | 37.384210 | +0.03 | -14.04 |
| Cusp 3 | 58.263017 | +0.03 | -14.02 |
| Cusp 4 | 75.853334 | +0.00 | -14.02 |
| Cusp 5 | 95.303931 | -0.05 | -14.05 |
| Cusp 6 | 123.941969 | -0.13 | -14.10 |
| Cusp 7 | 180.506542 | -0.11 | -14.13 |
| Cusp 8 | 217.384210 | +0.03 | -14.04 |
| Cusp 9 | 238.263017 | +0.03 | -14.02 |
| Cusp 10 | 255.853334 | +0.00 | -14.02 |
| Cusp 11 | 275.303931 | -0.05 | -14.05 |
| Cusp 12 | 303.941969 | -0.13 | -14.10 |

**KP New** — error = stack − Swiss Ephemeris, arc-seconds

| Quantity | SE (deg) | Stack A | Stack B |
|---|---|---|---|
| Ayanamsa, mean | 23.780365 | +0.00 | -0.00 |
| Ayanamsa, true (mean + Δψ) | 23.776495 | -0.14 | n/a (B uses mean only) |
| Sun | 256.592424 | n/a | -14.93 |
| Moon | 199.547256 | n/a | -13.43 |
| Mars | 304.186807 | n/a | -11.78 |
| Mercury | 248.112782 | n/a | -15.25 |
| Jupiter | 1.476592 | n/a | -9.93 |
| Venus | 217.789293 | n/a | -15.93 |
| Saturn | 16.619168 | n/a | -12.27 |
| Rahu (mean node) | 101.264151 | n/a | +0.14 |
| Ketu (mean node) | 281.264151 | n/a | +0.14 |
| Rahu (true node) | 100.177528 | n/a | -58.88 |
| Ketu (true node) | 280.177528 | n/a | -58.88 |
| Cusp 1 | 0.486417 | -0.11 | -14.13 |
| Cusp 2 | 37.364085 | +0.03 | -14.04 |
| Cusp 3 | 58.242892 | +0.03 | -14.02 |
| Cusp 4 | 75.833209 | +0.00 | -14.02 |
| Cusp 5 | 95.283806 | -0.05 | -14.05 |
| Cusp 6 | 123.921844 | -0.13 | -14.10 |
| Cusp 7 | 180.486417 | -0.11 | -14.13 |
| Cusp 8 | 217.364085 | +0.03 | -14.04 |
| Cusp 9 | 238.242892 | +0.03 | -14.02 |
| Cusp 10 | 255.833209 | +0.00 | -14.02 |
| Cusp 11 | 275.283806 | -0.05 | -14.05 |
| Cusp 12 | 303.921844 | -0.13 | -14.10 |


#### 1950-06-15 23:59:30 +05:30 Chennai (JD UT 2433448.270486)

**KP Old** — error = stack − Swiss Ephemeris, arc-seconds

| Quantity | SE (deg) | Stack A | Stack B |
|---|---|---|---|
| Ayanamsa, mean | 23.068211 | -0.00 | +0.00 |
| Ayanamsa, true (mean + Δψ) | 23.067860 | -0.06 | n/a (B uses mean only) |
| Sun | 61.000356 | n/a | -1.04 |
| Moon | 62.221664 | n/a | -0.43 |
| Mars | 158.411104 | n/a | -0.77 |
| Mercury | 38.369697 | n/a | +2.16 |
| Jupiter | 314.182112 | n/a | -3.60 |
| Venus | 23.287483 | n/a | -2.27 |
| Saturn | 140.349595 | n/a | -3.35 |
| Rahu (mean node) | 340.266820 | n/a | -0.17 |
| Ketu (mean node) | 160.266820 | n/a | -0.17 |
| Rahu (true node) | 340.787486 | n/a | +2470.49 |
| Ketu (true node) | 160.787486 | n/a | +2470.49 |
| Cusp 1 | 326.184367 | -0.19 | -1.23 |
| Cusp 2 | 1.328561 | -0.17 | -1.23 |
| Cusp 3 | 31.928541 | -0.14 | -1.24 |
| Cusp 4 | 58.768093 | -0.13 | -1.24 |
| Cusp 5 | 84.736263 | -0.14 | -1.24 |
| Cusp 6 | 113.034410 | -0.17 | -1.23 |
| Cusp 7 | 146.184367 | -0.19 | -1.23 |
| Cusp 8 | 181.328561 | -0.17 | -1.23 |
| Cusp 9 | 211.928541 | -0.14 | -1.24 |
| Cusp 10 | 238.768093 | -0.13 | -1.24 |
| Cusp 11 | 264.736263 | -0.14 | -1.24 |
| Cusp 12 | 293.034410 | -0.17 | -1.23 |

**KP New** — error = stack − Swiss Ephemeris, arc-seconds

| Quantity | SE (deg) | Stack A | Stack B |
|---|---|---|---|
| Ayanamsa, mean | 23.088339 | +0.00 | -0.01 |
| Ayanamsa, true (mean + Δψ) | 23.087988 | -0.06 | n/a (B uses mean only) |
| Sun | 60.980228 | n/a | -1.03 |
| Moon | 62.201536 | n/a | -0.41 |
| Mars | 158.390976 | n/a | -0.76 |
| Mercury | 38.349569 | n/a | +2.17 |
| Jupiter | 314.161985 | n/a | -3.59 |
| Venus | 23.267355 | n/a | -2.26 |
| Saturn | 140.329468 | n/a | -3.34 |
| Rahu (mean node) | 340.246693 | n/a | -0.15 |
| Ketu (mean node) | 160.246693 | n/a | -0.15 |
| Rahu (true node) | 340.767358 | n/a | +2470.50 |
| Ketu (true node) | 160.767358 | n/a | +2470.50 |
| Cusp 1 | 326.164239 | -0.19 | -1.22 |
| Cusp 2 | 1.308433 | -0.17 | -1.22 |
| Cusp 3 | 31.908413 | -0.14 | -1.23 |
| Cusp 4 | 58.747965 | -0.13 | -1.23 |
| Cusp 5 | 84.716135 | -0.14 | -1.23 |
| Cusp 6 | 113.014283 | -0.17 | -1.22 |
| Cusp 7 | 146.164239 | -0.19 | -1.22 |
| Cusp 8 | 181.308433 | -0.17 | -1.22 |
| Cusp 9 | 211.908413 | -0.14 | -1.23 |
| Cusp 10 | 238.747965 | -0.13 | -1.23 |
| Cusp 11 | 264.716135 | -0.14 | -1.23 |
| Cusp 12 | 293.014283 | -0.17 | -1.22 |


#### 2026-11-21 09:00:00 +08:00 Petaling Jaya (JD UT 2461365.541667)

**KP Old** — error = stack − Swiss Ephemeris, arc-seconds

| Quantity | SE (deg) | Stack A | Stack B |
|---|---|---|---|
| Ayanamsa, mean | 24.135846 | -0.00 | -0.00 |
| Ayanamsa, true (mean + Δψ) | 24.138116 | +0.11 | n/a (B uses mean only) |
| Sun | 214.583656 | n/a | +7.54 |
| Moon | 346.565855 | n/a | +12.67 |
| Mars | 123.827167 | n/a | +7.94 |
| Mercury | 195.099592 | n/a | +7.48 |
| Jupiter | 122.112250 | n/a | +6.43 |
| Venus | 179.677078 | n/a | +1.14 |
| Saturn | 344.148788 | n/a | -1.90 |
| Rahu (mean node) | 300.874148 | n/a | +0.28 |
| Ketu (mean node) | 120.874148 | n/a | +0.28 |
| Rahu (true node) | 300.869838 | n/a | -1397.11 |
| Ketu (true node) | 120.869838 | n/a | -1397.11 |
| Cusp 1 | 241.563216 | +0.04 | +8.29 |
| Cusp 2 | 269.829374 | +0.04 | +8.30 |
| Cusp 3 | 299.963994 | +0.06 | +8.31 |
| Cusp 4 | 332.222781 | +0.07 | +8.31 |
| Cusp 5 | 4.340475 | +0.06 | +8.29 |
| Cusp 6 | 34.029122 | +0.05 | +8.28 |
| Cusp 7 | 61.563216 | +0.04 | +8.29 |
| Cusp 8 | 89.829374 | +0.04 | +8.30 |
| Cusp 9 | 119.963994 | +0.06 | +8.31 |
| Cusp 10 | 152.222781 | +0.07 | +8.31 |
| Cusp 11 | 184.340475 | +0.06 | +8.29 |
| Cusp 12 | 214.029122 | +0.05 | +8.28 |

**KP New** — error = stack − Swiss Ephemeris, arc-seconds

| Quantity | SE (deg) | Stack A | Stack B |
|---|---|---|---|
| Ayanamsa, mean | 24.155969 | +0.00 | +0.01 |
| Ayanamsa, true (mean + Δψ) | 24.158240 | +0.11 | n/a (B uses mean only) |
| Sun | 214.563533 | n/a | +7.53 |
| Moon | 346.545732 | n/a | +12.67 |
| Mars | 123.807044 | n/a | +7.93 |
| Mercury | 195.079469 | n/a | +7.47 |
| Jupiter | 122.092127 | n/a | +6.43 |
| Venus | 179.656955 | n/a | +1.13 |
| Saturn | 344.128665 | n/a | -1.91 |
| Rahu (mean node) | 300.854025 | n/a | +0.27 |
| Ketu (mean node) | 120.854025 | n/a | +0.27 |
| Rahu (true node) | 300.849715 | n/a | -1397.12 |
| Ketu (true node) | 120.849715 | n/a | -1397.12 |
| Cusp 1 | 241.543093 | +0.04 | +8.28 |
| Cusp 2 | 269.809251 | +0.04 | +8.30 |
| Cusp 3 | 299.943871 | +0.06 | +8.31 |
| Cusp 4 | 332.202658 | +0.07 | +8.30 |
| Cusp 5 | 4.320352 | +0.06 | +8.29 |
| Cusp 6 | 34.008999 | +0.05 | +8.28 |
| Cusp 7 | 61.543093 | +0.04 | +8.28 |
| Cusp 8 | 89.809251 | +0.04 | +8.30 |
| Cusp 9 | 119.943871 | +0.06 | +8.31 |
| Cusp 10 | 152.202658 | +0.07 | +8.30 |
| Cusp 11 | 184.320352 | +0.06 | +8.29 |
| Cusp 12 | 214.008999 | +0.05 | +8.28 |


#### 2010-12-21 03:00:00 UTC Tromsø (JD UT 2455551.625000)

**KP Old** — error = stack − Swiss Ephemeris, arc-seconds

| Quantity | SE (deg) | Stack A | Stack B |
|---|---|---|---|
| Ayanamsa, mean | 23.913476 | -0.00 | -0.00 |
| Ayanamsa, true (mean + Δψ) | 23.918211 | -0.04 | n/a (B uses mean only) |
| Sun | 245.206313 | n/a | +17.20 |
| Moon | 62.447770 | n/a | +18.16 |
| Mars | 256.079316 | n/a | +18.22 |
| Mercury | 242.650395 | n/a | +18.29 |
| Jupiter | 331.331471 | n/a | +16.35 |
| Venus | 199.807322 | n/a | +16.72 |
| Saturn | 172.165453 | n/a | +13.02 |
| Rahu (mean node) | 248.965179 | n/a | +0.20 |
| Ketu (mean node) | 68.965179 | n/a | +0.20 |
| Rahu (true node) | 248.817899 | n/a | -553.74 |
| Ketu (true node) | 68.817899 | n/a | -553.74 |
| Cusp 1 (SE Porphyry fallback) | 187.231406 | -0.01 | +12108.21 |
| Cusp 2 (SE Porphyry fallback) | 227.355269 | -0.00 | -43314.54 |
| Cusp 3 (SE Porphyry fallback) | 267.479133 | +0.00 | -47893.34 |
| Cusp 4 (SE Porphyry fallback) | 307.602996 | +0.01 | +17.12 |
| Cusp 5 (SE Porphyry fallback) | 327.479133 | +0.00 | +41470.68 |
| Cusp 6 (SE Porphyry fallback) | 347.355269 | -0.00 | +38661.57 |
| Cusp 7 (SE Porphyry fallback) | 7.231406 | -0.01 | +12108.21 |
| Cusp 8 (SE Porphyry fallback) | 47.355269 | -0.00 | -43314.54 |
| Cusp 9 (SE Porphyry fallback) | 87.479133 | +0.00 | -47893.34 |
| Cusp 10 (SE Porphyry fallback) | 127.602996 | +0.01 | +17.12 |
| Cusp 11 (SE Porphyry fallback) | 147.479133 | +0.00 | +41470.68 |
| Cusp 12 (SE Porphyry fallback) | 167.355269 | -0.00 | +38661.57 |

**KP New** — error = stack − Swiss Ephemeris, arc-seconds

| Quantity | SE (deg) | Stack A | Stack B |
|---|---|---|---|
| Ayanamsa, mean | 23.933600 | +0.00 | +0.00 |
| Ayanamsa, true (mean + Δψ) | 23.938335 | -0.04 | n/a (B uses mean only) |
| Sun | 245.186189 | n/a | +17.20 |
| Moon | 62.427646 | n/a | +18.15 |
| Mars | 256.059192 | n/a | +18.21 |
| Mercury | 242.630271 | n/a | +18.29 |
| Jupiter | 331.311347 | n/a | +16.35 |
| Venus | 199.787198 | n/a | +16.72 |
| Saturn | 172.145329 | n/a | +13.02 |
| Rahu (mean node) | 248.945055 | n/a | +0.20 |
| Ketu (mean node) | 68.945055 | n/a | +0.20 |
| Rahu (true node) | 248.797774 | n/a | -553.75 |
| Ketu (true node) | 68.797774 | n/a | -553.75 |
| Cusp 1 (SE Porphyry fallback) | 187.211282 | -0.01 | +12108.21 |
| Cusp 2 (SE Porphyry fallback) | 227.335145 | -0.00 | -43314.55 |
| Cusp 3 (SE Porphyry fallback) | 267.459009 | +0.00 | -47893.34 |
| Cusp 4 (SE Porphyry fallback) | 307.582872 | +0.01 | +17.12 |
| Cusp 5 (SE Porphyry fallback) | 327.459009 | +0.00 | +41470.68 |
| Cusp 6 (SE Porphyry fallback) | 347.335145 | -0.00 | +38661.56 |
| Cusp 7 (SE Porphyry fallback) | 7.211282 | -0.01 | +12108.21 |
| Cusp 8 (SE Porphyry fallback) | 47.335145 | -0.00 | -43314.55 |
| Cusp 9 (SE Porphyry fallback) | 87.459009 | +0.00 | -47893.34 |
| Cusp 10 (SE Porphyry fallback) | 127.582872 | +0.01 | +17.12 |
| Cusp 11 (SE Porphyry fallback) | 147.459009 | +0.00 | +41470.68 |
| Cusp 12 (SE Porphyry fallback) | 167.335145 | -0.00 | +38661.56 |

### 2.3 Max and mean |error| per body and stack

Cusps exclude Tromsø (SE has no Placidus there; see 2.5). n = values per stack.

| Body | Stack A max | Stack A mean | Stack B max | Stack B mean | n |
|---|---|---|---|---|---|
| ayanamsa (KP Old, mean) | 0.00 | 0.00 | 0.00 | 0.00 | 5 |
| Sun | n/a | n/a | 17.29 | 11.60 | 10 |
| Moon | n/a | n/a | 18.16 | 12.15 | 10 |
| Mars | n/a | n/a | 18.22 | 11.38 | 10 |
| Mercury | n/a | n/a | 18.29 | 11.76 | 10 |
| Jupiter | n/a | n/a | 17.49 | 10.76 | 10 |
| Venus | n/a | n/a | 18.21 | 10.85 | 10 |
| Saturn | n/a | n/a | 18.38 | 9.79 | 10 |
| Rahu mean | n/a | n/a | 0.28 | 0.17 | 10 |
| Ketu mean | n/a | n/a | 0.28 | 0.17 | 10 |
| Rahu true | n/a | n/a | 2470.50 | 969.65 | 10 |
| Ketu true | n/a | n/a | 2470.50 | 969.65 | 10 |
| Cusp 1 | 0.19 | 0.10 | 17.57 | 10.30 | 8 |
| Cusp 2 | 0.17 | 0.07 | 17.57 | 10.28 | 8 |
| Cusp 3 | 0.14 | 0.06 | 17.56 | 10.28 | 8 |
| Cusp 4 | 0.13 | 0.06 | 17.55 | 10.28 | 8 |
| Cusp 5 | 0.14 | 0.07 | 17.55 | 10.28 | 8 |
| Cusp 6 | 0.17 | 0.10 | 17.56 | 10.29 | 8 |
| Cusp 7 | 0.19 | 0.10 | 17.57 | 10.30 | 8 |
| Cusp 8 | 0.17 | 0.07 | 17.57 | 10.28 | 8 |
| Cusp 9 | 0.14 | 0.06 | 17.56 | 10.28 | 8 |
| Cusp 10 | 0.13 | 0.06 | 17.55 | 10.28 | 8 |
| Cusp 11 | 0.14 | 0.07 | 17.55 | 10.28 | 8 |
| Cusp 12 | 0.17 | 0.10 | 17.56 | 10.29 | 8 |
| ayanamsa (KP New, mean) | 0.00 | 0.00 | 0.01 | 0.00 | 5 |

**Root cause of Stack B's offset:** the error per case ≈ SE Δψ (KL 1992 +17.43″, Greenwich −13.93″, Chennai −1.27″, PJ +8.17″, Tromsø +17.05″). Subtracting Δψ leaves these residuals (astronomy-engine's own accuracy, 10 values per row):

| Body | max | mean |
|---|---|---|
| Sun | 1.00 | 0.43 |
| Moon | 4.50 | 1.66 |
| Mars | 2.15 | 0.96 |
| Mercury | 3.44 | 1.70 |
| Jupiter | 4.01 | 1.77 |
| Venus | 7.04 | 2.23 |
| Saturn | 10.08 | 3.76 |
| Cusps (96) | 0.20 | 0.10 |

Inputs to the cusps (KP Old, 4 non-polar cases): ARMC error A ≤ 0.205″, B ≤ 0.124″. True obliquity error A ≤ 0.061″, B ≤ 0.051″. Δψ error A ≤ 0.141″.

Ayanamsa over 60 epochs (every 5 years, 1800–2100) vs SE mean ayanamsa: A KP Old max 0.0002″, KP New 0.0001″. B KP Old 0.0011″, KP New 0.0312″ (at 1800; 0.0102″ at 1950).

Stack B's existing test expectations were checked against SE: `test/ayanamsa.test.ts` epochs agree to < 0.005″; `test/ephemeris.test.ts` tropical references agree to ≤ 0.4″. These tests pass because they check **tropical** longitudes, where the Δψ bug does not show.

### 2.4 KP impact: sub and sub-sub lord vs SE

- **Stack A:** 0 mismatches in 96 Placidus cusps + 24 Tromsø Porphyry cusps.
- **Stack B as shipped:** 36 mismatches, listed below. Excluding true nodes and Tromsø cusps: 4 of 186 (70 planets + 20 mean nodes + 96 cusps), all caused by the Δψ offset.
- **Stack B with Δψ subtracted** (recomputed offline from the same output): 0 of 186.
- **Horary (Stack B):** for numbers 1, 100, 145 and 249 (KL 1992 instant, KP Old), the computed Asc equals the sub start to 4e-10″, and the cusps equal `swe.houses_armc` at the inverted ARMC to 4e-10″. In SE terms, though, the sidereal Asc is `start − Δψ`. That puts it up to 17″ inside the **previous** sub whenever Δψ > 0 (#33).

| Case | Ayanamsa | Stack | Point | SE lon | SE sub / sub-sub | Stack lon | Stack sub / sub-sub | SE dist. to sub / sub-sub boundary (″) |
|---|---|---|---|---|---|---|---|---|
| kl1992 | KP Old | B | Ketu (true) | 72.901236 | Mercury / Ketu | 73.003468 | Mercury / Venus | 1244.4 / 115.6 |
| kl1992 | KP New | B | Ketu (true) | 72.881110 | Mercury / Ketu | 72.983343 | Mercury / Venus | 1172.0 / 188.0 |
| kl1992 | KP New | B | Cusp 9 | 192.930605 | Mercury / Ketu | 192.935482 | Mercury / Venus | 1350.2 / 9.8 |
| chn1950 | KP Old | B | Rahu (true) | 340.787486 | Sun / Mercury | 341.473733 | Moon / Saturn | 765.0 / 115.0 |
| chn1950 | KP Old | B | Ketu (true) | 160.787486 | Moon / Mercury | 161.473733 | Mars / Saturn | 1165.0 / 65.0 |
| chn1950 | KP New | B | Rahu (true) | 340.767358 | Sun / Mercury | 341.453608 | Moon / Jupiter | 837.5 / 42.5 |
| chn1950 | KP New | B | Ketu (true) | 160.767358 | Moon / Mercury | 161.453608 | Mars / Saturn | 1237.5 / 137.5 |
| pj2026 | KP Old | B | Rahu (true) | 300.869838 | Mercury / Moon | 300.481752 | Mercury / Venus | 3131.4 / 268.6 |
| pj2026 | KP Old | B | Ketu (true) | 120.869838 | Venus / Venus | 120.481752 | Ketu / Jupiter | 331.4 / 331.4 |
| pj2026 | KP New | B | Rahu (true) | 300.849715 | Mercury / Moon | 300.461627 | Mercury / Venus | 3059.0 / 225.6 |
| pj2026 | KP New | B | Ketu (true) | 120.849715 | Venus / Venus | 120.461627 | Ketu / Jupiter | 259.0 / 259.0 |
| tromso2010 | KP Old | B | Rahu (true) | 248.817899 | Jupiter / Moon | 248.664081 | Jupiter / Venus | 1855.6 / 11.1 |
| tromso2010 | KP Old | B | Ketu (true) | 68.817899 | Jupiter / Jupiter | 68.664081 | Rahu / Mars | 544.4 / 308.9 |
| tromso2010 | KP Old | B | Cusp 1 (SE Porphyry fallback) | 187.231406 | Rahu / Jupiter | 190.594798 | Saturn / Saturn | 2033.1 / 6.9 |
| tromso2010 | KP Old | B | Cusp 2 (SE Porphyry fallback) | 227.355269 | Mercury / Venus | 215.323451 | Saturn / Jupiter | 2479.0 / 14.4 |
| tromso2010 | KP Old | B | Cusp 3 (SE Porphyry fallback) | 267.479133 | Moon / Mars | 254.175427 | Venus / Rahu | 524.9 / 41.8 |
| tromso2010 | KP Old | B | Cusp 6 (SE Porphyry fallback) | 347.355269 | Mercury / Venus | 358.094593 | Saturn / Saturn | 2479.0 / 14.4 |
| tromso2010 | KP Old | B | Cusp 7 (SE Porphyry fallback) | 7.231406 | Rahu / Sun | 10.594798 | Saturn / Moon | 1166.9 / 146.9 |
| tromso2010 | KP Old | B | Cusp 8 (SE Porphyry fallback) | 47.355269 | Saturn / Rahu | 35.323451 | Mercury / Mercury | 1521.0 / 507.7 |
| tromso2010 | KP Old | B | Cusp 9 (SE Porphyry fallback) | 87.479133 | Venus / Rahu | 74.175427 | Mercury / Saturn | 3324.9 / 458.2 |
| tromso2010 | KP Old | B | Cusp 11 (SE Porphyry fallback) | 147.479133 | Moon / Mars | 158.998767 | Venus / Jupiter | 524.9 / 41.8 |
| tromso2010 | KP Old | B | Cusp 12 (SE Porphyry fallback) | 167.355269 | Saturn / Rahu | 178.094593 | Saturn / Saturn | 1521.0 / 507.7 |
| tromso2010 | KP New | B | Rahu (true) | 248.797774 | Jupiter / Sun | 248.643956 | Jupiter / Venus | 1928.0 / 61.3 |
| tromso2010 | KP New | B | Ketu (true) | 68.797774 | Jupiter / Jupiter | 68.643956 | Rahu / Mars | 472.0 / 381.3 |
| tromso2010 | KP New | B | Cusp 1 (SE Porphyry fallback) | 187.211282 | Rahu / Jupiter | 190.574673 | Saturn / Saturn | 1960.6 / 79.4 |
| tromso2010 | KP New | B | Cusp 2 (SE Porphyry fallback) | 227.335145 | Mercury / Venus | 215.303326 | Saturn / Jupiter | 2406.5 / 86.8 |
| tromso2010 | KP New | B | Cusp 3 (SE Porphyry fallback) | 267.459009 | Moon / Mars | 254.155302 | Venus / Rahu | 452.4 / 114.2 |
| tromso2010 | KP New | B | Cusp 6 (SE Porphyry fallback) | 347.335145 | Mercury / Venus | 358.074468 | Saturn / Saturn | 2406.5 / 86.8 |
| tromso2010 | KP New | B | Cusp 7 (SE Porphyry fallback) | 7.211282 | Rahu / Sun | 10.574673 | Saturn / Moon | 1239.4 / 140.6 |
| tromso2010 | KP New | B | Cusp 8 (SE Porphyry fallback) | 47.335145 | Saturn / Rahu | 35.303326 | Mercury / Mercury | 1593.5 / 559.9 |
| tromso2010 | KP New | B | Cusp 9 (SE Porphyry fallback) | 87.459009 | Venus / Rahu | 74.155302 | Mercury / Saturn | 3252.4 / 385.8 |
| tromso2010 | KP New | B | Cusp 11 (SE Porphyry fallback) | 147.459009 | Moon / Mars | 158.978642 | Venus / Jupiter | 452.4 / 114.2 |
| tromso2010 | KP New | B | Cusp 12 (SE Porphyry fallback) | 167.335145 | Saturn / Rahu | 178.074468 | Saturn / Saturn | 1593.5 / 559.9 |
| kl1992 | KP Old | B | Venus | 302.551645 | Ketu / Saturn | 302.556703 | Ketu / Mercury | 414.1 / 17.4 |
| kl1992 | KP New | B | Sun | 326.923941 | Venus / Venus | 326.928743 | Venus / Sun | 1326.2 / 7.1 |
| tromso2010 | KP Old | B | Jupiter | 331.331471 | Mars / Moon | 331.336013 | Rahu / Rahu | 6.7 / 6.7 |

### 2.5 Tromsø (69.6492 N) — Placidus failure behaviour

| | Behaviour |
|---|---|
| Swiss Ephemeris | `houses_ex` raises; `houses_ex2` reports `within polar circle, switched to Porphyry`. The C library returns Porphyry cusps |
| Stack A | `\|φ\| ≥ 90° − ε` → Porphyry, `isPolarFallback: true`, `warnings: ["Latitude 69.65° is within polar circle. Switched to Porphyry house division."]`. Cusps = SE Porphyry to ≤ 0.01″; 0 lord mismatches. **But** `calculateKPChart` drops `warnings`/`isPolarFallback`; the API response doesn't say that Porphyry was used |
| Stack B | Clamps latitude to 66° and computes Placidus for 66 N. Cusps off by 17″ to 47,893″ (13.3°); 9 of 12 cusps have the wrong sub or sub-sub lord. No warning. Also wrong for 66.0°–66.56°, where Placidus is valid (grid: 33,687″ at 66.5°) |
| Day lord | Polar night: SE `rise_trans` finds no sunrise. Stack B substitutes "06:00 local" without a warning (day lord Moon) |

Placidus grid (same ARMC/lat/ε, 672 points where SE succeeds): A max 4e-10″ at every latitude up to 66.5°. B max 0.0028″ up to 66°, 33,687″ at 66.5°.

### 2.6 Other logic checked against an independent computation

| Check | Result |
|---|---|
| Day lord at sunrise (SE `rise_trans`, upper limb + refraction) | B sunrise within 11–22 s of SE. Day lord correct in 3 of 4 cases. **Wrong** for KL 1992 06:14 (before 07:21 sunrise): B Mercury, expected Mars (#36) |
| Dasha lord + balance at birth (Moon from SE, KP Old) | B correct in 5 of 5. Running bhukti at birth wrong in 5 of 5 (#37): expected Rahu, Mars, Ketu, Jupiter, Ketu; B gives the dasha lord's own bhukti |
| House assignment (B planets into B cusps, A vs B functions) | 0 of 36 differ |
| Significators (A vs B on the same planets/cusps) | 0 of 192 level lists differ |
| Node agents (B `agentsFor`) | Can include the node itself or the other node (KL 1992 Rahu → [Jupiter, Ketu]; PJ 2026 Ketu → [Sun, Ketu, Mars, Jupiter]). Rule set is #23 |

---

## 3. Recommendation and porting order

### 3.1 Implementation to keep, per capability

| Capability | Keep | Evidence |
|---|---|---|
| Types home | `src/engine/types.ts`, extended with B's richer types (`PlanetName`, `KPPlanetLord`, `NodeMode`, boundary fields, dasha, RP, horary) | A is the live, vitest-tested stack; B's types carry more domain information |
| Time, ΔT, nutation, ε, GAST/ARMC | **astronomy-engine** (B's `calculateRamc` + `e_tilt`) | Both give cusps ≤ 0.20″. Planets must come from astronomy-engine, and the Δψ removed from them must be the same Δψ astronomy-engine applied. One nutation model, not two |
| Ayanamsa | **A** `calculateAyanamsa` polynomial (mean), true = mean + astronomy-engine Δψ | max 0.0002″ vs B 0.0312″ (1800–2100). Both are far below the smallest sub-sub span (120″) |
| Planets Sun…Saturn | **B** `calculatePlanetaryPositions` (the only one), with #33 fixed | ≤ 10.08″ after the fix. Drop `fetchJplHorizonsPosition` (dead network call, always `null`) |
| Mean node | **B** `calculateMeanLunarNode` | ≤ 0.28″ |
| True node | **B**, rewritten (#34) | currently ≤ 2470″ off; target < 1″ vs SE `TRUE_NODE` |
| Placidus | **A** `calculatePlacidusCusps` | = SE `houses_armc` to 4e-10″ on 672 grid points; polar fallback with flag; non-convergence handled |
| Asc → ARMC inversion | **B** `invertAscendantToRamc`, ported onto A's `asc1` **without** the latitude clamp | Asc = sub start to 4e-10″ |
| Lords | **A** `getPositionLords` + B's sub span / boundary-distance / `isNearSubBoundary` fields | identical on 724,374 longitudes |
| 1–249 table | **A** `getHorary249Table` + B's `getHoraryEntry` range check and DMS strings | identical tables |
| House assignment | **A** `house-assignment.ts` | identical results; already tested |
| Significators | **A** `significators.ts` + node-agent layer behind explicit config `TODO(#23)` | identical levels |
| Chart wheels | **A** | A only |
| Dasha | **B** `dasha.ts`, with #37 fixed; year length as explicit config | B only |
| Ruling planets | **B** `ruling-planets.ts`, with #36 fixed; membership `TODO(#24)` | B only |
| Horary chart | **B** `horary.ts`, on the unified engine | B only; Asc = sub start, midpoint behind a toggle (matches CLAUDE.md) |
| Chart assembly | **A** `calculateKPChart`, extended to compute planets, nodes, dasha, RP and warnings (incl. polar fallback) | live entrypoint and UI call it |
| Entrypoint | **A** Hono `src/index.ts`; port B's `/api/ayanamsa`, `/api/horary`, `/api/horary-table` routes | matches `wrangler.jsonc` |
| Ayanamsa wire value | `'kp_old' \| 'kp_new'` (A and `core/validation.ts`) | live UI sends it; reject anything else (no silent KP Old) |

### 3.2 Work packages

All packages branch from `build/integration`, own disjoint files inside their parallel group, and pin expected values to Appendix A (tolerance as in each package; lords exact unless SE puts the point closer to a boundary than the tolerance). No package may loosen an existing expected value without citing Appendix A. Until `entrypoint`, Stack B files remain in place and keep compiling.

| Order | Package | Parallel group | Depends on |
|---|---|---|---|
| 1 | `unify-types` | G1 | fix-build (#30, merged) |
| 2 | `port-ephemeris` | G2 | unify-types |
| 3 | `port-houses` | G2 | unify-types |
| 4 | `port-lords` | G2 | unify-types |
| 5 | `port-dasha` | G2 | unify-types |
| 6 | `port-ruling-planets` | G2 | unify-types |
| 7 | `port-significators` | G2 | unify-types |
| 8 | `port-chart` | G3 | port-ephemeris, port-houses, port-lords, port-dasha, port-ruling-planets, port-significators |
| 9 | `port-horary` | G4 | port-chart |
| 10 | `entrypoint` | G5 | all of the above |

#### 1. `unify-types`
- **Goal:** make `src/engine/types.ts` the single domain type module. It becomes the superset of A's and B's types: `AyanamsaMode = 'kp_old'|'kp_new'`, `NodeMode`, `PlanetName`, `KPPlanetLord`, the lords type with B's boundary fields, planet position, cusp, dasha, ruling planets, horary table entry, horary result, warnings, and chart result. Changes are additive, so existing A code compiles unchanged. `src/types.ts` and `src/core/types.ts` re-export the identical parts so Stack B and `core/*` keep compiling. Option fields that wait on owner decisions are typed but have no silent default: ayanamsa `TODO(#22)`, node agents `TODO(#23)`, RP set `TODO(#24)`, node mode, dasha year.
- **Owns:** `src/engine/types.ts` (edit), `src/types.ts` (edit, shim), `src/core/types.ts` (edit, re-export `AyanamsaMode`), `test/types.test.ts` (new).
- **Depends on:** fix-build.
- **Tests:** existing all 87 green. New `test/types.test.ts` with `expectTypeOf` checks: `AyanamsaMode` is exactly `'kp_old'|'kp_new'` (no Lahiri), and lord fields are `KPPlanetLord`.

#### 2. `port-ephemeris`
- **Goal:** one ephemeris in `src/engine`. Planets Sun…Saturn (+ outer planets per open question 11), speed and retrograde come from astronomy-engine. Time/ΔT, GAST, ε and Δψ come from astronomy-engine, so planets and cusps share one nutation model. Sidereal = tropical − (mean ayanamsa + Δψ) (fixes #33). Mean node as in B. True node rewritten in the ecliptic of date (fixes #34). Node mode is an explicit parameter. A's ayanamsa polynomial is kept. `calculateNutation` / `calculateSiderealTime` / `calculateObliquity` either delegate to astronomy-engine or are removed with their callers updated. `fetchJplHorizonsPosition` is not ported.
- **Owns:** `src/engine/astronomy.ts` (edit), `src/engine/ephemeris.ts` (new), `test/astronomy.test.ts`, `test/ayanamsa.test.ts`, `test/ephemeris.test.ts` (re-point to `src/engine`; the `formatDms` block may keep importing B until `entrypoint`), `test/ephemeris-reference.test.ts` (new). Does **not** edit `src/ephemeris/*`.
- **Depends on:** unify-types.
- **Tests:** existing `astronomy`, `ayanamsa`, `ephemeris` (their SE-derived expectations are correct, see 2.3). New `ephemeris-reference.test.ts`, for all 5 cases × 2 ayanamsas from Appendix A: ayanamsa ≤ 0.01″; Sun ≤ 2″, Moon ≤ 6″, Mercury…Saturn ≤ 12″ (measured max + margin, owner may tighten, open question 9); mean node ≤ 1″; true node ≤ 5″; plus a regression test that the sidereal Sun for KL 1992 is 326.94407° ± 2″ (it was 326.94887°, #33).

#### 3. `port-houses`
- **Goal:** keep A's Placidus as the only Placidus. Add `ascendantToArmc` (B's inversion algorithm on A's `asc1`, no latitude clamp; throws or flags inside the polar circle). Surface `isPolarFallback`/`warnings` in the result type so `port-chart` can return them. Polar handling follows the owner's answer to open question 6; until then keep today's A behaviour (SE-equivalent Porphyry + warning) behind an explicit option with a `TODO`.
- **Owns:** `src/engine/placidus.ts` (edit), `test/placidus.test.ts` (edit).
- **Depends on:** unify-types.
- **Tests:** existing `placidus.test.ts`. New: the Appendix A.6 grid ≤ 0.01″; Tromsø Porphyry cusps (A.5) ≤ 0.1″ with `isPolarFallback === true`; 66.5 N (A.6) is Placidus, **not** clamped (regression for #35); `ascendantToArmc` round-trip ≤ 1e-6″ for Asc = start of horary subs 1, 100, 145, 249 at KL latitude.

#### 4. `port-lords`
- **Goal:** one lords module. Add B's `subSpanStart/End`, `distanceFromSubStartArcsec`, `distanceToSubEndArcsec` and `isNearSubBoundary` (threshold explicit, default 60″ as in B, open question 9) to `getPositionLords`. Add `getHoraryEntry(n)` with range checking and the DMS strings to the 249 table. Keep one DMS formatter. Keep the exported constant names (`VIMSHOTTARI_LORDS`, `DASHA_YEARS`, `NAKSHATRAS`, `NAKSHATRA_SPAN_DEG`, `ZODIAC_SIGNS`) stable, because `port-dasha` and `port-ruling-planets` import them.
- **Owns:** `src/engine/kp-lords.ts` (edit), `test/kp-lords.test.ts` (edit).
- **Depends on:** unify-types.
- **Tests:** existing `kp-lords.test.ts`. New: lords for every Appendix A longitude (all 5 cases, both modes) equal the listed sign/star/sub/sub-sub. Boundary ±1e-7° at all 2,187 sub-sub starts. 249 entries; entries 22/23 and 105/106 split at 30° / 150° (moved from `horary.test.ts` expectations, which stay there too).

#### 5. `port-dasha`
- **Goal:** port Vimshottari dasha/bhukti/antara to `src/engine/dasha.ts` on unified types, and fix #37. The balance dasha starts at the running bhukti and antara with their remaining fractions. Year length is an explicit parameter with `TODO` (open question 8), not a hidden constant.
- **Owns:** `src/engine/dasha.ts` (new), `test/dasha.test.ts` (new).
- **Depends on:** unify-types (imports constants from `kp-lords.ts` read-only).
- **Tests:** new. For the 5 cases (Moon from Appendix A, KP Old), dasha lord, balance years (±1e-6 y) and running bhukti + years left, as in the 2.6 table / #37: KL 1992 Moon 8.477870 y, Rahu bhukti 1.394536 y left; Greenwich Mars bhukti 0.584035 y; Chennai Ketu 0.233627 y; PJ Jupiter 0.143656 y; Tromsø Ketu 0.114921 y. The sum of the 9 bhuktis of a full dasha equals the dasha length.

#### 6. `port-ruling-planets`
- **Goal:** port the day lord and ruling planets to `src/engine/ruling-planets.ts`, and fix #36. The day lord is the weekday of the most recent local sunrise at or before the moment. Keep sunrise from astronomy-engine `SearchRiseSet`; the definition is open question 7. The RP membership list is explicit config with `TODO(#24)`. Polar night/day must return an explicit flag, not a silent "6 AM".
- **Owns:** `src/engine/ruling-planets.ts` (new), `test/ruling-planets.test.ts` (new).
- **Depends on:** unify-types.
- **Tests:** new. KL 1992 06:14 +08:00 → Mars (regression #36); Greenwich 2000 → Saturn; Chennai 1950 → Jupiter; PJ 2026 → Saturn; sunrise within 60 s of the SE values (Appendix A.7); Tromsø 2010-12-21 → explicit "no sunrise" flag.

#### 7. `port-significators`
- **Goal:** keep A's 4-level significators (identical to B). Add node-agent handling as an explicit, named rule-set option with `TODO(#23)`. Port B's current rule set only as one named option and fix its doc string (it claims aspects it does not implement). Don't pick a default.
- **Owns:** `src/engine/significators.ts` (edit), `test/significators-and-wheels.test.ts` (edit).
- **Depends on:** unify-types.
- **Tests:** existing `significators-and-wheels.test.ts`. New: for KL 1992 (Appendix A planets/cusps, KP Old, mean node), house-wise levels equal those produced today by both stacks (A = B, 0 of 48 differ), pinned as a fixture.

#### 8. `port-chart`
- **Goal:** make `calculateKPChart` the single chart entry. It computes planets itself (ephemeris), takes explicit `ayanamsa` (`TODO(#22)`), node mode and options, and returns cusps, planets with cuspal house and lords, significators, wheels, dasha, ruling planets, near-boundary warnings and polar-fallback warnings. Externally supplied planet longitudes are no longer the only path (whether to keep that input is part of open question 10).
- **Owns:** `src/engine/index.ts` (edit), `src/engine/house-assignment.ts` (edit if needed), `src/engine/chart-wheels.ts` (edit if needed), `test/house-assignment.test.ts`, `test/significators-and-dasha.test.ts` (re-point from `src/kp/engine` to `calculateKPChart`), `test/chart-reference.test.ts` (new).
- **Depends on:** port-ephemeris, port-houses, port-lords, port-dasha, port-ruling-planets, port-significators.
- **Tests:** existing 2 files. New `chart-reference.test.ts`: full charts for the 5 cases × 2 ayanamsas, with cusps ≤ 0.5″ and planets within the port-ephemeris tolerances. Sub/sub-sub lords equal Appendix A for every point whose SE distance to the boundary exceeds the tolerance (exceptions within tolerance of a boundary: Chennai 1950 Saturn KP Old 5.2″, PJ 2026 Mars KP Old 11.1″, Tromsø 2010 Jupiter KP Old 6.7″; assert `isNearSubBoundary` there instead). Tromsø returns a polar warning.

#### 9. `port-horary`
- **Goal:** port the horary chart to `src/engine/horary.ts`. Asc = **start** of the chosen sub, midpoint only via an explicit toggle. ARMC comes from `ascendantToArmc`; planets at the question time; same options as `calculateKPChart`. With #33 fixed, the sidereal Asc must equal the sub start in SE terms (cusps from SE `houses_armc` at the returned ARMC minus the true ayanamsa).
- **Owns:** `src/engine/horary.ts` (new), `test/horary.test.ts` (re-point to `src/engine`).
- **Depends on:** port-chart.
- **Tests:** existing `horary.test.ts`. New: for horary numbers 1, 100, 145, 249 at the KL 1992 instant (KP Old), SE-sidereal Asc − sub start ∈ [0, 0.5″] (never negative, i.e. never in the previous sub); midpoint toggle gives the midpoint.

#### 10. `entrypoint`
- **Goal:** `src/index.ts` (Hono) is the only entrypoint. Port `worker.ts` routes into Hono: `/api/ayanamsa`, `/api/horary`, `/api/horary-table` (+ `?number=`), and natal `/api/calculate` (or alias it to `/api/chart/calculate`). Validate `ayanamsa` with `validateAyanamsa` instead of silently mapping unknown values to KP Old. Remove the hard-coded `SAMPLE_CHARTS` planet longitudes labelled "verified against Swiss Ephemeris" (they are invented round numbers), or replace them with Appendix A values. Then delete Stack B: `src/worker.ts`, `src/types.ts`, `src/ephemeris/ayanamsa.ts`, `src/ephemeris/jpl-ephemeris.ts`, `src/houses/placidus.ts`, `src/kp/{engine,horary,horary-table,dasha,ruling-planets,significators,sub-lords}.ts`. Re-point any remaining test imports.
- **Owns:** `src/index.ts`, `src/worker.ts` (delete), the Stack B files above (delete), `test/api.test.ts`, `test/worker.test.ts` (fold its cases into `api.test.ts` using `app.request`, then delete), and any leftover B imports in `test/*.test.ts`. `wrangler.jsonc` should need no change (`main` is already `src/index.ts`). `public/index.html` only if the owner says so (open question 10).
- **Depends on:** all previous packages.
- **Tests:** `api.test.ts` covers every route, including: `ayanamsa: 'lahiri'` → 400; `kp_new` round-trip; horary 0/250 → 400. `npm run typecheck` and `npm test` green on clean `npm ci`. `grep -r "src/kp\|src/ephemeris\|src/houses\|worker" src test` is empty.

---

## 4. Open questions for the owner

Nothing below was decided by the audit. Where code defaults exist today, they are listed so the owner can see what currently happens.

1. **#22 default ayanamsa (open).** Today KP Old is the silent default in: `src/engine/index.ts:40`, `src/engine/astronomy.ts:224`, `src/index.ts:113` and `:138` (any value other than `'kp_new'`, including `'lahiri'` or a typo, becomes KP Old), `src/kp/engine.ts:85`, `src/kp/horary.ts:53`, `src/ephemeris/ayanamsa.ts:68`, `src/ephemeris/jpl-ephemeris.ts:139`, `src/worker.ts:147`, `:195`. KP New − KP Old = 72.44–72.46″ in all 5 cases. Switching mode changes the sub or sub-sub lord of 16 of 103 reference points (KL 1992: Sun, cusps 6 and 9; Chennai 1950: Moon, Venus, Saturn, cusps 6 and 7; …).
2. **#23 Rahu/Ketu agent rules (open).** Stack A has none. Stack B (`src/kp/significators.ts`) uses sign lord + star lord + same-sign planets. Its doc string also claims aspects, which are not implemented. The result is not used in the house levels and can contain the node itself or the other node.
3. **#24 ruling-planet set (open).** Stack B (`src/kp/ruling-planets.ts:94`) uses a fixed 5-entry list `[AscStar, AscSign, MoonStar, MoonSign, DayLord]`, keeps duplicates, and has no nodes. Day lord at sunrise is fixed by CLAUDE.md, and the bug in it is #36.
4. **#25 Swiss Ephemeris licence path (open)** vs `docs/licensing.md`, which records NASA JPL / astronomy-engine as decided. Which one stands? The measured cost of astronomy-engine: planets ≤ 10.08″ vs SE (open question 9).
5. **Mean or true node by default?** No decision issue exists. Both stacks default to `MEAN` silently (`src/kp/engine.ts:86`, `src/kp/horary.ts:55`, `src/worker.ts:148`, `:197`). True − mean Rahu in the 5 cases: +0.45°, −1.09°, +0.52°, −0.004°, −0.15°. The node mode changes the Rahu sub or sub-sub lord in 8 of 10 case×ayanamsa pairs (Appendix A). Should a decision issue be opened?
6. **Polar latitudes (|φ| > 66.56°).** Placidus is undefined there. Options: Porphyry fallback with a visible warning (SE and Stack A behaviour), refuse the chart, or something else.
7. **Sunrise definition for the day lord:** upper limb + standard refraction (astronomy-engine and SE default; B within 11–22 s of SE), disc centre, or another convention? And what to do when there is no sunrise (polar night/day)? B silently uses 06:00 local today.
8. **Dasha year length.** B uses 365.2425 days. Should it be 365.25, 365.2425, 360 or another value? Over a 120-year cycle, 365.25 vs 365.2425 shifts dates by ≈ 0.9 days.
9. **Accuracy target.** astronomy-engine residual after the #33 fix: max 10.08″ (Saturn), Moon 4.50″. Sub-sub spans are 120″ at the smallest and 593″ on average, so a 10″ error flips the sub-sub lord for ≈ 1.7% of positions (2,187 boundaries × 10″ / 1,296,000″); at the mean residual of 1.8″ the rate is ≈ 0.3%. Is that acceptable, and what near-boundary warning threshold should the UI show (B uses 60″)?
10. **UI/API contract.** `public/index.html` reads fields that **neither** backend returns (`data.ayanamsaDeg`, `julianDate`, `siderealTimeDeg`, `obliquityDeg`, `nutationInLongitudeArcsec`, `c.formattedDms`, `p.assignedHouse`, `p.zodiacSign`, …) and asks the user to paste planet longitudes. `src/client/html.ts` called `/api/places/search`, `/api/timezone/offset` and `/api/charts/validate-input`, none of which exist. That file was deleted in #68; nothing else imported it. Which UI is canonical, and is fixing the contract in scope for `entrypoint`?
11. **Outer planets.** Stack B also returns Uranus, Neptune and Pluto. Should they stay in the chart output (they are not KP significators)?
12. **Ayanamsa wire value.** The recommendation is the lowercase `'kp_old'|'kp_new'` used by the live UI and `core/validation.ts`; B's `'KP_OLD'` would be dropped. Please confirm.

---

## Appendix A — Swiss Ephemeris reference values (test fixtures)

Generated with Swiss Ephemeris 2.10.03 (`pyswisseph`, `sepl_18`/`semo_18`), `FLG_SWIEPH`, sidereal via `FLG_SIDEREAL`, Placidus `b'P'`. Longitudes are sidereal degrees. Lords were computed independently (exact 120-year proportions) and agree with both stacks' lord functions. Ketu = Rahu + 180°. Tromsø cusps are SE's Porphyry fallback (`b'O'`), because SE refuses Placidus there.

#### A.1 1992-03-11 06:14:00 +08:00, Kuala Lumpur 3.1390 N, 101.6869 E

JD UT `2448692.426388889` · Δψ `17.4325″` · true obliquity `23.4407206°` · ARMC `244.0203059°`  
Ayanamsa KP Old: mean `23.65114606°`, true `23.65598842°` · KP New: mean `23.67127150°`, true `23.67611386°`

| Point | KP Old lon (°) | sign / star / sub / sub-sub | KP New lon (°) | sign / star / sub / sub-sub |
|---|---|---|---|---|
| Sun | 326.9440666 | Saturn / Jupiter / Venus / Sun | 326.9239411 | Saturn / Jupiter / Venus / Venus |
| Moon | 42.0295069 | Venus / Moon / Rahu / Rahu | 42.0093815 | Venus / Moon / Rahu / Rahu |
| Mars | 293.0611426 | Saturn / Moon / Sun / Saturn | 293.0410172 | Saturn / Moon / Sun / Saturn |
| Mercury | 345.0414661 | Jupiter / Saturn / Jupiter / Jupiter | 345.0213406 | Jupiter / Saturn / Jupiter / Jupiter |
| Jupiter | 134.6139223 | Sun / Venus / Venus / Jupiter | 134.5937968 | Sun / Venus / Venus / Jupiter |
| Venus | 302.5516451 | Saturn / Mars / Ketu / Saturn | 302.5315197 | Saturn / Mars / Ketu / Saturn |
| Saturn | 290.2731592 | Saturn / Moon / Ketu / Saturn | 290.2530337 | Saturn / Moon / Ketu / Saturn |
| Rahu (mean) | 252.4479023 | Jupiter / Ketu / Mercury / Mars | 252.4277768 | Jupiter / Ketu / Mercury / Mars |
| Ketu (mean) | 72.4479023 | Mercury / Rahu / Saturn / Jupiter | 72.4277768 | Mercury / Rahu / Saturn / Jupiter |
| Rahu (true) | 252.9012358 | Jupiter / Ketu / Mercury / Jupiter | 252.8811104 | Jupiter / Ketu / Mercury / Jupiter |
| Ketu (true) | 72.9012358 | Mercury / Rahu / Mercury / Ketu | 72.8811104 | Mercury / Rahu / Mercury / Ketu |
| Cusp 1 | 307.7290202 | Saturn / Rahu / Rahu / Mercury | 307.7088948 | Saturn / Rahu / Rahu / Mercury |
| Cusp 2 | 340.7950541 | Jupiter / Saturn / Sun / Mercury | 340.7749286 | Jupiter / Saturn / Sun / Mercury |
| Cusp 3 | 12.9507306 | Mars / Ketu / Mercury / Jupiter | 12.9306051 | Mars / Ketu / Mercury / Jupiter |
| Cusp 4 | 42.2556138 | Venus / Moon / Rahu / Jupiter | 42.2354883 | Venus / Moon / Rahu / Jupiter |
| Cusp 5 | 69.6173188 | Mercury / Rahu / Jupiter / Venus | 69.5971933 | Mercury / Rahu / Jupiter / Venus |
| Cusp 6 | 97.3822020 | Moon / Saturn / Ketu / Venus | 97.3620765 | Moon / Saturn / Ketu / Ketu |
| Cusp 7 | 127.7290202 | Sun / Ketu / Jupiter / Jupiter | 127.7088948 | Sun / Ketu / Jupiter / Jupiter |
| Cusp 8 | 160.7950541 | Mercury / Moon / Moon / Mercury | 160.7749286 | Mercury / Moon / Moon / Mercury |
| Cusp 9 | 192.9507306 | Venus / Rahu / Mercury / Venus | 192.9306051 | Venus / Rahu / Mercury / Ketu |
| Cusp 10 | 222.2556138 | Mars / Saturn / Mars / Rahu | 222.2354883 | Mars / Saturn / Mars / Rahu |
| Cusp 11 | 249.6173188 | Jupiter / Ketu / Saturn / Saturn | 249.5971933 | Jupiter / Ketu / Saturn / Saturn |
| Cusp 12 | 277.3822020 | Saturn / Sun / Ketu / Rahu | 277.3620765 | Saturn / Sun / Ketu / Rahu |

#### A.2 2000-01-01 12:00:00 UTC, Greenwich 51.4779 N, 0.0015 W

JD UT `2451545.000000000` · Δψ `-13.9315″` · true obliquity `23.4376767°` · ARMC `280.4555724°`  
Ayanamsa KP Old: mean `23.76024004°`, true `23.75637017°` · KP New: mean `23.78036498°`, true `23.77649512°`

| Point | KP Old lon (°) | sign / star / sub / sub-sub | KP New lon (°) | sign / star / sub / sub-sub |
|---|---|---|---|---|
| Sun | 256.6125485 | Jupiter / Venus / Moon / Jupiter | 256.5924236 | Jupiter / Venus / Moon / Jupiter |
| Moon | 199.5673813 | Venus / Rahu / Mars / Saturn | 199.5472563 | Venus / Rahu / Mars / Saturn |
| Mars | 304.2069324 | Saturn / Mars / Venus / Saturn | 304.1868074 | Saturn / Mars / Venus / Saturn |
| Mercury | 248.1329069 | Jupiter / Ketu / Jupiter / Mercury | 248.1127819 | Jupiter / Ketu / Jupiter / Mercury |
| Jupiter | 1.4967170 | Mars / Ketu / Venus / Mars | 1.4765921 | Mars / Ketu / Venus / Mars |
| Venus | 217.8094182 | Mars / Saturn / Ketu / Jupiter | 217.7892933 | Mars / Saturn / Ketu / Jupiter |
| Saturn | 16.6392933 | Mars / Venus / Moon / Jupiter | 16.6191684 | Mars / Venus / Moon / Jupiter |
| Rahu (mean) | 101.2842759 | Moon / Saturn / Moon / Rahu | 101.2641509 | Moon / Saturn / Moon / Rahu |
| Ketu (mean) | 281.2842759 | Saturn / Moon / Mars / Jupiter | 281.2641509 | Saturn / Moon / Mars / Rahu |
| Rahu (true) | 100.1976527 | Moon / Saturn / Venus / Mercury | 100.1775277 | Moon / Saturn / Venus / Mercury |
| Ketu (true) | 280.1976527 | Saturn / Moon / Moon / Rahu | 280.1775277 | Saturn / Moon / Moon / Rahu |
| Cusp 1 | 0.5065415 | Mars / Ketu / Ketu / Jupiter | 0.4864166 | Mars / Ketu / Ketu / Jupiter |
| Cusp 2 | 37.3842096 | Venus / Sun / Ketu / Rahu | 37.3640847 | Venus / Sun / Ketu / Rahu |
| Cusp 3 | 58.2630165 | Venus / Mars / Saturn / Mercury | 58.2428916 | Venus / Mars / Saturn / Mercury |
| Cusp 4 | 75.8533342 | Mercury / Rahu / Venus / Moon | 75.8332092 | Mercury / Rahu / Venus / Moon |
| Cusp 5 | 95.3039310 | Moon / Saturn / Saturn / Jupiter | 95.2838061 | Moon / Saturn / Saturn / Jupiter |
| Cusp 6 | 123.9419690 | Sun / Ketu / Moon / Rahu | 123.9218440 | Sun / Ketu / Moon / Rahu |
| Cusp 7 | 180.5065415 | Venus / Mars / Mercury / Venus | 180.4864166 | Venus / Mars / Mercury / Venus |
| Cusp 8 | 217.3842096 | Mars / Saturn / Ketu / Venus | 217.3640847 | Mars / Saturn / Ketu / Ketu |
| Cusp 9 | 238.2630165 | Mars / Mercury / Saturn / Mercury | 238.2428916 | Mars / Mercury / Saturn / Mercury |
| Cusp 10 | 255.8533342 | Jupiter / Venus / Sun / Jupiter | 255.8332092 | Jupiter / Venus / Sun / Jupiter |
| Cusp 11 | 275.3039310 | Saturn / Sun / Mercury / Mercury | 275.2838061 | Saturn / Sun / Mercury / Mercury |
| Cusp 12 | 303.9419690 | Saturn / Mars / Venus / Jupiter | 303.9218440 | Saturn / Mars / Venus / Jupiter |

#### A.3 1950-06-15 23:59:30 +05:30, Chennai 13.0827 N, 80.2707 E

JD UT `2433448.270486111` · Δψ `-1.2657″` · true obliquity `23.4480701°` · ARMC `261.1123491°`  
Ayanamsa KP Old: mean `23.06821122°`, true `23.06785963°` · KP New: mean `23.08833912°`, true `23.08798753°`

| Point | KP Old lon (°) | sign / star / sub / sub-sub | KP New lon (°) | sign / star / sub / sub-sub |
|---|---|---|---|---|
| Sun | 61.0003560 | Mercury / Mars / Mercury / Mars | 60.9802281 | Mercury / Mars / Mercury / Mars |
| Moon | 62.2216636 | Mercury / Mars / Ketu / Rahu | 62.2015357 | Mercury / Mars / Ketu / Mars |
| Mars | 158.4111041 | Mercury / Sun / Venus / Moon | 158.3909762 | Mercury / Sun / Venus / Moon |
| Mercury | 38.3696970 | Venus / Sun / Venus / Moon | 38.3495691 | Venus / Sun / Venus / Moon |
| Jupiter | 314.1821124 | Saturn / Rahu / Mercury / Saturn | 314.1619845 | Saturn / Rahu / Mercury / Saturn |
| Venus | 23.2874832 | Mars / Venus / Saturn / Mars | 23.2673553 | Mars / Venus / Saturn / Moon |
| Saturn | 140.3495955 | Sun / Venus / Jupiter / Saturn | 140.3294676 | Sun / Venus / Jupiter / Jupiter |
| Rahu (mean) | 340.2668205 | Jupiter / Saturn / Venus / Ketu | 340.2466926 | Jupiter / Saturn / Venus / Ketu |
| Ketu (mean) | 160.2668205 | Mercury / Moon / Moon / Rahu | 160.2466926 | Mercury / Moon / Moon / Rahu |
| Rahu (true) | 340.7874864 | Jupiter / Saturn / Sun / Mercury | 340.7673585 | Jupiter / Saturn / Sun / Mercury |
| Ketu (true) | 160.7874864 | Mercury / Moon / Moon / Mercury | 160.7673585 | Mercury / Moon / Moon / Mercury |
| Cusp 1 | 326.1843669 | Saturn / Jupiter / Ketu / Rahu | 326.1642390 | Saturn / Jupiter / Ketu / Rahu |
| Cusp 2 | 1.3285613 | Mars / Ketu / Venus / Moon | 1.3084334 | Mars / Ketu / Venus / Moon |
| Cusp 3 | 31.9285406 | Venus / Sun / Jupiter / Mercury | 31.9084127 | Venus / Sun / Jupiter / Mercury |
| Cusp 4 | 58.7680931 | Venus / Mars / Saturn / Venus | 58.7479652 | Venus / Mars / Saturn / Venus |
| Cusp 5 | 84.7362630 | Mercury / Jupiter / Mercury / Moon | 84.7161351 | Mercury / Jupiter / Mercury / Moon |
| Cusp 6 | 113.0344105 | Moon / Mercury / Moon / Ketu | 113.0142826 | Moon / Mercury / Moon / Mercury |
| Cusp 7 | 146.1843669 | Sun / Venus / Ketu / Mars | 146.1642390 | Sun / Venus / Ketu / Moon |
| Cusp 8 | 181.3285613 | Venus / Mars / Mercury / Rahu | 181.3084334 | Venus / Mars / Mercury / Rahu |
| Cusp 9 | 211.9285406 | Mars / Jupiter / Rahu / Saturn | 211.9084127 | Mars / Jupiter / Rahu / Saturn |
| Cusp 10 | 238.7680931 | Mars / Mercury / Saturn / Venus | 238.7479652 | Mars / Mercury / Saturn / Venus |
| Cusp 11 | 264.7362630 | Jupiter / Venus / Mercury / Sun | 264.7161351 | Jupiter / Venus / Mercury / Sun |
| Cusp 12 | 293.0344105 | Saturn / Moon / Sun / Saturn | 293.0142826 | Saturn / Moon / Sun / Saturn |

#### A.4 2026-11-21 09:00:00 +08:00, Petaling Jaya 3.1073 N, 101.6067 E

JD UT `2461365.541666667` · Δψ `8.1737″` · true obliquity `23.4378255°` · ARMC `176.6604417°`  
Ayanamsa KP Old: mean `24.13584602°`, true `24.13811650°` · KP New: mean `24.15596915°`, true `24.15823963°`

| Point | KP Old lon (°) | sign / star / sub / sub-sub | KP New lon (°) | sign / star / sub / sub-sub |
|---|---|---|---|---|
| Sun | 214.5836556 | Mars / Saturn / Saturn / Moon | 214.5635325 | Mars / Saturn / Saturn / Moon |
| Moon | 346.5658552 | Jupiter / Saturn / Jupiter / Rahu | 346.5457320 | Jupiter / Saturn / Jupiter / Rahu |
| Mars | 123.8271669 | Sun / Ketu / Moon / Rahu | 123.8070438 | Sun / Ketu / Moon / Mars |
| Mercury | 195.0995922 | Venus / Rahu / Ketu / Saturn | 195.0794691 | Venus / Rahu / Ketu / Saturn |
| Jupiter | 122.1122500 | Sun / Ketu / Venus / Jupiter | 122.0921268 | Sun / Ketu / Venus / Jupiter |
| Venus | 179.6770784 | Mercury / Mars / Saturn / Rahu | 179.6569553 | Mercury / Mars / Saturn / Rahu |
| Saturn | 344.1487878 | Jupiter / Saturn / Rahu / Ketu | 344.1286646 | Jupiter / Saturn / Rahu / Ketu |
| Rahu (mean) | 300.8741479 | Saturn / Mars / Mercury / Moon | 300.8540247 | Saturn / Mars / Mercury / Moon |
| Ketu (mean) | 120.8741479 | Sun / Ketu / Venus / Venus | 120.8540247 | Sun / Ketu / Venus / Venus |
| Rahu (true) | 300.8698384 | Saturn / Mars / Mercury / Moon | 300.8497152 | Saturn / Mars / Mercury / Moon |
| Ketu (true) | 120.8698384 | Sun / Ketu / Venus / Venus | 120.8497152 | Sun / Ketu / Venus / Venus |
| Cusp 1 | 241.5632163 | Jupiter / Ketu / Venus / Mars | 241.5430932 | Jupiter / Ketu / Venus / Mars |
| Cusp 2 | 269.8293738 | Jupiter / Sun / Rahu / Saturn | 269.8092507 | Jupiter / Sun / Rahu / Saturn |
| Cusp 3 | 299.9639939 | Saturn / Mars / Saturn / Jupiter | 299.9438708 | Saturn / Mars / Saturn / Jupiter |
| Cusp 4 | 332.2227810 | Jupiter / Jupiter / Rahu / Mercury | 332.2026579 | Jupiter / Jupiter / Rahu / Saturn |
| Cusp 5 | 4.3404748 | Mars / Ketu / Moon / Mercury | 4.3203517 | Mars / Ketu / Moon / Mercury |
| Cusp 6 | 34.0291221 | Venus / Sun / Saturn / Venus | 34.0089990 | Venus / Sun / Saturn / Venus |
| Cusp 7 | 61.5632163 | Mercury / Mars / Mercury / Jupiter | 61.5430932 | Mercury / Mars / Mercury / Jupiter |
| Cusp 8 | 89.8293738 | Mercury / Jupiter / Moon / Jupiter | 89.8092507 | Mercury / Jupiter / Moon / Jupiter |
| Cusp 9 | 119.9639939 | Moon / Mercury / Saturn / Jupiter | 119.9438708 | Moon / Mercury / Saturn / Jupiter |
| Cusp 10 | 152.2227810 | Mercury / Sun / Jupiter / Venus | 152.2026579 | Mercury / Sun / Jupiter / Venus |
| Cusp 11 | 184.3404748 | Venus / Mars / Venus / Saturn | 184.3203517 | Venus / Mars / Venus / Saturn |
| Cusp 12 | 214.0291221 | Mars / Saturn / Saturn / Ketu | 214.0089990 | Mars / Saturn / Saturn / Ketu |

#### A.5 2010-12-21 03:00:00 UTC, Tromsø 69.6492 N, 18.9553 E

JD UT `2455551.625000000` · Δψ `17.0466″` · true obliquity `23.4378170°` · ARMC `n/a (Placidus fails)°`  
Ayanamsa KP Old: mean `23.91347595°`, true `23.91821112°` · KP New: mean `23.93360017°`, true `23.93833535°`

| Point | KP Old lon (°) | sign / star / sub / sub-sub | KP New lon (°) | sign / star / sub / sub-sub |
|---|---|---|---|---|
| Sun | 245.2063128 | Jupiter / Ketu / Mars / Mercury | 245.1861886 | Jupiter / Ketu / Mars / Mercury |
| Moon | 62.4477699 | Mercury / Mars / Ketu / Saturn | 62.4276456 | Mercury / Mars / Ketu / Jupiter |
| Mars | 256.0793162 | Jupiter / Venus / Sun / Ketu | 256.0591920 | Jupiter / Venus / Sun / Mercury |
| Mercury | 242.6503949 | Jupiter / Ketu / Venus / Mercury | 242.6302706 | Jupiter / Ketu / Venus / Mercury |
| Jupiter | 331.3314708 | Jupiter / Jupiter / Mars / Moon | 331.3113466 | Jupiter / Jupiter / Mars / Moon |
| Venus | 199.8073222 | Venus / Rahu / Mars / Venus | 199.7871980 | Venus / Rahu / Mars / Venus |
| Saturn | 172.1654533 | Mercury / Moon / Venus / Saturn | 172.1453291 | Mercury / Moon / Venus / Saturn |
| Rahu (mean) | 248.9651793 | Jupiter / Ketu / Jupiter / Mars | 248.9450551 | Jupiter / Ketu / Jupiter / Moon |
| Ketu (mean) | 68.9651793 | Mercury / Rahu / Jupiter / Saturn | 68.9450551 | Mercury / Rahu / Jupiter / Saturn |
| Rahu (true) | 248.8178986 | Jupiter / Ketu / Jupiter / Moon | 248.7977744 | Jupiter / Ketu / Jupiter / Sun |
| Ketu (true) | 68.8178986 | Mercury / Rahu / Jupiter / Jupiter | 68.7977744 | Mercury / Rahu / Jupiter / Jupiter |
| Cusp 1 (Porphyry) | 187.2314060 | Venus / Rahu / Rahu / Jupiter | 187.2112820 | Venus / Rahu / Rahu / Jupiter |
| Cusp 2 (Porphyry) | 227.3552690 | Mars / Mercury / Mercury / Venus | 227.3351450 | Mars / Mercury / Mercury / Venus |
| Cusp 3 (Porphyry) | 267.4791330 | Jupiter / Sun / Moon / Mars | 267.4590090 | Jupiter / Sun / Moon / Mars |
| Cusp 4 (Porphyry) | 307.6029960 | Saturn / Rahu / Rahu / Mercury | 307.5828720 | Saturn / Rahu / Rahu / Mercury |
| Cusp 5 (Porphyry) | 327.4791330 | Saturn / Jupiter / Venus / Rahu | 327.4590090 | Saturn / Jupiter / Venus / Rahu |
| Cusp 6 (Porphyry) | 347.3552690 | Jupiter / Mercury / Mercury / Venus | 347.3351450 | Jupiter / Mercury / Mercury / Venus |
| Cusp 7 (Porphyry) | 7.2314060 | Mars / Ketu / Rahu / Sun | 7.2112820 | Mars / Ketu / Rahu / Sun |
| Cusp 8 (Porphyry) | 47.3552690 | Venus / Moon / Saturn / Rahu | 47.3351450 | Venus / Moon / Saturn / Rahu |
| Cusp 9 (Porphyry) | 87.4791330 | Mercury / Jupiter / Venus / Rahu | 87.4590090 | Mercury / Jupiter / Venus / Rahu |
| Cusp 10 (Porphyry) | 127.6029960 | Sun / Ketu / Jupiter / Jupiter | 127.5828720 | Sun / Ketu / Jupiter / Jupiter |
| Cusp 11 (Porphyry) | 147.4791330 | Sun / Sun / Moon / Mars | 147.4590090 | Sun / Sun / Moon / Mars |
| Cusp 12 (Porphyry) | 167.3552690 | Mercury / Moon / Saturn / Rahu | 167.3351450 | Mercury / Moon / Saturn / Rahu |

#### A.6 Placidus, tropical, from ARMC (`swe.houses_armc`, ε = 23.4392911°)

| Lat | ARMC | Cusp 1 | Cusp 2 | Cusp 3 | Cusp 10 | Cusp 11 | Cusp 12 |
|---|---|---|---|---|---|---|---|
| -45 | 0 | 68.3084674 | 102.2994706 | 142.8840281 | 0.0000000 | 28.3182515 | 50.0048535 |
| -45 | 97.5 | 194.3058654 | 232.9354674 | 256.9150125 | 96.8873229 | 118.0648988 | 146.6374783 |
| -45 | 187.5 | 297.5644853 | 316.1481854 | 338.6827317 | 188.1658174 | 225.7277992 | 264.9933645 |
| -45 | 292.5 | 17.0807576 | 43.8518146 | 75.5184276 | 290.8084689 | 324.7569829 | 353.6605010 |
| 13.0827 | 0 | 95.2813581 | 121.0022923 | 148.7934982 | 0.0000000 | 33.2117756 | 65.3687714 |
| 13.0827 | 97.5 | 187.4213532 | 217.6336621 | 247.5384713 | 96.8873229 | 126.6080323 | 157.1754352 |
| 13.0827 | 187.5 | 271.5782203 | 302.0581272 | 334.8967936 | 188.1658174 | 218.7420453 | 245.9254860 |
| 13.0827 | 292.5 | 26.8726391 | 57.9418728 | 84.8763667 | 290.8084689 | 318.8682538 | 351.2496285 |
| 51.4779 | 0 | 116.5503215 | 132.6138780 | 152.5492778 | 0.0000000 | 38.6456608 | 82.4156256 |
| 51.4779 | 97.5 | 185.2914671 | 209.7980281 | 240.4606563 | 96.8873229 | 132.5796178 | 162.0532274 |
| 51.4779 | 187.5 | 249.0330880 | 285.2186046 | 330.6123644 | 188.1658174 | 214.1760072 | 233.2379916 |
| 51.4779 | 292.5 | 47.7205587 | 74.7813954 | 93.1904654 | 290.8084689 | 312.4778882 | 347.2348034 |
| 60 | 0 | 124.5656857 | 137.0211068 | 154.0526789 | 0.0000000 | 41.9529351 | 92.2106985 |
| 60 | 97.5 | 184.6678545 | 207.0591278 | 237.1562495 | 96.8873229 | 135.1698540 | 163.6990366 |
| 60 | 187.5 | 240.1387231 | 274.8031711 | 328.0211833 | 188.1658174 | 212.3068886 | 228.2501182 |
| 60 | 292.5 | 67.4795575 | 85.1968289 | 97.7962457 | 290.8084689 | 308.5648161 | 343.7803099 |
| 66.5 | 0 | 132.4530500 | 141.5753356 | 155.6841208 | 0.0000000 | 47.3818585 | 106.4097675 |
| 66.5 | 97.5 | 184.0921089 | 204.3268367 | 233.0712980 | 96.8873229 | 138.1531719 | 165.3189111 |
| 66.5 | 187.5 | 231.2728275 | 257.8327824 | 323.9920702 | 188.1658174 | 210.2476401 | 223.0076513 |
| 66.5 | 292.5 | 99.9570879 | 102.1672176 | 105.4264285 | 290.8084689 | 301.6289038 | 335.8471844 |

#### A.7 Day lord and dasha references

| Case | Most recent sunrise (SE, JD UT) | Day lord | Dasha (KP Old Moon) | Balance (y) | Running bhukti | Bhukti years left |
|---|---|---|---|---|---|---|
| kl1992 | 2448691.472913 (1992-03-09 23:20:59 UTC) | Mars | Moon | 8.477870 | Rahu | 1.394536 |
| gw2000 | 2451544.836958 (2000-01-01 08:05:13 UTC) | Saturn | Rahu | 0.584035 | Mars | 0.584035 |
| chn1950 | 2433447.508448 (1950-06-15 00:12:09 UTC) | Jupiter | Mars | 2.333627 | Ketu | 0.233627 |
| pj2026 | 2461365.458366 (2026-11-20 23:00:02 UTC) | Saturn | Saturn | 0.143656 | Jupiter | 0.143656 |
| tromso2010 | none (polar night) | undefined (no sunrise) | Mars | 2.214921 | Ketu | 0.114921 |
