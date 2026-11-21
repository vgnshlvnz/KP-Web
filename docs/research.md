# KP astrology web app — research findings

**Date:** 21 November 2026  
**Topic:** What a KP (Krishnamurti Paddhati) astrology web app needs, from the calculation core to the features users expect.

This note is the sourced write-up of a live web research pass on 21 November 2026. It is the basis for the open feature issues in this repository.

A real KP app comes down to three things: a precise calculation engine, the KP-specific tables people actually read, and a horary module. Everything else is ordinary app work.

## The calculation core (the part people judge you on)

### Sidereal zodiac with a KP ayanamsa

Offer both **KP Old** and **KP New**, the two KP modes in [Swiss Ephemeris](https://www.astro.com/swisseph/swisseph.pdf), and never quietly fall back to Lahiri. KP sits about 4 to 6 arcminutes from Lahiri. The often-quoted fixed gap of 5′48″ is only an approximation.

### Placidus house cusps

A planet's house comes from the cusps, not its sign, so a planet just before a cusp belongs to the previous house.

### Sub-lords

Each of the 27 nakshatras splits into 9 unequal subs sized by the Vimshottari dasha years. That gives 243 subs, and six of them cross a sign boundary and get split, which makes the standard [1–249 table](https://kpastrologypro.com/kp-horary-numbers-1-249). Every planet and every cusp needs its sign lord, star lord, sub lord, and sub-sub lord.

### Significators at four levels

From strongest to weakest:

1. Planets in the star of a house's occupants.
2. The occupants themselves.
3. Planets in the star of the cusp's sign lord.
4. That sign lord.

Rahu and Ketu act as agents for the planets they are tied to, and schools disagree on the exact rules, so document the rule set you pick ([explainer](https://astroreads.in/blog/kp-significators-four-levels/)).

### Ruling planets

The ascendant's star lord and sign lord, the Moon's star lord and sign lord, plus the day lord, which changes at **sunrise**, not midnight.

### Vimshottari dasha

Dasha, bhukti, and antara from the Moon, with transits as a confirming layer (later than MVP).

## Horary (KP prashna)

The person picks a number from 1 to 249, and the ascendant is fixed at the **start** of that sub. For example, 108 gives 3°00′ Virgo. You then work backwards to find the sidereal time that puts that degree on the ascendant (RAMC inversion), build the other Placidus cusps from it, and take the planets from the actual time and place of the question.

One catch: the open-source [kpastro](https://pypi.org/project/kpastro/) library uses the **midpoint** of the sub instead, so do not copy its default without a toggle.

## Stack and the traps

### Licensing

Swiss Ephemeris is the standard engine, but it is AGPL, which covers hosted web apps too. For a closed-source app you need the [Professional licence](https://www.astro.com/swisseph/swephprice_p.htm), currently **CHF 700 for 6 years** under the November 2026 contract. Wrapper libraries labelled MIT still pull in Swiss Ephemeris, so this applies to them as well.

Bindings: for Python, `pyswisseph` or `pysweph`; for Node, `sweph`.

### Time and place

Use historical IANA timezone data, plus a geocoder and a lookup from coordinates to timezone. Show users the UTC offset you applied, and store their raw input so charts can be recomputed later. IANA warns its data before 1970 is incomplete ([source](https://data.iana.org/time-zones/tzdb-2026b/theory.html)).

### Precision

Work to arc-seconds and collect birth time to the second. A cuspal sub-lord can change within about 3 to 9 minutes of birth time, and a sub-sub lord within seconds, so warn users when a cusp sits close to a sub boundary.

## What to put in the MVP

- Birth input with time to the second, a place search, the timezone offset shown, and a toggle between KP Old and KP New.
- South and North Indian charts, plus a KP cusp table with sign, star, sub, and sub-sub lords.
- A planet table showing each planet's cuspal house and its lords.
- Significator tables by house and by planet.
- Ruling planets for the birth moment and a live "now" view.
- A dasha timeline down to antara.
- The horary module for numbers 1 to 249.
- Privacy basics. Birth data is personal data under Malaysia's [PDPA](https://www.pdp.gov.my/en/faq/), and horary questions often touch health or religion, which count as sensitive data.

## Later additions

Good later additions are PDF reports, saved charts, transits, a birth-time rectification slider, and sub-sub horary from 1 to 2193, plus extra school or rule-set options.

## Benchmarks and open-source references

For a feature benchmark, look at [KP Star One](https://www.kpstarone.com/kpstarone-features-new.php) and [Jagannatha Hora](http://www.vedicastrologer.org/jh/features.htm), the free one. Useful open-source references are [VedicAstro](https://github.com/diliprk/VedicAstro), a Python library with a FastAPI example, and [kp-astrology](https://github.com/Rituparno-Majumdar/kp-astrology).

Before you ship, check your engine against JHora on a few charts, especially ones near sub boundaries and a split horary number like 23 or 106.

## Source list

| Source | URL |
| --- | --- |
| Swiss Ephemeris documentation | https://www.astro.com/swisseph/swisseph.pdf |
| Swiss Ephemeris Professional licence | https://www.astro.com/swisseph/swephprice_p.htm |
| KP horary numbers 1–249 | https://kpastrologypro.com/kp-horary-numbers-1-249 |
| Four-level significators explainer | https://astroreads.in/blog/kp-significators-four-levels/ |
| kpastro (PyPI) | https://pypi.org/project/kpastro/ |
| IANA tzdb theory (2026b) | https://data.iana.org/time-zones/tzdb-2026b/theory.html |
| Malaysia PDPA FAQ | https://www.pdp.gov.my/en/faq/ |
| KP Star One features | https://www.kpstarone.com/kpstarone-features-new.php |
| Jagannatha Hora features | http://www.vedicastrologer.org/jh/features.htm |
| VedicAstro | https://github.com/diliprk/VedicAstro |
| kp-astrology | https://github.com/Rituparno-Majumdar/kp-astrology |
