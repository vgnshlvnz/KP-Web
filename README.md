# KP-Web

A KP (Krishnamurti Paddhati) astrology web app. This repository starts from research dated **21 November 2026** and tracks the calculation core, product features, and open decisions as GitHub issues.

The product goal is a hosted app that can compute a natal KP chart and a horary (prashna) chart to a standard a practising KP astrologer would trust, then present the tables those astrologers actually read. Ordinary app work (accounts, PDFs, polish) comes after the engine is correct.

## Project goal

Ship a web application that:

- Accepts birth or question data with time to the second and a resolved place and timezone.
- Computes sidereal planetary positions and Placidus house cusps using a KP ayanamsa (KP Old and KP New).
- Derives sign, star, sub, and sub-sub lords for every planet and cusp.
- Shows South and North Indian charts plus KP cusp, planet, significator, ruling-planet, and dasha tables.
- Supports KP horary numbers 1–249, with the lagna fixed at the **start** of the chosen sub.
- Warns when a cuspal sub-lord sits close to a boundary, and treats birth data as personal data under Malaysia's PDPA (and GDPR where applicable).

Feature work is filed as open issues. Labels: `mvp`, `later`, `calc-engine`, `ui`, `horary`, `privacy`, `decision`, `feature`.

## KP calculation fundamentals

These are the rules the engine has to get right. People will judge the app on this layer.

### Sidereal zodiac and ayanamsa

Use a sidereal zodiac with a **KP ayanamsa**, not Lahiri as a silent fallback. Offer both **KP Old** and **KP New**, the two KP modes in [Swiss Ephemeris](https://www.astro.com/swisseph/swisseph.pdf). KP sits about 4 to 6 arcminutes from Lahiri. The often-quoted fixed gap of 5′48″ is only an approximation. Which mode is the default is an open decision.

### Placidus house cusps

A planet's house comes from the cusps, not its sign. A planet just before a cusp belongs to the previous house.

### Sub-lords and the 1–249 table

Each of the 27 nakshatras splits into 9 unequal subs sized by the Vimshottari dasha years. That gives 243 subs; six of them cross a sign boundary and are split, which produces the standard [1–249 table](https://kpastrologypro.com/kp-horary-numbers-1-249). Every planet and every cusp needs its sign lord, star lord, sub lord, and sub-sub lord.

### Significators (four levels)

From strongest to weakest:

1. Planets in the star of a house's occupants.
2. The occupants themselves.
3. Planets in the star of the cusp's sign lord.
4. That sign lord.

Rahu and Ketu act as agents for the planets they are tied to. Schools disagree on the exact rules, so the app must document the rule set it ships. See [this explainer](https://astroreads.in/blog/kp-significators-four-levels/). The default Rahu/Ketu rule set is an open decision.

### Ruling planets

The set is the ascendant's star lord and sign lord, the Moon's star lord and sign lord, plus the day lord. The day lord changes at **sunrise**, not midnight. Offer ruling planets for the birth moment and a live "now" view. The exact inclusion rules (for example nodes) are an open decision.

### Vimshottari dasha

Compute dasha, bhukti, and antara from the Moon. Transits are a later confirming layer, not MVP.

### Horary (KP prashna)

The querent picks a number from 1 to 249. The ascendant is fixed at the **start** of that sub (for example, 108 gives 3°00′ Virgo). Work backwards to the sidereal time that puts that degree on the ascendant, build the other Placidus cusps from it, and take the planets from the actual time and place of the question.

One catch: the open-source [kpastro](https://pypi.org/project/kpastro/) library uses the **midpoint** of the sub instead. Do not copy that default without a toggle. Sub-sub horary (1–2193) is a later feature.

## Stack notes

### Ephemeris engine and NASA JPL licensing

To resolve the Swiss Ephemeris AGPL / CHF 700 commercial fee constraint and enable native execution in serverless V8 isolates (Cloudflare Workers) without C++ native addon dependencies (`sweph`/`node-gyp`), the engine uses **NASA JPL Ephemeris** models (DE405 / VSOP87 / NOVAS via `astronomy-engine`) combined with high-precision IAU 2006 precession.

NASA JPL Ephemeris models are works of the United States Government (17 U.S.C. § 105), placed in the public domain and permissively licensed. See [docs/licensing.md](docs/licensing.md) for full architectural rationale and licensing compliance.

Both KP ayanamsa standards are implemented and selectable:
1. **KP Old** (`SE_SIDM_KRISHNAMURTI`): K.S. Krishnamurti's original baseline defined at J1900.0 with $22^\circ 21' 50.0''$ ($22.363889^\circ$). J2000 value: $23.76024004^\circ$ ($23^\circ 45' 36.86''$).
2. **KP New** (`SE_SIDM_KRISHNAMURTI_VP291`): The Krishnamurti-Senthilathiban revision with zero-ayanamsa epoch at vernal point 291 CE. J2000 value: $23.78036498^\circ$ ($23^\circ 46' 49.31''$).
Both match Swiss Ephemeris to within $0.05$ arcseconds across modern epochs.

Also selectable, from KP-Qt's vendor formulas (`kpAyanamsa.cpp`; not Swiss Ephemeris):
3. **KP Straight Line** (`kp_straight_line`): `(year − 291) × 50.2388475″ / 3600`, using the local civil year. One value for the whole year.
4. **KP Ayanamsa** (`kp_ayanamsa`): `t = frac − 1900`, `(t × 50.2388475″ + 1350″) / 3600 + 22° + t² × 0.000111″ / 3600`, where `frac` is KP-Qt's fractional year measured from 15 April of the local civil date.

**KP Straight Line (Adjusted)** (`kp_straight_line_adjusted`) stays the owner definition: years from 291-01-01 0h UT (Julian) in units of 365.25 days, times 50.2388475″, with no nutation. That is not KP-Qt's 15 April form of the same name. The page preselects KP New. Lahiri, Raman, Fagan-Bradley, Yukteshwar, J.N. Bhasin and Usha-Shashi use KP-Qt's IAU 1976 precession and zero-point table. Nil (tropical) is accepted by the API.

## Cloudflare Wrangler deployment

The engine is built in pure TypeScript and deployed as a Cloudflare Worker using Wrangler (`wrangler.jsonc`):

```bash
# Install dependencies
npm install

# Run type check and unit tests
npm run build
npm test

# Run local Cloudflare Worker development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

### API Endpoints

- `GET /api/health` — Engine status, versions, and NASA JPL licensing confirmation.
- `GET /api/ayanamsa?year=2026&month=11&day=21` — KP Old and KP New ayanamsa values for a given date.
- `GET /api/horary-table` or `GET /api/horary-table?number=108` — Complete canonical 1–249 Horary table or specific entry lookup.
- `POST /api/calculate` — Computes full natal or event chart (planetary positions, Placidus cusps, sign/star/sub/sub-sub lords, 4-level significators, ruling planets, Vimshottari dasha).
- `POST /api/horary` — Computes Horary chart for numbers 1–249 with Lagna at start of sub (or midpoint toggle) via RAMC inversion.

### Time and place

Use historical IANA timezone data, a geocoder, and a lookup from coordinates to timezone. Show the user the UTC offset applied, and store their raw input so charts can be recomputed later. IANA warns that its data before 1970 is incomplete ([tzdb theory, 2026b](https://data.iana.org/time-zones/tzdb-2026b/theory.html)).

### Precision

Work to arc-seconds and collect birth time to the second. A cuspal sub-lord can change within about 3 to 9 minutes of birth time, and a sub-sub lord within seconds. Warn users when a cusp sits close to a sub boundary.

### Privacy

Birth data is personal data under Malaysia's [PDPA](https://www.pdp.gov.my/en/faq/). Horary questions often touch health or religion, which can count as sensitive data. Consent, retention, and export/delete need to be in the MVP.

## Open / unresolved decisions

These are filed as `decision` issues and should be settled in writing before the related features ship:

1. **Default KP ayanamsa** — KP Old vs KP New (both must remain selectable).
2. **Rahu/Ketu significator rule set** — which agent rules to implement, and how to document them.
3. **Ruling-planet rule set** — exact members of the set, including any node or additional-planet rules.
4. **Swiss Ephemeris licence path** — AGPL (source must be offered for the hosted app) vs the Professional licence (CHF 700 / 6 years, Nov 2026 contract).

## Feature scope

### MVP

- Birth data input: time to the second, place search, timezone offset shown, ayanamsa toggle (KP Old / KP New).
- Ephemeris engine and a recorded licensing decision.
- Placidus house cusps.
- Sub and sub-sub lord computation, including the 1–249 table.
- KP cusp table (sign, star, sub, sub-sub lords).
- Planet table (cuspal house plus lords).
- South and North Indian chart wheels.
- Four-level significators, house-wise and planet-wise, with documented Rahu/Ketu rules.
- Ruling planets for the birth moment and a live "now" view; day lord at sunrise.
- Vimshottari dasha down to antara.
- Horary 1–249: lagna at the start of the sub, RAMC inversion, toggle vs midpoint.
- Timezone and geocoding layer.
- Sub-boundary warnings.
- Privacy and consent (PDPA / GDPR).
- Validation against Jagannatha Hora and KP Star One, especially charts near sub boundaries and split horary numbers such as 23 or 106.

### Later

- PDF reports.
- Accounts and saved charts.
- Transits.
- Birth-time rectification slider.
- Sub-sub horary numbers 1–2193.
- Extra school or rule-set options.

## Reference links

Research pass dated 21 November 2026. Full sourced write-up: [docs/research.md](docs/research.md).

- [Swiss Ephemeris documentation (PDF)](https://www.astro.com/swisseph/swisseph.pdf)
- [Swiss Ephemeris Professional licence pricing](https://www.astro.com/swisseph/swephprice_p.htm)
- [KP horary numbers 1–249](https://kpastrologypro.com/kp-horary-numbers-1-249)
- [Four-level significators explainer](https://astroreads.in/blog/kp-significators-four-levels/)
- [kpastro on PyPI](https://pypi.org/project/kpastro/) (note: default lagna at sub midpoint)
- [IANA tzdb theory (2026b)](https://data.iana.org/time-zones/tzdb-2026b/theory.html)
- [Malaysia PDPA FAQ](https://www.pdp.gov.my/en/faq/)
- Feature benchmarks: [KP Star One](https://www.kpstarone.com/kpstarone-features-new.php), [Jagannatha Hora](http://www.vedicastrologer.org/jh/features.htm)
- Open-source references: [VedicAstro](https://github.com/diliprk/VedicAstro), [kp-astrology](https://github.com/Rituparno-Majumdar/kp-astrology)
