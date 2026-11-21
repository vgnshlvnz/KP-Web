/**
 * Fixed KP conventions of the engine, all in one place.
 *
 * Each one is an owner decision recorded on the tracking issue (#29, owner, 2026-11-21) and is a
 * constant, not an option. The options stay required in `ChartCalculationOptions`: `ayanamsa`
 * (#22 decided: no API default; KPSTLA is the UI preselect only), plus the still-open
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
