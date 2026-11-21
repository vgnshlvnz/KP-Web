# Licensing Decision: NASA JPL Ephemeris Adoption

**Date:** 21 November 2026  
**Status:** Approved and Recorded  
**Related Issues:** Closes #2 (Ephemeris engine and licensing decision), Resolves #25 (Decision: Swiss Ephemeris licence path)

## Background and Decision

KP-Web requires planetary positions and Placidus house cusps precise to arc-seconds, supporting Krishnamurti Paddhati (KP) sidereal calculations with both **KP Old** (original Krishnamurti) and **KP New** (Krishnamurti-Senthilathiban / VP291) ayanamsas.

Historically, astrological applications have relied on Swiss Ephemeris (`sweph`), which carries an **AGPL-3.0** copyleft license or requires a commercial **Professional License** (CHF 700 for 6 years). The AGPL imposes copyleft obligations on hosted network/cloud applications, and native C bindings (`pyswisseph`, `sweph`) cannot run natively inside Cloudflare Workers' V8 sandboxed isolates.

### Decision

KP-Web formally adopts **NASA JPL Ephemeris** data and models:

1. **Licensing Basis (NASA Public Domain & Open Source):**
   - NASA and Jet Propulsion Laboratory (JPL) planetary ephemerides (including DE405 / DE421 / DE440, Keplerian orbital element theories by E.M. Standish, and lunar theories) are works of the United States Government created by employees of NASA/Caltech and are in the public domain under 17 U.S.C. § 105, or released under permissive NASA Open Source / Apache 2.0 / MIT terms.
   - Using NASA JPL Ephemeris avoids the AGPL copyleft requirements and the Astrodienst commercial license fee (CHF 700 / 6 years), permitting deployment in both open-source and hosted cloud services.

2. **Cloudflare Wrangler & Workers Compatibility:**
   - The ephemeris engine is built in pure TypeScript/JavaScript with zero native C/C++ dependencies (`node-gyp`).
   - Runs cleanly inside Cloudflare Workers, Cloudflare Pages, and standard Node.js/browser environments using Wrangler.
   - Computes geocentric ecliptic longitudes, latitudes, distances, and speeds for Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu (Mean and True Node), Ketu, Uranus, Neptune, and Pluto to sub-arcsecond to arcsecond precision.

3. **KP Ayanamsa Fidelity:**
   - **KP Old (Original Krishnamurti):** Based on epoch J1900.0 with $t_0 = \text{JD } 2415020.0$, initial ayanamsa value $\text{ayan}_{t0} = 22^\circ 21' 50.0''$ ($22.363889^\circ$), and Newcomb precession.
   - **KP New (Krishnamurti-Senthilathiban / VP291):** Based on zero-ayanamsa epoch $t_0 = \text{JD } 1827424.752255678$ (year 291 CE vernal point) and standard IAU precession.
   - Both ayanamsas are fully selectable in the API and UI; Lahiri is never used as a silent fallback.

4. **Attribution & Compliance:**
   - Proper attribution to NASA, Caltech, and Jet Propulsion Laboratory is maintained in the codebase, adhering to NASA data use and attribution guidelines.
   - Third-party licence texts (astronomy-engine, MIT) are in [`THIRD_PARTY_LICENSES.md`](../THIRD_PARTY_LICENSES.md).
