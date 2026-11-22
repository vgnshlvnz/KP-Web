/**
 * Fixed KP conventions of the engine, all in one place.
 *
 * Each one is an owner decision recorded on the tracking issue (#29, owner, 2026-11-21) and is a
 * constant, not an option. The options stay required in `ChartCalculationOptions`: `ayanamsa`
 * (#22 decided: no API default; KP New is the UI's default selection), plus the still-open
 * `nodeAgentRuleSet` (TODO(#23)) and `rulingPlanetSet` (TODO(#24)).
 */

/**
 * Lunar node: MEAN node only. The true node is not supported and there is no option for it.
 * (#29 (owner, 2026-11-21): "Use mean node only. No need to use true node.")
 */
export const LUNAR_NODE = 'mean' as const;

/**
 * Bodies: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu. No Uranus, Neptune or
 * Pluto. (#29 (owner, 2026-11-21): outer planets "Omit".)
 */
export const INCLUDES_OUTER_PLANETS = false as const;

/**
 * Polar latitudes (|lat| >= 90 - obliquity, where Placidus is undefined): the chart always uses
 * Porphyry cusps, sets `isPolarFallback` and carries a `polar_fallback` warning. There is no
 * 'refuse' mode. Horary is the exception: it throws `PolarLatitudeError`, because the Ascendant
 * to ARMC inversion is not unique there (#58).
 * (#29 (owner, 2026-11-21): "Porphyry fallback with a visible warning".)
 */
export const POLAR_HANDLING = 'porphyry_fallback' as const;

/**
 * Sunrise for the day lord: the Sun's upper limb at the horizon with standard atmospheric
 * refraction (the astronomy-engine and Swiss Ephemeris default). The day lord changes at sunrise,
 * not at midnight.
 * (#29 (owner, 2026-11-21): "upper limb + standard refraction".)
 */
export const SUNRISE_DEFINITION = 'upper_limb_refraction' as const;

/**
 * Dasha year length in days; a dasha month is `DASHA_YEAR_DAYS / 12`.
 * (#29 (owner, 2026-11-21): dasha year "This is okay" = 365.2425.)
 */
export const DASHA_YEAR_DAYS = 365.2425;

/**
 * A body or cusp within this many arcseconds of a sub or sub-sub edge is flagged as near a
 * boundary, and `calculateChart` adds a `near_sub_boundary` warning. Both the sub and the sub-sub
 * flags are always computed; the warning fires on either.
 * (#29 (owner, 2026-11-21): accuracy "Use B", threshold 60 arcsec.)
 * TODO(#29 Q16): which of the two flags the UI shows is still open.
 */
export const NEAR_BOUNDARY_THRESHOLD_ARCSEC = 60;

/**
 * Nutation model: IAU 2000B, the full 77-term luni-solar series with no planetary offset, which is
 * the Swiss Ephemeris default (`SEMOD_NUT_IAU_2000B`). `src/engine/nutation.ts` evaluates it and
 * `calculateNutation` (`astronomy.ts`) is the only function the engine takes nutation from: the true
 * ayanamsa (mean + dPsi), the true obliquity, the equation of the equinoxes and GAST, the mean node
 * and the tropical planet longitudes. astronomy-engine's own `e_tilt` is a 5-term truncation of
 * this series (up to 0.26 arcsec off in dPsi), so it is not used for any nutation value (#57).
 * KPSTLA adds no nutation (owner, #29, G3) and Nil is tropical, whatever the model.
 */
export const NUTATION_MODEL = 'iau2000b_77_terms' as const;

/**
 * Horoscope matching, rule 4 (GENERAL HAPPINESS): the orb in degrees within which two Ascendant
 * sign lords count as in aspect (conjunction, sextile, square, trine, opposition).
 *
 * Source: KP-Qt `horomatch.cpp` `kKuppuOrbDeg = 7.0`, KP-Qt's reading of Kuppu Ganapathi, "KP
 * Dasavidha Porutham" (K.P. & Astrology Year Book 1997). FOR THE OWNER TO CONFIRM: this is an
 * unconfirmed convention, not an owner decision. The engine does not read it: `calculateMatch`
 * takes the orb as the required input `MatchInput.aspectOrbDeg`, and `POST /api/match` passes this
 * constant (it is not a request field).
 */
export const MATCH_RULE4_ORB_DEG = 7;
