import {
  KPCusp,
  PlanetHouseAssignment,
  HouseSignificator,
  PlanetSignificator,
  SignificatorsResult,
  FourLevelSignificators,
  NodeAgentRuleSet,
  PlanetName,
} from './types.js';

/**
 * Computes KP four-level significators (house-wise and planet-wise).
 *
 * Strength hierarchy (Level 1 is strongest, Level 4 is weakest):
 * 1. Planets in the star of a house's occupants.
 * 2. The occupants themselves (determined strictly by cusps!).
 * 3. Planets in the star of the cusp's sign lord.
 * 4. That cusp's sign lord.
 */
export function calculateSignificators(
  cusps: KPCusp[],
  planets: PlanetHouseAssignment[]
): SignificatorsResult {
  const houseWise: HouseSignificator[] = [];

  for (let h = 1; h <= 12; h++) {
    const cusp = cusps[h - 1];

    // Level 2: Occupants of the house (strictly from cuspal assignment)
    const occupants = planets
      .filter((p) => p.house === h)
      .map((p) => p.name);

    // Level 1: Planets in the star of a house's occupants
    const level1Planets = planets
      .filter((p) => occupants.includes(p.starLord))
      .map((p) => p.name);

    // Level 4: Cusp sign lord
    const cuspSignLord = cusp.signLord;
    const level4 = [cuspSignLord];

    // Level 3: Planets in the star of the cusp's sign lord
    const level3Planets = planets
      .filter((p) => p.starLord === cuspSignLord)
      .map((p) => p.name);

    const allSet = new Set<string>([
      ...level1Planets,
      ...occupants,
      ...level3Planets,
      ...level4,
    ]);

    houseWise.push({
      house: h,
      level1: Array.from(new Set(level1Planets)),
      level2: occupants,
      level3: Array.from(new Set(level3Planets)),
      level4,
      allSignificators: Array.from(allSet),
    });
  }

  // Planet-wise significators
  const planetNames = Array.from(new Set(planets.map((p) => p.name)));
  const planetWise: PlanetSignificator[] = planetNames.map((pName) => {
    const l1: number[] = [];
    const l2: number[] = [];
    const l3: number[] = [];
    const l4: number[] = [];

    for (const hw of houseWise) {
      if (hw.level1.includes(pName)) l1.push(hw.house);
      if (hw.level2.includes(pName)) l2.push(hw.house);
      if (hw.level3.includes(pName)) l3.push(hw.house);
      if (hw.level4.includes(pName)) l4.push(hw.house);
    }

    const all = Array.from(new Set([...l1, ...l2, ...l3, ...l4])).sort(
      (a, b) => a - b
    );

    return {
      planet: pName,
      signifiesHouses: {
        level1: l1,
        level2: l2,
        level3: l3,
        level4: l4,
        all,
      },
    };
  });

  return {
    houseWise,
    planetWise,
  };
}

// ---------------------------------------------------------------------------
// Rahu / Ketu agents
// ---------------------------------------------------------------------------

/**
 * TODO(#23): which Rahu/Ketu agent rules the app uses is the repo owner's decision. Nothing in
 * this module picks one: every function below takes the rule set as a REQUIRED argument, and
 * `calculateSignificators` above (the four house levels) does not depend on it.
 */

/** Plain-language description of each named rule set, as shown to users (TODO(#23): UI naming). */
export const NODE_AGENT_RULE_SET_DESCRIPTIONS: Record<NodeAgentRuleSet, string> = {
  none: 'No Rahu/Ketu agent rules: no planets are listed as agents for Rahu or Ketu.',
  sign_lord_star_lord_same_sign:
    'A node is listed as an agent for: (1) the lord of the sign it occupies, (2) the lord of the star ' +
    '(nakshatra) it occupies, and (3) every other planet in the same sign (conjunction is taken as ' +
    'same sign, with no orb). Aspects are NOT implemented. The list can contain the node itself ' +
    '(when it sits in its own star) or the other node (when that node is its sign or star lord), and ' +
    'is not used in the four house levels.',
};

/** Order in which same-sign planets are listed. Matches Stack B's `primaryBodies`. */
const AGENT_BODY_ORDER: PlanetName[] = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
];

export interface NodeAgents {
  Rahu: PlanetName[];
  Ketu: PlanetName[];
}

function assertNodeAgentRuleSet(ruleSet: NodeAgentRuleSet): void {
  if (!Object.prototype.hasOwnProperty.call(NODE_AGENT_RULE_SET_DESCRIPTIONS, ruleSet)) {
    // No silent fallback: an unknown or missing rule set is a caller error. TODO(#23)
    throw new Error(
      `Unknown or missing Rahu/Ketu agent rule set: ${String(ruleSet)}. ` +
        `Expected one of: ${Object.keys(NODE_AGENT_RULE_SET_DESCRIPTIONS).join(', ')}.`
    );
  }
}

/**
 * Rahu/Ketu agents under an explicit rule set. TODO(#23): no default; the caller must choose.
 *
 * - `'none'`: both lists are empty (Stack A behaviour).
 * - `'sign_lord_star_lord_same_sign'`: Stack B's `agentsFor`, ported as it behaves today, not as
 *   an endorsed KP rule. Per node, in this order and de-duplicated: sign lord, star lord, then the
 *   other planets in the same sign (in Sun..Ketu order). It does NOT implement aspects, although
 *   Stack B's doc string claimed it did. A node absent from `planets` gets an empty list.
 */
export function calculateNodeAgents(
  planets: PlanetHouseAssignment[],
  nodeAgentRuleSet: NodeAgentRuleSet
): NodeAgents {
  assertNodeAgentRuleSet(nodeAgentRuleSet);

  const agents: NodeAgents = { Rahu: [], Ketu: [] };
  if (nodeAgentRuleSet === 'none') return agents;

  // 'sign_lord_star_lord_same_sign'
  const byName = new Map<string, PlanetHouseAssignment>();
  for (const p of planets) byName.set(p.name, p);

  for (const node of ['Rahu', 'Ketu'] as const) {
    const nodePos = byName.get(node);
    if (!nodePos) continue;

    const represented = new Set<PlanetName>();
    represented.add(nodePos.signLord as PlanetName);
    represented.add(nodePos.starLord as PlanetName);
    for (const other of AGENT_BODY_ORDER) {
      if (other === node) continue;
      const otherPos = byName.get(other);
      if (otherPos && otherPos.signIndex === nodePos.signIndex) {
        represented.add(other);
      }
    }
    agents[node] = Array.from(represented);
  }

  return agents;
}

const KNOWN_PLANET_NAMES = new Set<string>([
  ...AGENT_BODY_ORDER,
]);

function asPlanetNames(names: string[]): PlanetName[] {
  return names.filter((n): n is PlanetName => KNOWN_PLANET_NAMES.has(n));
}

/**
 * Stack B's `FourLevelSignificators` layout, built from the same four house levels as
 * `calculateSignificators` plus node agents under an explicit rule set. TODO(#23): no default.
 *
 * The house levels are exactly those of `calculateSignificators` (same members, same order);
 * only `agentsFor` and `rahuKetuRules` depend on `nodeAgentRuleSet`. `planetWise` has an entry for
 * the nine classical bodies only, as in Stack B.
 */
export function calculateFourLevelSignificators(
  cusps: KPCusp[],
  planets: PlanetHouseAssignment[],
  nodeAgentRuleSet: NodeAgentRuleSet
): FourLevelSignificators {
  assertNodeAgentRuleSet(nodeAgentRuleSet);

  const base = calculateSignificators(cusps, planets);
  const agents = calculateNodeAgents(planets, nodeAgentRuleSet);

  const houseWise: FourLevelSignificators['houseWise'] = {};
  for (const hw of base.houseWise) {
    houseWise[hw.house] = {
      level1: asPlanetNames(hw.level1),
      level2: asPlanetNames(hw.level2),
      level3: asPlanetNames(hw.level3),
      level4: asPlanetNames(hw.level4),
    };
  }

  const planetWise = {} as FourLevelSignificators['planetWise'];
  for (const body of AGENT_BODY_ORDER) {
    const level1Houses: number[] = [];
    const level2Houses: number[] = [];
    const level3Houses: number[] = [];
    const level4Houses: number[] = [];
    for (let h = 1; h <= 12; h++) {
      if (houseWise[h].level1.includes(body)) level1Houses.push(h);
      if (houseWise[h].level2.includes(body)) level2Houses.push(h);
      if (houseWise[h].level3.includes(body)) level3Houses.push(h);
      if (houseWise[h].level4.includes(body)) level4Houses.push(h);
    }
    planetWise[body] = {
      level1Houses,
      level2Houses,
      level3Houses,
      level4Houses,
      agentsFor: body === 'Rahu' ? agents.Rahu : body === 'Ketu' ? agents.Ketu : [],
    };
  }

  return {
    houseWise,
    planetWise,
    rahuKetuRules: NODE_AGENT_RULE_SET_DESCRIPTIONS[nodeAgentRuleSet],
  };
}
